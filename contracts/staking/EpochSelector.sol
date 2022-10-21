// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IEpochSelector.sol";
import "./ClusterSelector_wih_abi_encode.sol";

/// @title Contract to select the top 5 clusters in an epoch
contract EpochSelector is AccessControl, ClusterSelector, IEpochSelector {

    using SafeERC20 for IERC20;

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

    /// @notice length of epoch
    uint256 public constant epochLength = 4 hours;

    /// @notice timestamp when the selector starts
    uint256 public immutable startTime;

    /// @notice Number of clusters selected in every epoch
    uint256 public numberOfClustersToSelect;

    /// @notice clusters selected during each epoch
    mapping(uint256 => address[]) public clustersSelected;

    /// @notice ID for update role
    bytes32 public constant updaterRole = keccak256(abi.encode("updater")); // find standard format for this

    /// @notice ID for admin role
    bytes32 public constant adminRole = keccak256(abi.encode("admin")); // find standard format for this

    /// @notice ID for reward control
    bytes32 public constant rewardControllerRole = keccak256(abi.encode("reward-control")); // find standard format for this

    /// @notice Reward that the msg.sender recevies when cluster are selected for the epoch;
    uint256 public rewardForSelectingClusters = 100 * 10**18; 

    /// @notice Reward Token
    address public rewardToken;
    
    constructor(address _admin, uint256 _numberOfClustersToSelect, uint256 _startTime, address _rewardToken) ClusterSelector() {
        startTime = _startTime;
        numberOfClustersToSelect = _numberOfClustersToSelect;
        
        AccessControl._setRoleAdmin(updaterRole, adminRole);
        AccessControl._setRoleAdmin(rewardControllerRole, adminRole);

        AccessControl._grantRole(adminRole, _admin);
        AccessControl._grantRole(rewardControllerRole, _admin);

        rewardToken = _rewardToken;
    }



    /// @notice Current Epoch
    function getCurrentEpoch() public view override returns (uint256) {
        return (block.timestamp - startTime) / epochLength;
    }

    /// @notice Returns the list of selected clusters for the next coming epoch
    /// @return List of the clusters selected
    function selectClusters() public override returns (address[] memory) {
        uint256 nextEpoch = getCurrentEpoch() + 1;
        address[] memory nodes = clustersSelected[nextEpoch];
        if (nodes.length == 0) {
            // select and save from the tree
            clustersSelected[nextEpoch] = selectTopNClusters(uint256(blockhash(block.number)), numberOfClustersToSelect);
            nodes = clustersSelected[nextEpoch];
            for (uint256 index = 0; index < nodes.length; index++) {
                emit ClusterSelected(nextEpoch, nodes[index]);
            }

            _dispenseReward(msg.sender);
        }
        return nodes;
    }

    /// @notice Updates the missing cluster in case epoch was not selected by anyone
    /// @notice The group of selected clusters will be selected again
    /// @param anyPreviousEpochNumber Epoch Number to fix the missing clusters
    function updateMissingClusters(uint256 anyPreviousEpochNumber) public returns(address[] memory previousSelectedClusters){
        uint256 currentEpoch = getCurrentEpoch();
        require(anyPreviousEpochNumber < currentEpoch, "Can't update current or more epochs");
        return _updateMissingClusters(anyPreviousEpochNumber);
    }

    /// @notice Internal function to Update the missing cluster in case epoch
    /// @param anyPreviousEpochNumber Epoch Number to fix the missing clusters
    function _updateMissingClusters(uint256 anyPreviousEpochNumber) internal returns(address[] memory previousSelectedClusters){
        if(anyPreviousEpochNumber == 0){
            return previousSelectedClusters;
        }

        address[] memory clusters =  clustersSelected[anyPreviousEpochNumber];
        if(clusters.length == 0){
            clusters = _updateMissingClusters(anyPreviousEpochNumber - 1);
            clustersSelected[anyPreviousEpochNumber] = clusters;
        }else{
            return clusters;
        }
    }

    /// @inheritdoc IClusterSelector
    function insert(address newNode, uint96 balance) public override(IClusterSelector, SingleSelector) onlyRole(updaterRole) {
        require(newNode != address(0), "address(0) not permitted into entry");
        Node memory node = nodes[newNode];
        if (node.node == address(0)) {
            root = _insert(root, newNode, balance);
            totalElements++;
        } else {
            // int256 differenceInKeyBalance = int256(clusterBalance) - int256(node.balance);
            _update(root, newNode, int96(balance) - int96(node.balance));
        }
    }

    /// @inheritdoc IClusterSelector
    function deleteNode(address key) public override(IClusterSelector, SingleSelector) onlyRole(updaterRole) { 
        require(deleteNodeIfPresent(key), ClusterLib.NODE_NOT_PRESENT_IN_THE_TREE);
    }

    /// @inheritdoc IEpochSelector
    function deleteNodeIfPresent(address key) public override onlyRole(updaterRole) returns (bool) {
        require(key != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[key];
        if (node.node == key) {
            // delete node
            (root) = _deleteNode(root, key, node.balance);
            totalElements--;
            return true;
        }
        return false;
    }

    /// @inheritdoc IClusterSelector
    function update(address existingNode, uint96 newBalance) public override(IClusterSelector, SingleSelector) onlyRole(updaterRole) {
        require(existingNode != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        assert(nodes[existingNode].node == existingNode);
        int96 differenceInKeyBalance = int96(newBalance) - int96(nodes[existingNode].balance);
        _update(root, existingNode, differenceInKeyBalance);
    }

    /// @inheritdoc IEpochSelector
    function updateNumberOfClustersToSelect(uint256 _numberOfClusters) external onlyRole(updaterRole) {
        require(_numberOfClusters!= 0 && numberOfClustersToSelect != _numberOfClusters, "Should be a valid number");
        numberOfClustersToSelect = _numberOfClusters;
        emit UpdateNumberOfClustersToSelect(_numberOfClusters);
    }

    /// @notice Updates the reward token
    /// @param _rewardToken Address of the reward token
    function updateRewardToken(address _rewardToken) external onlyRole(adminRole) {
        require(_rewardToken == rewardToken, "Update reward token");
        rewardToken = _rewardToken;
        emit UpdateRewardToken(_rewardToken);
    }

    function _dispenseReward(address _to) internal {
        IERC20 _rewardToken = IERC20(rewardToken);
        if(_rewardToken.balanceOf(address(this)) >=  rewardForSelectingClusters) {
            _rewardToken.safeTransfer(_to, rewardForSelectingClusters);
        }
    }

    function flushTokens(address token, address to) external onlyRole(adminRole) {
        IERC20 _token = IERC20(token);
        
        uint256 remaining = _token.balanceOf(address(this));
        if(remaining >0){
            _token.safeTransfer(to, remaining);
        }
    }
}
