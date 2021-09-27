pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./IRewardDelegators.sol";
import "../governance/MPondLogic.sol";


contract StakeManager is Initializable, Ownable {

    using SafeMath for uint256;

    struct Stash {
        address staker;
        address delegatedCluster;
        mapping(bytes32 => uint256) amount;   // name is not intuitive
        uint256 undelegatesAt;
    }

    struct Token {
        address addr;
        bool isActive;
    }
    // stashId to stash
    // stashId = keccak256(index)
    mapping(bytes32 => Stash) public stashes;
    // Stash index for unique id generation
    uint256 public stashIndex;
    // tokenId to token address - tokenId = keccak256(tokenTicker)
    mapping(bytes32 => Token) tokenAddresses;
    MPondLogic MPOND;
    MPondLogic prevMPOND;
    address _unused_1;
    IRewardDelegators public rewardDelegators;
    // new variables
    struct Lock {
        uint256 unlockBlock;
        uint256 iValue;
    }

    mapping(bytes32 => Lock) public locks;
    mapping(bytes32 => uint256) public lockWaitTime;
    bytes32 constant REDELEGATION_LOCK_SELECTOR = keccak256("REDELEGATION_LOCK");
    uint256 public undelegationWaitTime;

    event StashCreated(
        address indexed creator,
        bytes32 stashId,
        uint256 stashIndex,
        bytes32[] tokens,
        uint256[] amounts
    );
    event StashDelegated(bytes32 stashId, address delegatedCluster);
    event StashUndelegated(bytes32 stashId, address undelegatedCluster, uint256 undelegatesAt);
    event StashWithdrawn(bytes32 stashId, bytes32[] tokens, uint256[] amounts);
    event StashClosed(bytes32 stashId, address indexed staker);
    event AddedToStash(bytes32 stashId, address delegatedCluster, bytes32[] tokens, uint256[] amounts);
    event TokenAdded(bytes32 tokenId, address tokenAddress);
    event TokenRemoved(bytes32 tokenId);
    event TokenUpdated(bytes32 tokenId, address tokenAddress);
    event RedelegationRequested(bytes32 stashId, address currentCluster, address updatedCluster, uint256 redelegatesAt);
    event Redelegated(bytes32 stashId, address updatedCluster);
    event LockTimeUpdated(bytes32 selector, uint256 prevLockTime, uint256 updatedLockTime);
    event StashSplit(
        bytes32 _newStashId,
        bytes32 _stashId,
        uint256 _stashIndex,
        bytes32[] _splitTokens,
        uint256[] _splitAmounts
    );
    event StashesMerged(bytes32 _stashId1, bytes32 _stashId2);
    event StashUndelegationCancelled(bytes32 _stashId);
    event UndelegationWaitTimeUpdated(uint256 undelegationWaitTime);
    event RedelegationCancelled(bytes32 indexed _stashId);

    function initialize(
        bytes32[] memory _tokenIds,
        address[] memory _tokenAddresses,
        address _MPONDTokenAddress,
        address _rewardDelegatorsAddress,
        address _owner,
        uint256 _undelegationWaitTime)
        initializer
        public
    {
        require(
            _tokenIds.length == _tokenAddresses.length
        );
        for(uint256 i=0; i < _tokenIds.length; i++) {
            tokenAddresses[_tokenIds[i]] = Token(_tokenAddresses[i], true);
            emit TokenAdded(_tokenIds[i], _tokenAddresses[i]);
        }
        MPOND = MPondLogic(_MPONDTokenAddress);
        rewardDelegators = IRewardDelegators(_rewardDelegatorsAddress);
        undelegationWaitTime = _undelegationWaitTime;
        super.initialize(_owner);
    }

    function updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) external onlyOwner {
        emit LockTimeUpdated(_selector, lockWaitTime[_selector], _updatedWaitTime);
        lockWaitTime[_selector] = _updatedWaitTime;
    }

    function changeMPONDTokenAddress(
        address _MPONDTokenAddress
    ) external onlyOwner {
        prevMPOND = MPOND;
        MPOND = MPondLogic(_MPONDTokenAddress);
        emit TokenUpdated(keccak256("MPOND"), _MPONDTokenAddress);
    }

    function updateRewardDelegators(
        address _updatedRewardDelegator
    ) external onlyOwner {
        require(
            _updatedRewardDelegator != address(0)
        );
        rewardDelegators = IRewardDelegators(_updatedRewardDelegator);
    }

    function updateUndelegationWaitTime(
        uint256 _undelegationWaitTime
    ) external onlyOwner {
        undelegationWaitTime = _undelegationWaitTime;
        emit UndelegationWaitTimeUpdated(_undelegationWaitTime);
    }

    function enableToken(
        bytes32 _tokenId,
        address _address
    ) external onlyOwner {
        require(
            !tokenAddresses[_tokenId].isActive
        );
        require(_address != address(0));
        tokenAddresses[_tokenId] = Token(_address, true);
        emit TokenAdded(_tokenId, _address);
    }

    function disableToken(
        bytes32 _tokenId
    ) external onlyOwner {
        require(
            tokenAddresses[_tokenId].isActive
        );
        tokenAddresses[_tokenId].isActive = false;
        emit TokenRemoved(_tokenId);
    }

    function createStashAndDelegate(
        bytes32[] memory _tokens,
        uint256[] memory _amounts,
        address _delegatedCluster
    ) public {
        bytes32 stashId = createStash(_tokens, _amounts);
        delegateStash(stashId, _delegatedCluster);
    }

    function createStash(
        bytes32[] memory _tokens,
        uint256[] memory _amounts
    ) public returns(bytes32) {
        require(
            _tokens.length == _amounts.length,
            "CS1"
        );
        require(
            _tokens.length != 0,
            "CS2"
        );
        uint256 _stashIndex = stashIndex;
        bytes32 _stashId = keccak256(abi.encodePacked(_stashIndex));
        for(uint256 _index=0; _index < _tokens.length; _index++) {
            bytes32 _tokenId = _tokens[_index];
            uint256 _amount = _amounts[_index];
            require(
                tokenAddresses[_tokenId].isActive,
                "CS3"
            );
            require(
                stashes[_stashId].amount[_tokenId] == 0,
                "CS4"
            );
            require(
                _amount != 0,
                "CS5"
            );
            stashes[_stashId].amount[_tokenId] = _amount;
            _lockTokens(_tokenId, _amount, msg.sender);
        }
        stashes[_stashId].staker = msg.sender;
        emit StashCreated(msg.sender, _stashId, _stashIndex, _tokens, _amounts);
        stashIndex = _stashIndex + 1;  // Can't overflow
        return _stashId;
    }

    function addToStash(
        bytes32 _stashId,
        bytes32[] calldata _tokens,
        uint256[] calldata _amounts
    ) external {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "AS1"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "AS2"
        );
        require(
            _tokens.length == _amounts.length,
            "AS3"
        );
        if(
            _stash.delegatedCluster != address(0)
        ) {
            rewardDelegators.delegate(msg.sender, _stash.delegatedCluster, _tokens, _amounts);
        }
        for(uint256 i = 0; i < _tokens.length; i++) {
            bytes32 _tokenId = _tokens[i];
            require(
                tokenAddresses[_tokenId].isActive,
                "AS4"
            );
            if(_amounts[i] != 0) {
                stashes[_stashId].amount[_tokenId] = stashes[_stashId].amount[_tokenId].add(_amounts[i]);
                _lockTokens(_tokenId, _amounts[i], msg.sender);
            }
        }
        
        emit AddedToStash(_stashId, _stash.delegatedCluster, _tokens, _amounts);
    }

    function delegateStash(bytes32 _stashId, address _delegatedCluster) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "DS1"
        );
        require(
            _delegatedCluster != address(0),
            "DS2"
        );
        require(
            _stash.delegatedCluster == address(0),
            "DS3"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "DS4"
        );
        stashes[_stashId].delegatedCluster = _delegatedCluster;
        delete stashes[_stashId].undelegatesAt;
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i = 0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amount[_tokens[i]];
        }
        rewardDelegators.delegate(msg.sender, _delegatedCluster, _tokens, _amounts);
        emit StashDelegated(_stashId, _delegatedCluster);
    }

    function requestStashRedelegation(bytes32 _stashId, address _newCluster) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "RSR1"
        );
        require(
            _stash.delegatedCluster != address(0),
            "RSR2"
        );
        require(
            _newCluster != address(0),
            "RSR3"
        );
        uint256 _redelegationBlock = _requestStashRedelegation(_stashId, _newCluster);
        emit RedelegationRequested(_stashId, _stash.delegatedCluster, _newCluster, _redelegationBlock);
    }

    function _requestStashRedelegation(bytes32 _stashId, address _newCluster) internal returns(uint256) {
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        uint256 _unlockBlock = locks[_lockId].unlockBlock;
        require(
            _unlockBlock == 0,
            "IRSR1"
        );
        uint256 _redelegationBlock = block.number.add(lockWaitTime[REDELEGATION_LOCK_SELECTOR]);
        locks[_lockId] = Lock(_redelegationBlock, uint256(_newCluster));
        return _redelegationBlock;
    }

    function requestStashRedelegations(bytes32[] memory _stashIds, address[] memory _newClusters) public {
        require(_stashIds.length == _newClusters.length, "SM:RSRs - Invalid input data");
        for(uint256 i=0; i < _stashIds.length; i++) {
            requestStashRedelegation(_stashIds[i], _newClusters[i]);
        }
    }

    function redelegateStash(bytes32 _stashId) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.delegatedCluster != address(0),
            "RS1"
        );
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        uint256 _unlockBlock = locks[_lockId].unlockBlock;
        require(
            _unlockBlock != 0 && _unlockBlock <= block.number,
            "RS2"
        );
        address _updatedCluster = address(locks[_lockId].iValue);
        _redelegateStash(_stashId, _stash.staker, _stash.delegatedCluster, _updatedCluster);
        delete locks[_lockId];
    }

    function _redelegateStash(
        bytes32 _stashId,
        address _staker,
        address _delegatedCluster,
        address _updatedCluster
    ) internal {
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amount[_tokens[i]];
        }
        if(_delegatedCluster != address(0)) {
            rewardDelegators.undelegate(_staker, _delegatedCluster, _tokens, _amounts);
        }
        rewardDelegators.delegate(_staker, _updatedCluster, _tokens, _amounts);
        stashes[_stashId].delegatedCluster = _updatedCluster;
        emit Redelegated(_stashId, _updatedCluster);
    }

    function splitStash(bytes32 _stashId, bytes32[] calldata _tokens, uint256[] calldata _amounts) external {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "SS1"
        );
        require(
            _tokens.length != 0,
            "SS2"
        );
        require(
            _tokens.length == _amounts.length,
            "SS3"
        );
        uint256 _stashIndex = stashIndex;
        bytes32 _newStashId = keccak256(abi.encodePacked(_stashIndex));
        for(uint256 _index=0; _index < _tokens.length; _index++) {
            bytes32 _tokenId = _tokens[_index];
            uint256 _amount = _amounts[_index];
            require(
                stashes[_newStashId].amount[_tokenId] == 0,
                "SS4"
            );
            require(
                _amount != 0,
                "SS5"
            );
            stashes[_stashId].amount[_tokenId] = stashes[_stashId].amount[_tokenId].sub(
                _amount,
                "SS6"
            );
            stashes[_newStashId].amount[_tokenId] = _amount;
        }
        stashes[_newStashId].staker = msg.sender;
        stashes[_newStashId].delegatedCluster = _stash.delegatedCluster;
        stashes[_newStashId].undelegatesAt = _stash.undelegatesAt;
        emit StashSplit(_newStashId, _stashId, _stashIndex, _tokens, _amounts);
        stashIndex = _stashIndex + 1;
    }

    function mergeStash(bytes32 _stashId1, bytes32 _stashId2) external {
        require(_stashId1 != _stashId2, "MS1");
        Stash memory _stash1 = stashes[_stashId1];
        Stash memory _stash2 = stashes[_stashId2];
        require(
            _stash1.staker == msg.sender && _stash2.staker == msg.sender,
            "MS2"
        );
        require(
            _stash1.delegatedCluster == _stash2.delegatedCluster,
            "MS3"
        );
        require(
            (_stash1.undelegatesAt == 0 || _stash1.undelegatesAt <= block.number) &&
            (_stash2.undelegatesAt == 0 || _stash2.undelegatesAt <= block.number),
            "MS4"
        );
        bytes32 _lockId1 = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId1));
        uint256 _unlockBlock1 = locks[_lockId1].unlockBlock;
        bytes32 _lockId2 = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId2));
        uint256 _unlockBlock2 = locks[_lockId2].unlockBlock;
        require(
            _unlockBlock1 == 0 && _unlockBlock2 == 0,
            "MS5"
        );
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 _amount = stashes[_stashId2].amount[_tokens[i]];
            if(_amount == 0) {
                continue;
            }
            delete stashes[_stashId2].amount[_tokens[i]];
            stashes[_stashId1].amount[_tokens[i]] = stashes[_stashId1].amount[_tokens[i]].add(_amount);
        }
        delete stashes[_stashId2];
        emit StashesMerged(_stashId1, _stashId2);
    }

    function redelegateStashes(bytes32[] memory _stashIds) public {
        for(uint256 i=0; i < _stashIds.length; i++) {
            redelegateStash(_stashIds[i]);
        }
    }
    
    function cancelRedelegation(bytes32 _stashId) public {
        require(
            msg.sender == stashes[_stashId].staker,
            "CR1"
        );
        require(_cancelRedelegation(_stashId), "CR2");
    }

    function _cancelRedelegation(bytes32 _stashId) internal returns(bool) {
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        if(locks[_lockId].unlockBlock != 0) {
            delete locks[_lockId];
            emit RedelegationCancelled(_stashId);
            return true;
        }
        return false;
    }

    function undelegateStash(bytes32 _stashId) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "US1"
        );
        require(
            _stash.delegatedCluster != address(0),
            "US2"
        );
        uint256 _waitTime = undelegationWaitTime;
        uint256 _undelegationBlock = block.number.add(_waitTime);
        stashes[_stashId].undelegatesAt = _undelegationBlock;
        delete stashes[_stashId].delegatedCluster;
        _cancelRedelegation(_stashId);
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amount[_tokens[i]];
        }
        rewardDelegators.undelegate(msg.sender, _stash.delegatedCluster, _tokens, _amounts);
        emit StashUndelegated(_stashId, _stash.delegatedCluster, _undelegationBlock);
    }

    function undelegateStashes(bytes32[] memory _stashIds) public {
        for(uint256 i=0; i < _stashIds.length; i++) {
            undelegateStash(_stashIds[i]);
        }
    }
    
    function cancelUndelegation(bytes32 _stashId, address _delegatedCluster) public {
        address _staker = stashes[_stashId].staker;
        uint256 _undelegatesAt = stashes[_stashId].undelegatesAt;
        require(
            _staker == msg.sender,
            "CU1"
        );
        require(
            _undelegatesAt > block.number,
            "CU2"
        );
        require(
            _undelegatesAt < block.number
                            .add(undelegationWaitTime)
                            .sub(lockWaitTime[REDELEGATION_LOCK_SELECTOR]),
            "CU3"
        );
        delete stashes[_stashId].undelegatesAt;
        emit StashUndelegationCancelled(_stashId);
        _redelegateStash(_stashId, _staker, address(0), _delegatedCluster);
    }

    function withdrawStash(bytes32 _stashId) external {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "WS1"
        );
        require(
            _stash.delegatedCluster == address(0),
            "WS2"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "WS3"
        );
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amount[_tokens[i]];
            if(_amounts[i] == 0) continue;
            delete stashes[_stashId].amount[_tokens[i]];
            _unlockTokens(_tokens[i], _amounts[i], msg.sender);
        }
        // Other items already zeroed
        delete stashes[_stashId].staker;
        delete stashes[_stashId].undelegatesAt;
        emit StashWithdrawn(_stashId, _tokens, _amounts);
        emit StashClosed(_stashId, msg.sender);
    }

    function withdrawStash(
        bytes32 _stashId,
        bytes32[] calldata _tokens,
        uint256[] calldata _amounts
    ) external {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "WSC1"
        );
        require(
            _stash.delegatedCluster == address(0),
            "WSC2"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "WSC3"
        );
        require(
            _tokens.length == _amounts.length,
            "WSC4"
        );
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 _balance = stashes[_stashId].amount[_tokens[i]];
            require(
                _balance >= _amounts[i],
                "WSC5"
            );
            if(_balance == _amounts[i]) {
                delete stashes[_stashId].amount[_tokens[i]];
            } else {
                stashes[_stashId].amount[_tokens[i]] = _balance.sub(_amounts[i]);
            }
            _unlockTokens(_tokens[i], _amounts[i], msg.sender);
        }
        emit StashWithdrawn(_stashId, _tokens, _amounts);
    }

    function _lockTokens(bytes32 _tokenId, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        address tokenAddress = tokenAddresses[_tokenId].addr;
        // pull tokens from mpond/pond contract
        // if mpond transfer the governance rights back
        require(
            ERC20(tokenAddress).transferFrom(
                _delegator,
                address(this),
                _amount
            ), "LT1"
        );
        if (tokenAddress == address(MPOND)) {
            // send a request to delegate governance rights for the amount to delegator
            MPOND.delegate(
                _delegator,
                uint96(_amount)
            );
        }
    }

    function _unlockTokens(bytes32 _tokenId, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        address tokenAddress = tokenAddresses[_tokenId].addr;
        if(tokenAddress == address(MPOND)) {
            // send a request to undelegate governacne rights for the amount to previous delegator
            MPOND.undelegate(
                _delegator,
                uint96(_amount)
            );
        } else if(tokenAddress == address(prevMPOND)) {
            prevMPOND.undelegate(
                _delegator,
                uint96(_amount)
            );
        }
        require(
            ERC20(tokenAddress).transfer(
                _delegator,
                _amount
            ), "UT1"
        );
    }

    function getTokenAmountInStash(bytes32 _stashId, bytes32 _tokenId) external view returns(uint256) {
        return stashes[_stashId].amount[_tokenId];
    }
}
