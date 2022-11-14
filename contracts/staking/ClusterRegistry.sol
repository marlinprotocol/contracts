// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IClusterRegistry.sol";

contract ClusterRegistry is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade,
    IClusterRegistry  // interface
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

    function initialize(uint256[3] calldata _lockWaitTimes)
        public
        initializer
    {
        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        bytes32[3] memory _selectors = [COMMISSION_LOCK_SELECTOR, SWITCH_NETWORK_LOCK_SELECTOR, UNREGISTER_LOCK_SELECTOR];
        for(uint256 i=0; i < _selectors.length; i++) {
            lockWaitTime[_selectors[i]] = _lockWaitTimes[i];
            emit LockTimeUpdated(_selectors[i], 0, _lockWaitTimes[i]);
        }
    }

//-------------------------------- Initializer end --------------------------------//

//-------------------------------- Locks start --------------------------------//

    struct Lock {
        uint256 unlockBlock;
        uint256 iValue;
    }
    mapping(bytes32 => Lock) public locks;
    mapping(bytes32 => uint256) public lockWaitTime;

    bytes32 constant COMMISSION_LOCK_SELECTOR = keccak256("COMMISSION_LOCK");
    bytes32 constant SWITCH_NETWORK_LOCK_SELECTOR = keccak256("SWITCH_NETWORK_LOCK");
    bytes32 constant UNREGISTER_LOCK_SELECTOR = keccak256("UNREGISTER_LOCK");

    event LockTimeUpdated(bytes32 indexed selector, uint256 prevLockTime, uint256 updatedLockTime);

    function updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) external onlyAdmin {
        emit LockTimeUpdated(_selector, lockWaitTime[_selector], _updatedWaitTime);
        lockWaitTime[_selector] = _updatedWaitTime;
    }

//-------------------------------- Locks end --------------------------------//

