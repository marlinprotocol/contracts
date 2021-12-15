// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./IRewardDelegators.sol";
import "../MPond.sol";


contract StakeManager is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable  // public upgrade
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "only admin");
        _;
    }

//-------------------------------- Overrides start --------------------------------//

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _setupRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._setupRole(role, account);
    }

    function grantRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function renounceRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.renounceRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function _authorizeUpgrade(address /*account*/) onlyAdmin internal view override {}

//-------------------------------- Overrides end --------------------------------//

//-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap1;

    function initialize(
        bytes32[] memory _tokenIds,
        address[] memory _tokenAddresses,
        address _MPONDTokenAddress,
        address _rewardDelegatorsAddress,
        uint256 _undelegationWaitTime,
        address _gatewayL1
    )
        initializer
        public
    {
        require(
            _tokenIds.length == _tokenAddresses.length
        );

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        for(uint256 i=0; i < _tokenIds.length; i++) {
            tokenAddresses[_tokenIds[i]] = Token(_tokenAddresses[i], true);
            emit TokenAdded(_tokenIds[i], _tokenAddresses[i]);
        }
        MPOND = MPond(_MPONDTokenAddress);
        rewardDelegators = IRewardDelegators(_rewardDelegatorsAddress);
        undelegationWaitTime = _undelegationWaitTime;
        gatewayL1 = _gatewayL1;
    }

