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

    function _grantRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._revokeRole(role, account);

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
            _addToken(_tokenIds[i], _tokenAddresses[i]);
        }
        _setupRole(DELEGATABLE_TOKEN_ROLE, _MPONDTokenAddress);
        rewardDelegators = IRewardDelegators(_rewardDelegatorsAddress);
        _updateLockWaitTime(UNDELEGATION_LOCK_SELECTOR, _undelegationWaitTime);
        gatewayL1 = _gatewayL1;
    }

//-------------------------------- Initializer end --------------------------------//

//-------------------------------- Locks start --------------------------------//

    struct Lock {
        uint256 unlockTime;
        uint256 iValue;
    }

    mapping(bytes32 => Lock) public locks;
    mapping(bytes32 => uint256) public lockWaitTime;

    uint256[48] private __gap2;

    enum LockStatus {
        None,
        Unlocked,
        Locked
    }

    event LockTimeUpdated(bytes32 selector, uint256 prevLockTime, uint256 updatedLockTime);

    function _lockStatus(bytes32 _selector, bytes32 _key) internal view returns (LockStatus) {
        bytes32 _lockId = keccak256(abi.encodePacked(_selector, _key));
        uint256 _unlockTime = locks[_lockId].unlockTime;
        if(_unlockTime == 0) {
            return LockStatus.None;
        } else if(_unlockTime <= block.timestamp) {
            return LockStatus.Unlocked;
        } else {
            return LockStatus.Locked;
        }
    }

    function _lock(bytes32 _selector, bytes32 _key, uint256 _iValue) internal returns (uint256) {
        require(_lockStatus(_selector, _key) == LockStatus.None);

        uint256 _duration = lockWaitTime[_selector];
        bytes32 _lockId = keccak256(abi.encodePacked(_selector, _key));
        locks[_lockId].unlockTime = block.timestamp + _duration;
        locks[_lockId].iValue = _iValue;

        return block.timestamp + _duration;
    }

    function _revertLock(bytes32 _selector, bytes32 _key) internal returns (uint256) {
        bytes32 _lockId = keccak256(abi.encodePacked(_selector, _key));
        uint256 _iValue = locks[_lockId].iValue;
        delete locks[_lockId];

        return _iValue;
    }

    function _unlock(bytes32 _selector, bytes32 _key) internal returns (uint256) {
        require(_lockStatus(_selector, _key) == LockStatus.Unlocked);
        return _revertLock(_selector, _key);
    }

    function _cloneLock(bytes32 _selector, bytes32 _fromKey, bytes32 _toKey) internal {
        bytes32 _fromLockId = keccak256(abi.encodePacked(_selector, _fromKey));
        bytes32 _toLockId = keccak256(abi.encodePacked(_selector, _toKey));

        uint256 _unlockTime = locks[_fromLockId].unlockTime;
        uint256 _iValue = locks[_fromLockId].iValue;

        locks[_toLockId].unlockTime = _unlockTime;
        locks[_toLockId].iValue = _iValue;
    }

    function _updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) internal {
        emit LockTimeUpdated(_selector, lockWaitTime[_selector], _updatedWaitTime);
        lockWaitTime[_selector] = _updatedWaitTime;
    }

    function updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) external onlyAdmin {
        _updateLockWaitTime(_selector, _updatedWaitTime);
    }

//-------------------------------- Locks end --------------------------------//

