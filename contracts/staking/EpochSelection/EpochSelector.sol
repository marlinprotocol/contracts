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
import "./TreeUpgradeable.sol";
import "../interfaces/IEpochSelector.sol";

/// @title Contract to select the top 5 clusters in an epoch
contract EpochSelectorUpgradeable is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade,
    TreeUpgradeable, // storage tree
    IEpochSelector // interface
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    //-------------------------------- Constants start --------------------------------//

    /// @notice ID for update role
    bytes32 public constant UPDATER_ROLE = keccak256(abi.encode("updater"));

    /// @notice ID for admin role
    bytes32 public constant ADMIN_ROLE = keccak256(abi.encode("admin"));

    /// @notice ID for reward control
    bytes32 public constant REWARD_CONTROLLER_ROLE = keccak256(abi.encode("reward-control"));

    /// @notice timestamp when the selector starts
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable override START_TIME;

    /// @notice length of epoch
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable override EPOCH_LENGTH;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- Variables start --------------------------------//

    /// @notice Number of clusters selected in every epoch
    uint256 public numberOfClustersToSelect;

    /// @notice clusters selected during each epoch
    mapping(uint256 => address[]) private clustersSelected;

    /// @notice Reward that the msg.sender recevies when cluster are selected for the epoch;
    uint256 public rewardForSelectingClusters;

    /// @notice Reward Token
    address public rewardToken;

    //-------------------------------- Variables end --------------------------------//

    //-------------------------------- Events start --------------------------------//

    /// @notice Event emitted when Cluster is selected
    /// @param epoch Number of Epoch
    /// @param cluster Address of cluster
    event ClusterSelected(uint256 indexed epoch, address indexed cluster);

    /// @notice Event emited when the number of clusters to select is updated
    /// @param newNumberOfClusters New number of clusters selected
    event UpdateNumberOfClustersToSelect(uint256 newNumberOfClusters);

    /// @notice Event emited when the reward is updated
    /// @param newReward New Reward For selecting the tokens
    event UpdateRewardForSelectingTheNodes(uint256 newReward);

    /// @notice Event emited when the reward token is emitted
    /// @param _newRewardToken Address of the new reward token
    event UpdateRewardToken(address _newRewardToken);

    //-------------------------------- Events end --------------------------------//

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

    function _authorizeUpgrade(address /*account*/) onlyRole(ADMIN_ROLE) internal view override {}

    //-------------------------------- Overrides end --------------------------------//

    //-------------------------------- Init starts --------------------------------/

    /// @notice initializes the logic contract without any admins
    //          safeguard against takeover of the logic contract
    /// @dev startTime and epochLength should match the values in receiverStaking. 
    ///     Inconsistent values in receiverStaking and epochSelector can make data here invalid
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(uint256 _startTime, uint256 _epochLength) initializer {
        START_TIME = _startTime;
        EPOCH_LENGTH = _epochLength;
    }

    function initialize(
        address _admin,
        uint256 _numberOfClustersToSelect,
        address _rewardToken,
        uint256 _rewardForSelectingClusters
    ) external initializer {

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __TreeUpgradeable_init_unchained();

        numberOfClustersToSelect = _numberOfClustersToSelect;

        _setRoleAdmin(REWARD_CONTROLLER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(UPDATER_ROLE, ADMIN_ROLE);
        _grantRole(REWARD_CONTROLLER_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);

        rewardToken = _rewardToken;
        rewardForSelectingClusters = _rewardForSelectingClusters;
    }

    //-------------------------------- Init ends --------------------------------//

    //-------------------------------- Cluster Selection starts --------------------------------//

    /// @notice Current Epoch
    function getCurrentEpoch() public view override returns (uint256) {
        return (block.timestamp - START_TIME) / EPOCH_LENGTH;
    }

    /// @notice Returns the list of selected clusters for the next
    /// @return selectedClusters List of the clusters selected
    function selectClusters() public override returns (address[] memory selectedClusters) {
        uint256 nextEpoch = getCurrentEpoch() + 1;
        selectedClusters = clustersSelected[nextEpoch];

        if (selectedClusters.length == 0) {
            // select and save from the tree
            uint256 randomizer = uint256(keccak256(abi.encode(blockhash(block.number - 1), block.timestamp)));
            selectedClusters = _selectN(randomizer, numberOfClustersToSelect);
            clustersSelected[nextEpoch] = selectedClusters;
            for (uint256 index = 0; index < selectedClusters.length; index++) {
                emit ClusterSelected(nextEpoch, selectedClusters[index]);
            }

            _dispenseReward(msg.sender);
        }
    }

    /// @notice Updates the missing cluster in case epoch was not selected by anyone
    /// @notice The group of selected clusters will be selected again
    /// @param anyPreviousEpochNumber Epoch Number to fix the missing clusters
    function updateMissingClusters(uint256 anyPreviousEpochNumber) public returns (address[] memory previousSelectedClusters) {
        uint256 currentEpoch = getCurrentEpoch();
        require(anyPreviousEpochNumber < currentEpoch, "Can't update current or more epochs");
        return _updateMissingClusters(anyPreviousEpochNumber);
    }

    /// @notice Internal function to Update the missing cluster in case epoch
    /// @param anyPreviousEpochNumber Epoch Number to fix the missing clusters
    function _updateMissingClusters(uint256 anyPreviousEpochNumber) internal returns (address[] memory previousSelectedClusters) {
        if (anyPreviousEpochNumber == 0) {
            return previousSelectedClusters;
        }

        address[] memory clusters = clustersSelected[anyPreviousEpochNumber];
        if (clusters.length == 0) {
            clusters = _updateMissingClusters(anyPreviousEpochNumber - 1);
            clustersSelected[anyPreviousEpochNumber] = clusters;
        } else {
            return clusters;
        }
    }

    //-------------------------------- Cluster Selection ends --------------------------------//

    //-------------------------------- Tree interactions starts --------------------------------//

    function upsert(address newNode, uint64 balance) external override onlyRole(UPDATER_ROLE) {
        _upsert(newNode, balance);
    }

    function upsertMultiple(address[] calldata newNodes, uint64[] calldata balances) external override onlyRole(UPDATER_ROLE) {
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

    function update_unchecked(address node, uint64 balance) external override onlyRole(UPDATER_ROLE) {
        _update_unchecked(node, balance);
    }

    function delete_unchecked(address node) external override onlyRole(UPDATER_ROLE) {
        _delete_unchecked(node, addressToIndexMap[node]);
    }

    function deleteIfPresent(address node) external override onlyRole(UPDATER_ROLE) {
        _deleteIfPresent(node);
    }

    //-------------------------------- Tree interactions ends --------------------------------//

    //-------------------------------- Admin functions starts --------------------------------//

    /// @inheritdoc IEpochSelector
    function updateNumberOfClustersToSelect(uint256 _numberOfClusters) external override onlyRole(ADMIN_ROLE) {
        require(_numberOfClusters != 0 && numberOfClustersToSelect != _numberOfClusters, "Should be a valid number");
        numberOfClustersToSelect = _numberOfClusters;
        emit UpdateNumberOfClustersToSelect(_numberOfClusters);
    }

    /// @notice Updates the reward token
    /// @param _rewardToken Address of the reward token
    function updateRewardToken(address _rewardToken) external onlyRole(REWARD_CONTROLLER_ROLE) {
        require(_rewardToken == rewardToken, "Update reward token");
        rewardToken = _rewardToken;
        emit UpdateRewardToken(_rewardToken);
    }

    function _dispenseReward(address _to) internal {
        if (rewardForSelectingClusters != 0) {
            IERC20Upgradeable _rewardToken = IERC20Upgradeable(rewardToken);
            if (_rewardToken.balanceOf(address(this)) >= rewardForSelectingClusters) {
                _rewardToken.safeTransfer(_to, rewardForSelectingClusters);
            }
        }
    }

    function flushTokens(address token, address to) external onlyRole(REWARD_CONTROLLER_ROLE) {
        IERC20Upgradeable _token = IERC20Upgradeable(token);

        uint256 remaining = _token.balanceOf(address(this));
        if (remaining > 0) {
            _token.safeTransfer(to, remaining);
        }
    }

    //-------------------------------- Admin functions ends --------------------------------//

    // @dev Clusters are selected only for next epoch in this epoch using selectClusters method.
    //      If the method is not called within the previous epoch, then the last selected clusters
    //      are considered as selected for this epoch
    function getClusters(uint256 epochNumber) public override view returns (address[] memory) {
        uint256 _nextEpoch = getCurrentEpoch() + 1;
        // To ensure invalid data is not provided for epochs where clusters are not selected
        require(epochNumber <= _nextEpoch, Errors.CLUSTER_SELECTION_NOT_COMPLETE);
        if (epochNumber == 0) {
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
}