//-------------------------------- Clusters start --------------------------------//

    enum Status{NOT_REGISTERED, REGISTERED}
    struct Cluster {
        bytes32 networkId; // keccak256("ETH") // token ticker for anyother chain in place of ETH
        uint256 commission;
        address rewardAddress;
        address clientKey;
        Status status;
    }
    mapping(address => Cluster) clusters;
    mapping(address => address) public clientKeys;

    event ClusterRegistered(
        address indexed cluster,
        bytes32 indexed networkId,
        uint256 commission,
        address rewardAddress,
        address clientKey
    );
    event CommissionUpdateRequested(address indexed cluster, uint256 commissionAfterUpdate, uint256 effectiveBlock);
    event CommissionUpdated(address indexed cluster, uint256 updatedCommission, uint256 updatedAt);
    event RewardAddressUpdated(address indexed cluster, address updatedRewardAddress);
    event NetworkSwitchRequested(address indexed cluster, bytes32 indexed networkId, uint256 effectiveBlock);
    event NetworkSwitched(address indexed cluster, bytes32 indexed networkId, uint256 updatedAt);
    event ClientKeyUpdated(address indexed cluster, address clientKey);
    event ClusterUnregisterRequested(address indexed cluster, uint256 effectiveBlock);
    event ClusterUnregistered(address indexed cluster, uint256 updatedAt);

    function register(
        bytes32 _networkId,
        uint256 _commission,
        address _rewardAddress,
        address _clientKey
    ) external {
        require(
            !isClusterValid(_msgSender()),
            "CR:R-Cluster is already registered"
        );
        require(_commission <= 100, "CR:R-Commission more than 100%");
        require(clientKeys[_clientKey] ==  address(0), "CR:R - Client key is already used");
        clusters[_msgSender()].commission = _commission;
        clusters[_msgSender()].rewardAddress = _rewardAddress;
        clusters[_msgSender()].clientKey = _clientKey;
        clusters[_msgSender()].networkId = _networkId;
        clusters[_msgSender()].status = Status.REGISTERED;

        clientKeys[_clientKey] = _msgSender();

        emit ClusterRegistered(_msgSender(), _networkId, _commission, _rewardAddress, _clientKey);
    }

    function updateCluster(uint256 _commission, bytes32 _networkId, address _rewardAddress, address _clientKey) public {
        if(_networkId != bytes32(0)) {
            switchNetwork(_networkId);
        }
        if(_rewardAddress != address(0)) {
            updateRewardAddress(_rewardAddress);
        }
        if(_clientKey != address(0)) {
            updateClientKey(_clientKey);
        }
        if(_commission != type(uint256).max) {
            updateCommission(_commission);
        }
    }

    function updateCommission(uint256 _commission) public {
        require(
            isClusterValid(_msgSender()),
            "CR:UCM-Cluster not registered"
        );
        require(_commission <= 100, "CR:UCM-Commission more than 100%");
        bytes32 lockId = keccak256(abi.encodePacked(COMMISSION_LOCK_SELECTOR, _msgSender()));
        uint256 unlockBlock = locks[lockId].unlockBlock;
        require(
            unlockBlock < block.timestamp,
            "CR:UCM-Commission update in progress"
        );
        if(unlockBlock != 0) {
            uint256 currentCommission = locks[lockId].iValue;
            clusters[_msgSender()].commission = currentCommission;
            emit CommissionUpdated(_msgSender(), currentCommission, unlockBlock);
        }
        uint256 updatedUnlockBlock = block.timestamp + lockWaitTime[COMMISSION_LOCK_SELECTOR];
        locks[lockId] = Lock(updatedUnlockBlock, _commission);
        emit CommissionUpdateRequested(_msgSender(), _commission, updatedUnlockBlock);
    }

    function switchNetwork(bytes32 _networkId) public {
        require(
            isClusterValid(_msgSender()),
            "CR:SN-Cluster not registered"
        );
        bytes32 lockId = keccak256(abi.encodePacked(SWITCH_NETWORK_LOCK_SELECTOR, _msgSender()));
        uint256 unlockBlock = locks[lockId].unlockBlock;
        require(
            unlockBlock < block.timestamp,
            "CR:SN-Network switch in progress"
        );
        if(unlockBlock != 0) {
            bytes32 currentNetwork = bytes32(locks[lockId].iValue);
            clusters[_msgSender()].networkId = currentNetwork;
            emit NetworkSwitched(_msgSender(), currentNetwork, unlockBlock);
        }
        uint256 updatedUnlockBlock = block.timestamp + lockWaitTime[SWITCH_NETWORK_LOCK_SELECTOR];
        locks[lockId] = Lock(updatedUnlockBlock, uint256(_networkId));
        emit NetworkSwitchRequested(_msgSender(), _networkId, updatedUnlockBlock);
    }

    function updateRewardAddress(address _rewardAddress) public {
        require(
            isClusterValid(_msgSender()),
            "CR:URA-Cluster not registered"
        );
        clusters[_msgSender()].rewardAddress = _rewardAddress;
        emit RewardAddressUpdated(_msgSender(), _rewardAddress);
    }

    function updateClientKey(address _clientKey) public {
        // TODO: Add delay to client key updates as well
        require(
            isClusterValid(_msgSender()),
            "CR:UCK-Cluster not registered"
        );
        require(clientKeys[_clientKey] ==  address(0), "CR:UCK - Client key is already used");
        delete clientKeys[clusters[_msgSender()].clientKey];
        clusters[_msgSender()].clientKey = _clientKey;
        clientKeys[_clientKey] = _msgSender();
        emit ClientKeyUpdated(_msgSender(), _clientKey);
    }

    function unregister() external {
        require(
            clusters[_msgSender()].status != Status.NOT_REGISTERED,
            "CR:UR-Cluster not registered"
        );
        bytes32 lockId = keccak256(abi.encodePacked(UNREGISTER_LOCK_SELECTOR, _msgSender()));
        uint256 unlockBlock = locks[lockId].unlockBlock;
        require(
            unlockBlock < block.timestamp,
            "CR:UR-Unregistration already in progress"
        );
        if(unlockBlock != 0) {
            clusters[_msgSender()].status = Status.NOT_REGISTERED;
            emit ClusterUnregistered(_msgSender(), unlockBlock);
            delete clientKeys[clusters[_msgSender()].clientKey];
            delete locks[lockId];
            delete locks[keccak256(abi.encodePacked(COMMISSION_LOCK_SELECTOR, _msgSender()))];
            delete locks[keccak256(abi.encodePacked(SWITCH_NETWORK_LOCK_SELECTOR, _msgSender()))];
            return;
        }
        uint256 updatedUnlockBlock = block.timestamp + lockWaitTime[UNREGISTER_LOCK_SELECTOR];
        locks[lockId] = Lock(updatedUnlockBlock, 0);
        emit ClusterUnregisterRequested(_msgSender(), updatedUnlockBlock);
    }

    function getCommission(address _cluster) public returns(uint256) {
        bytes32 lockId = keccak256(abi.encodePacked(COMMISSION_LOCK_SELECTOR, _cluster));
        uint256 unlockBlock = locks[lockId].unlockBlock;
        if(unlockBlock != 0 && unlockBlock < block.timestamp) {
            uint256 currentCommission = locks[lockId].iValue;
            clusters[_cluster].commission = currentCommission;
            emit CommissionUpdated(_cluster, currentCommission, unlockBlock);
            delete locks[lockId];
            return currentCommission;
        }
        return clusters[_cluster].commission;
    }

    function getNetwork(address _cluster) public returns(bytes32) {
        bytes32 lockId = keccak256(abi.encodePacked(SWITCH_NETWORK_LOCK_SELECTOR, _cluster));
        uint256 unlockBlock = locks[lockId].unlockBlock;
        if(unlockBlock != 0 && unlockBlock < block.timestamp) {
            bytes32 currentNetwork = bytes32(locks[lockId].iValue);
            clusters[_msgSender()].networkId = currentNetwork;
            emit NetworkSwitched(_msgSender(), currentNetwork, unlockBlock);
            delete locks[lockId];
            return currentNetwork;
        }
        return clusters[_cluster].networkId;
    }

    function getRewardAddress(address _cluster) external view returns(address) {
        return clusters[_cluster].rewardAddress;
    }

    function getClientKey(address _cluster) external view returns(address) {
        return clusters[_cluster].clientKey;
    }

    function getCluster(address _cluster) external returns(
        uint256 commission,
        address rewardAddress,
        address clientKey,
        bytes32 networkId,
        bool isValidCluster
    ) {
        return (
            getCommission(_cluster),
            clusters[_cluster].rewardAddress,
            clusters[_cluster].clientKey,
            getNetwork(_cluster),
            isClusterValid(_cluster)
        );
    }

    function getRewardInfo(address _cluster) external returns(uint256, address) {
        return (getCommission(_cluster), clusters[_cluster].rewardAddress);
    }

    function isClusterValid(address _cluster) public returns(bool) {
        bytes32 lockId = keccak256(abi.encodePacked(UNREGISTER_LOCK_SELECTOR, _cluster));
        uint256 unlockBlock = locks[lockId].unlockBlock;
        if(unlockBlock != 0 && unlockBlock < block.timestamp) {
            clusters[_cluster].status = Status.NOT_REGISTERED;
            delete clientKeys[clusters[_cluster].clientKey];
            emit ClusterUnregistered(_cluster, unlockBlock);
            delete locks[lockId];
            delete locks[keccak256(abi.encodePacked(COMMISSION_LOCK_SELECTOR, msg.sender))];
            delete locks[keccak256(abi.encodePacked(SWITCH_NETWORK_LOCK_SELECTOR, msg.sender))];
            return false;
        }
        return (clusters[_cluster].status != Status.NOT_REGISTERED);    // returns true if the status is registered
    }

//-------------------------------- Clusters end --------------------------------//
}

