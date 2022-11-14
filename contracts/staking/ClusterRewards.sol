// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/IEpochSelector.sol";
import "./interfaces/IReceiverStaking.sol";
import "./interfaces/IClusterRewards.sol";


contract ClusterRewards is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade
    IClusterRewards  // interface
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
        address _admin,
        address _claimer,
        address _receiverStaking,
        address _epochSelector,
        bytes32[] memory _networkIds,
        uint256[] memory _rewardWeight,
        uint256 _totalRewardsPerEpoch
    )
        public
        initializer
    {
        require(
            _networkIds.length == _rewardWeight.length,
            "CRW:I-Each NetworkId need a corresponding RewardPerEpoch and vice versa"
        );

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);

        _setupRole(CLAIMER_ROLE, _claimer);

        uint256 _weight = 0;
        for(uint256 i=0; i < _networkIds.length; i++) {
            rewardWeight[_networkIds[i]] = _rewardWeight[i];
            _weight += _rewardWeight[i];
            emit NetworkAdded(_networkIds[i], _rewardWeight[i]);
        }
        totalWeight = _weight;
        _changeRewardPerEpoch(_totalRewardsPerEpoch);

        _updateEpochSelector(_epochSelector);
        _updateReceiverStaking(_receiverStaking);
    }

//-------------------------------- Initializer end --------------------------------//

//-------------------------------- Admin functions start --------------------------------//

    bytes32 public constant CLAIMER_ROLE = keccak256("CLAIMER_ROLE");
    uint256 public constant RECEIVER_TICKETS_PER_EPOCH = 1e18;

    mapping(address => uint256) public clusterRewards;

    mapping(bytes32 => uint256) public rewardWeight;
    uint256 public totalWeight;
    uint256 public totalRewardsPerEpoch;
    uint256 public __unused_1;

    mapping(uint256 => uint256) public __unused_2;
    uint256 public __unused_3;
    uint256 public __unused_4;

    mapping(address => mapping(uint256 => uint256)) public ticketsIssued;
    IReceiverStaking public receiverStaking;
    IEpochSelector public epochSelector;

    event NetworkAdded(bytes32 networkId, uint256 rewardPerEpoch);
    event NetworkRemoved(bytes32 networkId);
    event NetworkRewardUpdated(bytes32 networkId, uint256 updatedRewardPerEpoch);
    event ReceiverStakingUpdated(address receiverStaking);
    event EpochSelectorUpdated(address epochSelector);
    event RewardPerEpochChanged(uint256 updatedRewardPerEpoch);
    event TicketsIssued(bytes32 indexed networkId, uint256 indexed epoch, address indexed user);

    modifier onlyClaimer() {
        require(hasRole(CLAIMER_ROLE, _msgSender()), "only claimer");
        _;
    }

    function addNetwork(bytes32 _networkId, uint256 _rewardWeight) external onlyAdmin {
        require(rewardWeight[_networkId] == 0, "CRW:AN-Network already exists");
        require(_rewardWeight != 0, "CRW:AN-Reward cant be 0");
        rewardWeight[_networkId] = _rewardWeight;
        totalWeight += _rewardWeight;
        emit NetworkAdded(_networkId, _rewardWeight);
    }

    function removeNetwork(bytes32 _networkId) external onlyAdmin {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "CRW:RN-Network doesnt exist");
        delete rewardWeight[_networkId];
        totalWeight -= networkWeight;
        emit NetworkRemoved(_networkId);
    }

    function changeNetworkReward(bytes32 _networkId, uint256 _updatedRewardWeight) external onlyAdmin {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "CRW:CNR-Network doesnt exist");
        require(_updatedRewardWeight != 0, "CRW:CNR-Reward cant be 0");
        rewardWeight[_networkId] = _updatedRewardWeight;
        totalWeight = totalWeight - networkWeight + _updatedRewardWeight;
        emit NetworkRewardUpdated(_networkId, _updatedRewardWeight);
    }

    function updateReceiverStaking(address _receiverStaking) external onlyAdmin {
        _updateReceiverStaking(_receiverStaking);
    }

    function _updateReceiverStaking(address _receiverStaking) internal {
        receiverStaking = IReceiverStaking(_receiverStaking);
        emit ReceiverStakingUpdated(_receiverStaking);
    }

    function updateEpochSelector(address _epochSelector) external onlyAdmin {
        _updateEpochSelector(_epochSelector);
    }

    function _updateEpochSelector(address _epochSelector) internal {
        epochSelector = IEpochSelector(_epochSelector);
        emit EpochSelectorUpdated(_epochSelector);
    }

    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) external onlyAdmin {
        _changeRewardPerEpoch(_updatedRewardPerEpoch);
    }

    function _changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) internal {
        totalRewardsPerEpoch = _updatedRewardPerEpoch;
        emit RewardPerEpochChanged(_updatedRewardPerEpoch);
    }

