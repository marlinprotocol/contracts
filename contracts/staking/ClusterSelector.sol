// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./tree/TreeUpgradeable.sol";


/// @title Contract to select the top 5 clusters in an epoch
contract ClusterSelector is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade,
    TreeUpgradeable // storage tree
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap_0;

    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice initializes the logic contract without any admins
    //          safeguard against takeover of the logic contract
    /// @dev startTime and epochLength should match the values in receiverStaking.
    ///     Inconsistent values in receiverStaking and clusterSelector can make data here invalid
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(uint256 _startTime, uint256 _epochLength) initializer {
        START_TIME = _startTime;
        EPOCH_LENGTH = _epochLength;
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

    function _authorizeUpgrade(address /*account*/) onlyRole(DEFAULT_ADMIN_ROLE) internal view override {}

    //-------------------------------- Overrides end --------------------------------//

    //-------------------------------- Constants start --------------------------------//

    /// @notice ID for update role
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    /// @notice ID for reward control
    bytes32 public constant REWARD_CONTROLLER_ROLE = keccak256("REWARD_CONTROLLER_ROLE");

    /// @notice Number of clusters selected in every epoch
    uint256 public constant NUMBER_OF_CLUSTERS_TO_SELECT = 5;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable START_TIME;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable EPOCH_LENGTH;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- Variables start --------------------------------//

    /// @notice clusters selected during each epoch
    mapping(uint256 => address[]) private clustersSelected;

    /// @notice Reward that the msg.sender recevies when cluster are selected for the epoch;
    uint256 public rewardForSelectingClusters;

    address __unused;

    uint256[46] private __gap_1;

    //-------------------------------- Variables end --------------------------------//

    //-------------------------------- Events start --------------------------------//

    /// @notice Event emitted when Cluster is selected
    /// @param epoch Number of Epoch
    /// @param cluster Address of cluster
    event ClusterSelected(uint256 indexed epoch, address indexed cluster);

    /// @notice Event emited when the reward is updated
    /// @param newReward New Reward For selecting the tokens
    event UpdateRewardForSelectingTheNodes(uint256 newReward);

    //-------------------------------- Events end --------------------------------//

    //-------------------------------- Init starts --------------------------------/

    function initialize(
        address _admin,
        address _updater,
        uint256 _rewardForSelectingClusters
    ) external initializer {
        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __TreeUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(REWARD_CONTROLLER_ROLE, _admin);
        _setupRole(UPDATER_ROLE, _updater);

        rewardForSelectingClusters = _rewardForSelectingClusters;
    }

    //-------------------------------- Init ends --------------------------------//

    //-------------------------------- Cluster Selection starts --------------------------------//

    function getCurrentEpoch() public view returns (uint256) {
        return (block.timestamp - START_TIME) / EPOCH_LENGTH + 1;
    }

    /// @notice If contract has sufficient balance, transfer it to given address
    /// @param _to Address to transfer tokens to
    function _dispenseReward(address _to) internal {
        uint256 _reward = rewardForSelectingClusters;
        if (_reward != 0 && address(this).balance >= _reward) {
            // Cluster selection goes through even if reward reverts
            payable(_to).send(_reward);
        }
    }

    function selectClusters() public returns (address[] memory _selectedClusters) {
        // select for next epoch
        uint256 _epoch = getCurrentEpoch() + 1;

        _selectedClusters = clustersSelected[_epoch];
        // can select till atleast one cluster is selected per epoch
        require(_selectedClusters.length == 0, "CS:SC-Already selected");

        // select and save from the tree
        uint256 _randomizer = uint256(keccak256(abi.encode(blockhash(block.number - 1), block.timestamp)));
        _selectedClusters = _selectN(_randomizer, NUMBER_OF_CLUSTERS_TO_SELECT);
        require(_selectedClusters.length != 0, "CS:SC-No cluster selected");
        clustersSelected[_epoch] = _selectedClusters;
        for (uint256 _index = 0; _index < _selectedClusters.length; _index++) {
            emit ClusterSelected(_epoch, _selectedClusters[_index]);
        }

        _dispenseReward(_msgSender());
    }

    /// @notice Updates the missing cluster in case epoch was not selected by anyone
    /// @notice The group of selected clusters will be selected again
    /// @param _epoch Epoch Number to fix the missing clusters
    function updateMissingClusters(uint256 _epoch) public {
        uint256 _currentEpoch = getCurrentEpoch();
        require(_epoch <= _currentEpoch, "cannot update future epochs");
        _updateMissingClusters(_epoch, _epoch);
    }

    /// @notice Internal function to Update the missing cluster in case epoch
    /// @param _searchEpoch Epoch Number to search for the missing clusters
    /// @param _writeEpoch Epoch Number to write the missing clusters
    function _updateMissingClusters(uint256 _searchEpoch, uint256 _writeEpoch) internal {
        if(_searchEpoch == 0) {
            return;
        }

        if (clustersSelected[_searchEpoch].length != 0) {
            clustersSelected[_writeEpoch] = clustersSelected[_searchEpoch];
        } else {
            _updateMissingClusters(_searchEpoch - 1, _writeEpoch);
        }
    }

    //-------------------------------- Cluster Selection ends --------------------------------//

    //-------------------------------- Tree interactions starts --------------------------------//

    function upsert(address newNode, uint64 balance) external onlyRole(UPDATER_ROLE) {
        _upsert(newNode, balance);
    }

    function upsertMultiple(address[] calldata newNodes, uint64[] calldata balances) external onlyRole(UPDATER_ROLE) {
        for(uint256 i=0; i < newNodes.length; i++) {
            _upsert(newNodes[i], balances[i]);
        }
    }

    function insert_unchecked(address newNode, uint64 balance) external onlyRole(UPDATER_ROLE) {
        _insert_unchecked(newNode, balance);
    }

    function insertMultiple_unchecked(address[] calldata newNodes, uint64[] calldata balances) external onlyRole(UPDATER_ROLE) {
        for(uint256 i=0; i < newNodes.length; i++) {
            _insert_unchecked(newNodes[i], balances[i]);
        }
    }

    function update_unchecked(address node, uint64 balance) external onlyRole(UPDATER_ROLE) {
        _update_unchecked(node, balance);
    }

    function delete_unchecked(address node) external onlyRole(UPDATER_ROLE) {
        _delete_unchecked(node, addressToIndexMap[node]);
    }

    function deleteIfPresent(address node) external onlyRole(UPDATER_ROLE) {
        _deleteIfPresent(node);
    }

    //-------------------------------- Tree interactions ends --------------------------------//

    //-------------------------------- Admin functions starts --------------------------------//

    /// @notice Updates the reward amount for selecting clusters
    /// @param _reward Amount of reward for selecting clusters
    function updateRewardForSelection(uint256 _reward) external onlyRole(REWARD_CONTROLLER_ROLE) {
        require(_reward != rewardForSelectingClusters, "Update reward");
        rewardForSelectingClusters = _reward;
        emit UpdateRewardForSelectingTheNodes(_reward);
    }

    /// @notice Flush reward to address. Can be only called by REWARD_CONTROLLER
    /// @param to Address to transfer to
    function flushReward(address to) external onlyRole(REWARD_CONTROLLER_ROLE) {
        (bool success, ) = payable(to).call{value: address(this).balance}("");
        require(success, "CS:FR-Flushing reward failed");
    }

    //-------------------------------- Admin functions ends --------------------------------//

    function getClusters(uint256 epochNumber) public view returns (address[] memory) {
        uint256 _nextEpoch = getCurrentEpoch() + 1;
        // To ensure invalid data is not provided for epochs where clusters are not selected
        require(epochNumber <= _nextEpoch, Errors.CLUSTER_SELECTION_NOT_COMPLETE);
        if (epochNumber <= 1) {
            return new address[](0);
        }
        address[] memory clusters = clustersSelected[epochNumber];

        if (clusters.length == 0) {
            require(epochNumber != _nextEpoch, Errors.CLUSTER_SELECTION_NOT_COMPLETE);
            return getClusters(epochNumber - 1);
        } else {
            return clusters;
        }
    }

    receive() external payable {}
}