//-------------------------------- Tokens start --------------------------------//

    bytes32 public constant DELEGATABLE_TOKEN_ROLE = keccak256("DELEGATABLE_TOKEN_ROLE");
    bytes32 public constant ACTIVE_TOKEN_ROLE = keccak256("ACTIVE_TOKEN_ROLE");

    mapping(bytes32 => address) tokens;

    uint256[49] private __gap3;

    event TokenAdded(bytes32 tokenId, address tokenAddress);
    event TokenUpdated(bytes32 tokenId, address oldTokenAddress, address newTokenAddress);

    function _addToken(bytes32 _tokenId, address _address) internal {
        require(_address != address(0));
        require(tokens[_tokenId] == address(0));

        tokens[_tokenId] = _address;
        emit TokenAdded(_tokenId, _address);
        _enableToken(_tokenId);
    }

    function _enableToken(bytes32 _tokenId) internal {
        require(hasRole(ACTIVE_TOKEN_ROLE, tokens[_tokenId]) == false);
        _grantRole(ACTIVE_TOKEN_ROLE, tokens[_tokenId]);
    }

    function _disableToken(bytes32 _tokenId) internal {
        require(hasRole(ACTIVE_TOKEN_ROLE, tokens[_tokenId]) == true);
        _revokeRole(ACTIVE_TOKEN_ROLE, tokens[_tokenId]);
    }

    function _updateToken(bytes32 _tokenId, address _address) internal {
        require(_address != address(0));
        address _oldAddress = tokens[_tokenId];
        require(_oldAddress != address(0));

        tokens[_tokenId] = _address;

        emit TokenUpdated(_tokenId, _oldAddress, _address);
    }

    function addToken(bytes32 _tokenId, address _address) external onlyAdmin {
        _addToken(_tokenId, _address);
    }

    function enableToken(bytes32 _tokenId) external onlyAdmin {
        _enableToken(_tokenId);
    }

    function disableToken(bytes32 _tokenId) external onlyAdmin {
        _disableToken(_tokenId);
    }

    function updateToken(bytes32 _tokenId, address _address) external onlyAdmin {
        _updateToken(_tokenId, _address);
    }

    function _lockTokens(bytes32 _tokenId, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        address tokenAddress = tokens[_tokenId];
        // pull tokens from mpond/pond contract
        // if mpond transfer the governance rights back
        require(
            IERC20Upgradeable(tokenAddress).transferFrom(
                _delegator,
                address(this),
                _amount
            )
        );
        if (hasRole(DELEGATABLE_TOKEN_ROLE, tokenAddress)) {
            // send a request to delegate governance rights for the amount to delegator
            MPond(tokenAddress).delegate(
                _delegator,
                uint96(_amount)
            );
        }
    }

    function _unlockTokens(bytes32 _tokenId, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        address tokenAddress = tokens[_tokenId];
        if (hasRole(DELEGATABLE_TOKEN_ROLE, tokenAddress)) {
            // send a request to undelegate governacne rights for the amount to previous delegator
            MPond(tokenAddress).undelegate(
                _delegator,
                uint96(_amount)
            );
        }
        require(
            IERC20Upgradeable(tokenAddress).transfer(
                _delegator,
                _amount
            )
        );
    }

//-------------------------------- Tokens end --------------------------------//

//-------------------------------- Stashes start --------------------------------//

    struct Stash {
        address staker;
        address delegatedCluster;
        mapping(bytes32 => uint256) amounts;
    }

    // stashId to stash
    // stashId = keccak256(index)
    mapping(bytes32 => Stash) public stashes;
    // Stash index for unique id generation
    uint256 public stashIndex;

    uint256[48] private __gap4;