//-------------------------------- Admin functions end --------------------------------//

//-------------------------------- User functions start --------------------------------//

    function issueTickets(bytes32 _networkId, uint256[] memory _epoch, address[][] memory _clusters, uint256[][] memory _tickets) external {
        uint256 numberOfEpochs = _epoch.length;
        require(numberOfEpochs == _tickets.length, "CRW:MIT-invalid inputs");
        require(numberOfEpochs == _clusters.length, "CRW:MIT-invalid inputs");
        for(uint256 i=0; i < numberOfEpochs; i++) {
            issueTickets(_networkId, _epoch[i], _clusters[i], _tickets[i]);
        }
    }

    function issueTickets(bytes32 _networkId, uint256 _epoch, address[] memory _clusters, uint256[] memory _tickets) public {
        require(_clusters.length == _tickets.length, "CRW:IT-invalid inputs");

        (uint256 _epochReceiverStake, uint256 _epochTotalStake, uint256 _currentEpoch) = receiverStaking.getStakeInfo(msg.sender, _epoch);

        require(_epoch < _currentEpoch, "CRW:IT-Epoch not completed");
        require(_epochReceiverStake != 0, "CRW:IT-Not eligible to issue tickets");

        address[] memory _selectedClusters = epochSelector.getClusters(_epoch);

        uint256 _epochTicketsIssued = ticketsIssued[msg.sender][_epoch];
        uint256 _totalNetworkRewardsPerEpoch = getRewardPerEpoch(_networkId);

        for(uint256 i=0; i < _clusters.length; i++) {
            require(ifArrayHasElement(_selectedClusters, _clusters[i]), "Invalid cluster to issue ticket");
            clusterRewards[_clusters[i]] += _totalNetworkRewardsPerEpoch * _tickets[i] * _epochReceiverStake / _epochTotalStake / RECEIVER_TICKETS_PER_EPOCH;

            _epochTicketsIssued += _tickets[i];
        }

        require(_epochTicketsIssued <= RECEIVER_TICKETS_PER_EPOCH, "CRW:IT-Excessive tickets issued");
        ticketsIssued[msg.sender][_epoch] = _epochTicketsIssued;

        emit TicketsIssued(_networkId, _epoch, msg.sender);
    }

    function claimReward(address _cluster) external onlyRole(CLAIMER_ROLE) returns(uint256) {
        uint256 pendingRewards = clusterRewards[_cluster];
        if(pendingRewards > 1) {
            uint256 rewardsToTransfer = pendingRewards - 1;
            clusterRewards[_cluster] = 1;
            return rewardsToTransfer;
        }
        return 0;
    }

    function getRewardPerEpoch(bytes32 _networkId) public view returns(uint256) {
        return (totalRewardsPerEpoch * rewardWeight[_networkId]) / totalWeight;
    }

//-------------------------------- User functions end --------------------------------//

    /// @notice Checks if the array has an element in it
    /// @param array Array to check
    /// @param element Element to check in the array
    function ifArrayHasElement(address[] memory array, address element) internal pure returns (bool) {
        for (uint256 index = 0; index < array.length; index++) {
            if (element == array[index]) {
                return true;
            }
        }
        return false;
    }
}
