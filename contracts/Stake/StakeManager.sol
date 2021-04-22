pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./IRewardDelegators.sol";
import "../governance/mPondLogic.sol";
import "./IClusterRegistry.sol";


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
    IClusterRegistry clusterRegistry;
    IRewardDelegators public rewardDelegators;
    // new variables
    struct Lock {
        uint256 unlockBlock;
        uint256 iValue;
    }

    mapping(bytes32 => Lock) public locks;
    mapping(bytes32 => uint256) public lockWaitTime;
    bytes32 constant REDELEGATION_LOCK_SELECTOR = keccak256("REDELEGATION_LOCK");

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

    function initialize(
        bytes32[] memory _tokenIds,
        address[] memory _tokenAddresses,
        address _MPONDTokenAddress,
        address _clusterRegistryAddress,
        address _rewardDelegatorsAddress,
        address _owner)
        initializer
        public
    {
        require(
            _tokenIds.length == _tokenAddresses.length,
            "SM:I-each tokenId should have a corresponding tokenAddress and vice versa"
        );
        for(uint256 i=0; i < _tokenIds.length; i++) {
            tokenAddresses[_tokenIds[i]] = Token(_tokenAddresses[i], true);
            emit TokenAdded(_tokenIds[i], _tokenAddresses[i]);
        }
        MPOND = MPondLogic(_MPONDTokenAddress);
        clusterRegistry = IClusterRegistry(_clusterRegistryAddress);
        rewardDelegators = IRewardDelegators(_rewardDelegatorsAddress);
        super.initialize(_owner);
    }

    function updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) public onlyOwner {
        emit LockTimeUpdated(_selector, lockWaitTime[_selector], _updatedWaitTime);
        lockWaitTime[_selector] = _updatedWaitTime;
    }

    function changeMPONDTokenAddress(
        address _MPONDTokenAddress
    ) public onlyOwner {
        prevMPOND = MPOND;
        MPOND = MPondLogic(_MPONDTokenAddress);
        emit TokenUpdated(keccak256("MPOND"), _MPONDTokenAddress);
    }

    function updateRewardDelegators(
        address _updatedRewardDelegator
    ) public onlyOwner {
        require(
            _updatedRewardDelegator != address(0),
            "SM:URD-RewardDelegators address cant be 0"
        );
        rewardDelegators = IRewardDelegators(_updatedRewardDelegator);
    }

    function updateClusterRegistry(
        address _updatedClusterRegistry
    ) public onlyOwner {
        require(
            _updatedClusterRegistry != address(0),
            "SM:UCR-Cluster Registry address cant be 0"
        );
        clusterRegistry = IClusterRegistry(_updatedClusterRegistry);
    }

    function enableToken(
        bytes32 _tokenId,
        address _address
    ) public onlyOwner {
        require(
            !tokenAddresses[_tokenId].isActive,
            "SM:ET-Token already enabled"
        );
        require(_address != address(0), "SM:ET-0 address not allowed");
        tokenAddresses[_tokenId] = Token(_address, true);
        emit TokenAdded(_tokenId, _address);
    }

    function disableToken(
        bytes32 _tokenId
    ) public onlyOwner {
        require(
            tokenAddresses[_tokenId].isActive,
            "SM:DT-Token already disabled"
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
            "SM:CS-each tokenId should have a corresponding amount and vice versa"
        );
        require(
            _tokens.length != 0,
            "SM:CS-stash must have atleast 1 token"
        );
        uint256 _stashIndex = stashIndex;
        bytes32 _stashId = keccak256(abi.encodePacked(_stashIndex));
        for(uint256 _index=0; _index < _tokens.length; _index++) {
            bytes32 _tokenId = _tokens[_index];
            uint256 _amount = _amounts[_index];
            require(
                tokenAddresses[_tokenId].isActive,
                "SM:CS-Invalid tokenId"
            );
            require(
                stashes[_stashId].amount[_tokenId] == 0,
                "SM:CS-Cant add the same token twice while creating stash"
            );
            require(
                _amount != 0,
                "SM:CS-Cant add tokens with 0 amount"
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
        bytes32[] memory _tokens,
        uint256[] memory _amounts
    ) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "SM:ATS-Only staker can delegate stash to a cluster"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "SM:ATS-Cant add to stash during undelegation"
        );
        require(
            _tokens.length == _amounts.length,
            "SM:ATS-Each tokenId should have a corresponding amount and vice versa"
        );
        if(_stash.delegatedCluster != address(0)) {
            rewardDelegators.delegate(msg.sender, _stash.delegatedCluster, _tokens, _amounts);
        }
        for(uint256 i = 0; i < _tokens.length; i++) {
            bytes32 _tokenId = _tokens[i];
            require(
                tokenAddresses[_tokenId].isActive,
                "SM:ATS-Invalid tokenId"
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
            "SM:DS-Only staker can delegate stash to a cluster"
        );
        require(
            clusterRegistry.isClusterValid(_delegatedCluster),
            "SM:DS-delegated cluster address is not valid"
        );
        require(
            _stash.delegatedCluster == address(0),
            "SM:DS-stash already delegated to another cluster. Please undelegate from delegating"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "SM:DS-stash is not yet undelegated"
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
            "SM:RSR-Only staker can redelegate stash to another cluster"
        );
        require(
            _stash.delegatedCluster != address(0),
            "SM:RSR-Stash not already delegated"
        );
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        uint256 _unlockBlock = locks[_lockId].unlockBlock;
        require(
            _unlockBlock == 0,
            "SM:RSR-Please close the existing redelegation request before placing a new one"
        );
        uint256 _redelegationBlock = block.number.add(lockWaitTime[REDELEGATION_LOCK_SELECTOR]);
        locks[_lockId] = Lock(_redelegationBlock, uint256(_newCluster));
        emit RedelegationRequested(_stashId, _stash.delegatedCluster, _newCluster, _redelegationBlock);
    }

    function redelegateStash(bytes32 _stashId) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.delegatedCluster != address(0),
            "SM:RS-Stash not already delegated"
        );
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        uint256 _unlockBlock = locks[_lockId].unlockBlock;
        require(
            _unlockBlock <= block.number,
            "SM:RS-Redelegation period incomplete"
        );
        address _updatedCluster = address(locks[_lockId].iValue);
        require(
            clusterRegistry.isClusterValid(_updatedCluster),
            "SM:RS-invalid cluster"
        );
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amount[_tokens[i]];
        }
        rewardDelegators.undelegate(_stash.staker, _stash.delegatedCluster, _tokens, _amounts);
        rewardDelegators.delegate(_stash.staker, _updatedCluster, _tokens, _amounts);
        stashes[_stashId].delegatedCluster = _updatedCluster;
        delete locks[_lockId];
        emit Redelegated(_stashId, _updatedCluster);
    }

    function undelegateStash(bytes32 _stashId) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "SM:UDS-Only staker can undelegate stash"
        );
        require(
            _stash.delegatedCluster != address(0),
            "SM:UDS-stash is not delegated to any cluster"
        );
        uint256 _waitTime = rewardDelegators.undelegationWaitTime();
        uint256 _undelegationBlock = block.number.add(_waitTime);
        stashes[_stashId].undelegatesAt = _undelegationBlock;
        delete stashes[_stashId].delegatedCluster;
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        if(locks[_lockId].unlockBlock != 0) {
            delete locks[_lockId];
        }
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amount[_tokens[i]];
        }
        rewardDelegators.undelegate(msg.sender, _stash.delegatedCluster, _tokens, _amounts);
        emit StashUndelegated(_stashId, _stash.delegatedCluster, _undelegationBlock);
    }

    function withdrawStash(bytes32 _stashId) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "SM:WS-Only staker can withdraw stash"
        );
        require(
            _stash.delegatedCluster == address(0),
            "SM:WS-Please undelegate before withdrawal"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "SM:WS-stash isnt undelegated"
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
        bytes32[] memory _tokens,
        uint256[] memory _amounts
    ) public {
        Stash memory _stash = stashes[_stashId];
        require(
            _stash.staker == msg.sender,
            "SM:WS-Only staker can withdraw stash"
        );
        require(
            _stash.delegatedCluster == address(0),
            "SM:WS-Please undelegate before withdrawal"
        );
        require(
            _stash.undelegatesAt <= block.number,
            "SM:WS-stash isnt yet undelegated"
        );
        require(
            _tokens.length == _amounts.length,
            "SM:WS-Each tokenId should have a corresponding amount and vice versa"
        );
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 _balance = stashes[_stashId].amount[_tokens[i]];
            require(
                _balance >= _amounts[i],
                "SM:WS-balance not sufficient"
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
            ), "SM:LT-ERC20 transfer failed"
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
            ), "SM:ULT-ERC20 transfer failed"
        );
    }

    function getTokenAmountInStash(bytes32 _stashId, bytes32 _tokenId) public view returns(uint256) {
        return stashes[_stashId].amount[_tokenId];
    }
}