//-------------------------------- Stashes end --------------------------------//

    IRewardDelegators public rewardDelegators;
    // new variables
    bytes32 public constant REDELEGATION_LOCK_SELECTOR = keccak256("REDELEGATION_LOCK");
    bytes32 public constant UNDELEGATION_LOCK_SELECTOR = keccak256("UNDELEGATION_LOCK");

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
    event RedelegationRequested(bytes32 stashId, address currentCluster, address updatedCluster, uint256 redelegatesAt);
    event Redelegated(bytes32 stashId, address updatedCluster);
    event StashSplit(
        bytes32 _newStashId,
        bytes32 _stashId,
        uint256 _stashIndex,
        bytes32[] _splitTokens,
        uint256[] _splitAmounts
    );
    event StashesMerged(bytes32 _stashId1, bytes32 _stashId2);
    event StashUndelegationCancelled(bytes32 _stashId);
    event RedelegationCancelled(bytes32 indexed _stashId);

    function updateRewardDelegators(
        address _updatedRewardDelegator
    ) external onlyAdmin {
        require(
            _updatedRewardDelegator != address(0)
        );
        rewardDelegators = IRewardDelegators(_updatedRewardDelegator);
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
                hasRole(ACTIVE_TOKEN_ROLE, tokens[_tokenId])
            );
            require(
                stashes[_stashId].amounts[_tokenId] == 0
            );
            require(
                _amount != 0
            );
            stashes[_stashId].amounts[_tokenId] = _amount;
            _lockTokens(_tokenId, _amount, msg.sender);
        }
        stashes[_stashId].staker = msg.sender;
        emit StashCreated(msg.sender, _stashId, _stashIndex, _tokens, _amounts);
        stashIndex = _stashIndex + 1;
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
                hasRole(ACTIVE_TOKEN_ROLE, tokens[_tokenId])
            );
            if(_amounts[i] != 0) {
                stashes[_stashId].amounts[_tokenId] = stashes[_stashId].amounts[_tokenId] + _amounts[i];
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
            _lockStatus(UNDELEGATION_LOCK_SELECTOR, _stashId) != LockStatus.Locked
        );
        stashes[_stashId].delegatedCluster = _delegatedCluster;
        _revertLock(UNDELEGATION_LOCK_SELECTOR, _stashId);
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i = 0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amounts[_tokens[i]];
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
        uint256 _redelegationTimestamp = _requestStashRedelegation(_stashId, _newCluster);
        emit RedelegationRequested(_stashId, stashes[_stashId].delegatedCluster, _newCluster, _redelegationTimestamp);
    }

    function _requestStashRedelegation(bytes32 _stashId, address _newCluster) internal returns(uint256) {
        return _lock(REDELEGATION_LOCK_SELECTOR, _stashId, uint256(uint160(_newCluster)));
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
        address _updatedCluster = address(uint160(_unlock(REDELEGATION_LOCK_SELECTOR, _stashId)));
        _redelegateStash(_stashId,  stashes[_stashId].staker,  stashes[_stashId].delegatedCluster, _updatedCluster);
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
            _amounts[i] = stashes[_stashId].amounts[_tokens[i]];
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
                stashes[_newStashId].amounts[_tokenId] == 0
            );
            require(
                _amount != 0
            );
            require(
                stashes[_stashId].amounts[_tokenId] >= _amount
            );
            stashes[_stashId].amounts[_tokenId] = stashes[_stashId].amounts[_tokenId] - _amount;
            stashes[_newStashId].amounts[_tokenId] = _amount;
        }
        stashes[_newStashId].staker = msg.sender;
        stashes[_newStashId].delegatedCluster = stashes[_stashId].delegatedCluster;
        _cloneLock(UNDELEGATION_LOCK_SELECTOR, _stashId, _newStashId);
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
            _lockStatus(UNDELEGATION_LOCK_SELECTOR, _stashId1) != LockStatus.Locked &&
            _lockStatus(UNDELEGATION_LOCK_SELECTOR, _stashId2) != LockStatus.Locked &&
            _lockStatus(REDELEGATION_LOCK_SELECTOR, _stashId1) == LockStatus.None &&
            _lockStatus(REDELEGATION_LOCK_SELECTOR, _stashId2) == LockStatus.None
        );

        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 _amount = stashes[_stashId2].amounts[_tokens[i]];
            if(_amount == 0) {
                continue;
            }
            delete stashes[_stashId2].amounts[_tokens[i]];
            stashes[_stashId1].amounts[_tokens[i]] = stashes[_stashId1].amounts[_tokens[i]] + _amount;
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
        bool _exists = _lockStatus(REDELEGATION_LOCK_SELECTOR, _stashId) != LockStatus.None;
        _revertLock(REDELEGATION_LOCK_SELECTOR, _stashId);
        if(_exists) {
            emit RedelegationCancelled(_stashId);
        }
        return _exists;
    }

    function undelegateStash(bytes32 _stashId) public {
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            stashes[_stashId].delegatedCluster != address(0)
        );
        address _delegatedCluster = stashes[_stashId].delegatedCluster;
        uint256 _undelegationBlock = _lock(UNDELEGATION_LOCK_SELECTOR, _stashId, uint256(uint160(_delegatedCluster)));
        delete stashes[_stashId].delegatedCluster;
        _cancelRedelegation(_stashId);
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amounts[_tokens[i]];
        }
        rewardDelegators.undelegate(msg.sender, _delegatedCluster, _tokens, _amounts);
        emit StashUndelegated(_stashId, _delegatedCluster, _undelegationBlock);
    }

    function undelegateStashes(bytes32[] memory _stashIds) public {
        for(uint256 i=0; i < _stashIds.length; i++) {
            undelegateStash(_stashIds[i]);
        }
    }

    function cancelUndelegation(bytes32 _stashId) public {
        address _staker = stashes[_stashId].staker;
        require(
            _staker == msg.sender
        );
        require(
            _lockStatus(UNDELEGATION_LOCK_SELECTOR, _stashId) == LockStatus.Locked
        );
        address _delegatedCluster = address(uint160(_revertLock(UNDELEGATION_LOCK_SELECTOR, _stashId)));
        stashes[_stashId].delegatedCluster = _delegatedCluster;
        emit StashUndelegationCancelled(_stashId);
        if(_delegatedCluster != address(0)) {
            bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
            uint256[] memory _amounts = new uint256[](_tokens.length);
            for(uint256 i=0; i < _tokens.length; i++) {
                _amounts[i] = stashes[_stashId].amounts[_tokens[i]];
            }
            rewardDelegators.delegate(msg.sender, _delegatedCluster, _tokens, _amounts);
        }
    }

    function withdrawStash(bytes32 _stashId) external {
        require(
            stashes[_stashId].staker == msg.sender
        );
        require(
            stashes[_stashId].delegatedCluster == address(0)
        );
        require(
            _lockStatus(UNDELEGATION_LOCK_SELECTOR, _stashId) != LockStatus.Locked
        );
        bytes32[] memory _tokens = rewardDelegators.getFullTokenList();
        uint256[] memory _amounts = new uint256[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            _amounts[i] = stashes[_stashId].amounts[_tokens[i]];
            if(_amounts[i] == 0) continue;
            delete stashes[_stashId].amounts[_tokens[i]];
            _unlockTokens(_tokens[i], _amounts[i], msg.sender);
        }
        // Other items already zeroed
        delete stashes[_stashId].staker;
        _revertLock(UNDELEGATION_LOCK_SELECTOR, _stashId);
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
            _lockStatus(UNDELEGATION_LOCK_SELECTOR, _stashId) != LockStatus.Locked
        );
        require(
            _tokens.length == _amounts.length
        );
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 _balance = stashes[_stashId].amounts[_tokens[i]];
            require(
                _balance >= _amounts[i]
            );
            if(_balance == _amounts[i]) {
                delete stashes[_stashId].amounts[_tokens[i]];
            } else {
                stashes[_stashId].amounts[_tokens[i]] = _balance - _amounts[i];
            }
            _unlockTokens(_tokens[i], _amounts[i], msg.sender);
        }
        emit StashWithdrawn(_stashId, _tokens, _amounts);
    }

    function getTokenAmountInStash(bytes32 _stashId, bytes32 _tokenId) external view returns(uint256) {
        return stashes[_stashId].amounts[_tokenId];
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
                stashes[_stashId].amounts[_tokenId] = _amount;
            }
            stashes[_stashId].staker = _staker;
            emit StashCreated(_staker, _stashId, _stashIndex, _tokenIds, _amounts);
            stashIndex = _stashIndex + 1;  // Can't overflow

            // delegate
            stashes[_stashId].delegatedCluster = _delegatedClusters[_sidx];
            if(_delegatedClusters[_sidx] != address(0)) {
                rewardDelegators.delegate(_staker, _delegatedClusters[_sidx], _tokenIds, _amounts);
                emit StashDelegated(_stashId, _delegatedClusters[_sidx]);
            }
        }
    }
}