//-------------------------------- Initializer end --------------------------------//

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
    MPond MPOND;
    MPond prevMPOND;
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

    address public gatewayL1;
    uint160 constant diff = uint160(0x1111000000000000000000000000000000001111);

    modifier onlyGatewayL1() {
        unchecked {
            require(
                address(uint160(_msgSender()) - diff) == gatewayL1
            );
        }
        _;
    }

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

    function updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) external onlyAdmin {
        emit LockTimeUpdated(_selector, lockWaitTime[_selector], _updatedWaitTime);
        lockWaitTime[_selector] = _updatedWaitTime;
    }

    function changeMPONDTokenAddress(
        address _MPONDTokenAddress
    ) external onlyAdmin {
        prevMPOND = MPOND;
        MPOND = MPond(_MPONDTokenAddress);
        emit TokenUpdated(keccak256("MPOND"), _MPONDTokenAddress);
    }

    function updateRewardDelegators(
        address _updatedRewardDelegator
    ) external onlyAdmin {
        require(
            _updatedRewardDelegator != address(0)
        );
        rewardDelegators = IRewardDelegators(_updatedRewardDelegator);
    }

    function updateUndelegationWaitTime(
        uint256 _undelegationWaitTime
    ) external onlyAdmin {
        undelegationWaitTime = _undelegationWaitTime;
        emit UndelegationWaitTimeUpdated(_undelegationWaitTime);
    }

    function enableToken(
        bytes32 _tokenId,
        address _address
    ) external onlyAdmin {
        require(
            !tokenAddresses[_tokenId].isActive
        );
        require(_address != address(0));
        tokenAddresses[_tokenId] = Token(_address, true);
        emit TokenAdded(_tokenId, _address);
    }

    function disableToken(
        bytes32 _tokenId
    ) external onlyAdmin {
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
            _tokens.length == _amounts.length
        );
        require(
            _tokens.length != 0
        );
        uint256 _stashIndex = stashIndex;
        bytes32 _stashId = keccak256(abi.encodePacked(_stashIndex));
        for(uint256 _index=0; _index < _tokens.length; _index++) {
            bytes32 _tokenId = _tokens[_index];
            uint256 _amount = _amounts[_index];
            require(
                tokenAddresses[_tokenId].isActive
            );
            require(
                stashes[_stashId].amount[_tokenId] == 0
            );
            require(
                _amount != 0
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
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            stashes[_stashId].undelegatesAt <= block.number
        );
        require(
            _tokens.length == _amounts.length
        );
        if(
            stashes[_stashId].delegatedCluster != address(0)
        ) {
            rewardDelegators.delegate(msg.sender, stashes[_stashId].delegatedCluster, _tokens, _amounts);
        }
        for(uint256 i = 0; i < _tokens.length; i++) {
            bytes32 _tokenId = _tokens[i];
            require(
                tokenAddresses[_tokenId].isActive
            );
            if(_amounts[i] != 0) {
                stashes[_stashId].amount[_tokenId] = stashes[_stashId].amount[_tokenId] + _amounts[i];
                _lockTokens(_tokenId, _amounts[i], msg.sender);
            }
        }

        emit AddedToStash(_stashId, stashes[_stashId].delegatedCluster, _tokens, _amounts);
    }

    function delegateStash(bytes32 _stashId, address _delegatedCluster) public {
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            _delegatedCluster != address(0)
        );
        require(
            stashes[_stashId].delegatedCluster == address(0)
        );
        require(
            stashes[_stashId].undelegatesAt <= block.number
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
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            stashes[_stashId].delegatedCluster != address(0)
        );
        require(
            _newCluster != address(0)
        );
        uint256 _redelegationBlock = _requestStashRedelegation(_stashId, _newCluster);
        emit RedelegationRequested(_stashId, stashes[_stashId].delegatedCluster, _newCluster, _redelegationBlock);
    }

    function _requestStashRedelegation(bytes32 _stashId, address _newCluster) internal returns(uint256) {
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        uint256 _unlockBlock = locks[_lockId].unlockBlock;
        require(
            _unlockBlock == 0
        );
        uint256 _redelegationBlock = block.number + lockWaitTime[REDELEGATION_LOCK_SELECTOR];
        locks[_lockId] = Lock(_redelegationBlock, uint256(uint160(_newCluster)));
        return _redelegationBlock;
    }

    function requestStashRedelegations(bytes32[] memory _stashIds, address[] memory _newClusters) public {
        require(_stashIds.length == _newClusters.length, "SM:RSRs - Invalid input data");
        for(uint256 i=0; i < _stashIds.length; i++) {
            requestStashRedelegation(_stashIds[i], _newClusters[i]);
        }
    }

    function redelegateStash(bytes32 _stashId) public {
        require(
             stashes[_stashId].delegatedCluster != address(0)
        );
        bytes32 _lockId = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId));
        uint256 _unlockBlock = locks[_lockId].unlockBlock;
        require(
            _unlockBlock != 0 && _unlockBlock <= block.number
        );
        address _updatedCluster = address(uint160(locks[_lockId].iValue));
        _redelegateStash(_stashId,  stashes[_stashId].staker,  stashes[_stashId].delegatedCluster, _updatedCluster);
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
        //Stash memory _stash = stashes[_stashId];
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            _tokens.length != 0
        );
        require(
            _tokens.length == _amounts.length
        );
        uint256 _stashIndex = stashIndex;
        bytes32 _newStashId = keccak256(abi.encodePacked(_stashIndex));
        for(uint256 _index=0; _index < _tokens.length; _index++) {
            bytes32 _tokenId = _tokens[_index];
            uint256 _amount = _amounts[_index];
            require(
                stashes[_newStashId].amount[_tokenId] == 0
            );
            require(
                _amount != 0
            );
            require(
                stashes[_stashId].amount[_tokenId] >= _amount
            );
            stashes[_stashId].amount[_tokenId] = stashes[_stashId].amount[_tokenId] - _amount;
            stashes[_newStashId].amount[_tokenId] = _amount;
        }
        stashes[_newStashId].staker = msg.sender;
        stashes[_newStashId].delegatedCluster = stashes[_stashId].delegatedCluster;
        stashes[_newStashId].undelegatesAt = stashes[_stashId].undelegatesAt;
        emit StashSplit(_newStashId, _stashId, _stashIndex, _tokens, _amounts);
        stashIndex = _stashIndex + 1;
    }

    function mergeStash(bytes32 _stashId1, bytes32 _stashId2) external {
        require(_stashId1 != _stashId2, "MS1");
        require(
            stashes[_stashId1].staker == msg.sender && stashes[_stashId2].staker == msg.sender
        );
        require(
            stashes[_stashId1].delegatedCluster == stashes[_stashId2].delegatedCluster
        );
        require(
            (stashes[_stashId1].undelegatesAt <= block.number) &&
            (stashes[_stashId2].undelegatesAt <= block.number)
        );
        bytes32 _lockId1 = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId1));
        uint256 _unlockBlock1 = locks[_lockId1].unlockBlock;
        bytes32 _lockId2 = keccak256(abi.encodePacked(REDELEGATION_LOCK_SELECTOR, _stashId2));
        uint256 _unlockBlock2 = locks[_lockId2].unlockBlock;
        require(
            _unlockBlock1 == 0 && _unlockBlock2 == 0
        );
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 _amount = stashes[_stashId2].amount[_tokens[i]];
            if(_amount == 0) {
                continue;
            }
            delete stashes[_stashId2].amount[_tokens[i]];
            stashes[_stashId1].amount[_tokens[i]] = stashes[_stashId1].amount[_tokens[i]] + _amount;
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
            msg.sender == stashes[_stashId].staker
        );
        require(_cancelRedelegation(_stashId));
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
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            stashes[_stashId].delegatedCluster != address(0)
        );
        uint256 _waitTime = undelegationWaitTime;
        uint256 _undelegationBlock = block.number + _waitTime;
        address _delegatedCluster = stashes[_stashId].delegatedCluster;
        stashes[_stashId].undelegatesAt = _undelegationBlock;
        delete stashes[_stashId].delegatedCluster;
        _cancelRedelegation(_stashId);
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amount[_tokens[i]];
        }
        rewardDelegators.undelegate(msg.sender, _delegatedCluster, _tokens, _amounts);
        emit StashUndelegated(_stashId, _delegatedCluster, _undelegationBlock);
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
            _staker == msg.sender
        );
        require(
            _undelegatesAt > block.number
        );
        require(
            _undelegatesAt < block.number
                             + undelegationWaitTime
                             - lockWaitTime[REDELEGATION_LOCK_SELECTOR]
        );
        delete stashes[_stashId].undelegatesAt;
        emit StashUndelegationCancelled(_stashId);
        _redelegateStash(_stashId, _staker, address(0), _delegatedCluster);
    }

    function withdrawStash(bytes32 _stashId) external {
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            stashes[_stashId].delegatedCluster == address(0)
        );
        require(
            stashes[_stashId].undelegatesAt <= block.number
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
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            stashes[_stashId].delegatedCluster == address(0)
        );
        require(
            stashes[_stashId].undelegatesAt <= block.number
        );
        require(
            _tokens.length == _amounts.length
        );
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 _balance = stashes[_stashId].amount[_tokens[i]];
            require(
                _balance >= _amounts[i]
            );
            if(_balance == _amounts[i]) {
                delete stashes[_stashId].amount[_tokens[i]];
            } else {
                stashes[_stashId].amount[_tokens[i]] = _balance - _amounts[i];
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
            IERC20Upgradeable(tokenAddress).transferFrom(
                _delegator,
                address(this),
                _amount
            )
        );
        // if (tokenAddress == address(MPOND)) {
        //     // send a request to delegate governance rights for the amount to delegator
        //     MPOND.delegate(
        //         _delegator,
        //         uint96(_amount)
        //     );
        // }
    }

    function _unlockTokens(bytes32 _tokenId, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        address tokenAddress = tokenAddresses[_tokenId].addr;
        // if(tokenAddress == address(MPOND)) {
        //     // send a request to undelegate governacne rights for the amount to previous delegator
        //     MPOND.undelegate(
        //         _delegator,
        //         uint96(_amount)
        //     );
        // } else if(tokenAddress == address(prevMPOND)) {
        //     prevMPOND.undelegate(
        //         _delegator,
        //         uint96(_amount)
        //     );
        // }
        require(
            IERC20Upgradeable(tokenAddress).transfer(
                _delegator,
                _amount
            )
        );
    }

    function getTokenAmountInStash(bytes32 _stashId, bytes32 _tokenId) external view returns(uint256) {
        return stashes[_stashId].amount[_tokenId];
    }

    function transferL2(
        address _staker,
        bytes32[] calldata _tokenIds,
        uint256[] calldata _allAmounts,
        address[] calldata _delegatedClusters
    ) external onlyGatewayL1 {
        uint256 _stashCount = _delegatedClusters.length;
        for(uint256 _sidx = 0; _sidx < _stashCount; _sidx++) {
            // create stash
            uint256 _stashIndex = stashIndex;
            bytes32 _stashId = keccak256(abi.encodePacked(_stashIndex));
            uint256[] memory _amounts = _allAmounts[(_sidx*_tokenIds.length):((_sidx+1)*_tokenIds.length)];
            for(uint256 _tidx=0; _tidx < _tokenIds.length; _tidx++) {
                bytes32 _tokenId = _tokenIds[_tidx];
                uint256 _amount = _amounts[_tidx];
                if(_amount == 0) {
                    continue;
                }
                stashes[_stashId].amount[_tokenId] = _amount;
            }
            stashes[_stashId].staker = _staker;
            emit StashCreated(_staker, _stashId, _stashIndex, _tokenIds, _amounts);
            stashIndex = _stashIndex + 1;  // Can't overflow

            // delegate
            stashes[_stashId].delegatedCluster = _delegatedClusters[_sidx];
            rewardDelegators.delegate(_staker, _delegatedClusters[_sidx], _tokenIds, _amounts);
            emit StashDelegated(_stashId, _delegatedClusters[_sidx]);
        }
    }
}
