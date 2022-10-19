// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IEpochSelector.sol";
import "./ClusterSelector_wih_abi_encode.sol";

/// @title Contract to select the top 5 clusters in an epoch
contract EpochSelector is AccessControl, ClusterSelector, IEpochSelector {
    /// @notice Event emitted when Cluster is selected
    /// @param epoch Number of Epoch
    /// @param cluster Address of cluster
    event ClusterSelected(uint256 indexed epoch, address indexed cluster);

    /// @notice Event emited when the number of clusters to select is updated
    /// @param epoch epoch number when this happens
    /// @param oldNumberOfClusters Previous number of clusters selected
    /// @param newNumberOfClusters New number of clusters selected
    event UpdateNumberOfClustersToSelect(uint256 indexed epoch, uint256 oldNumberOfClusters, uint256 newNumberOfClusters);

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

    /// @notice ID for updater admin role
    bytes32 public constant updaterAdminRole = keccak256(abi.encode("updater admin")); // find standard format for this

    constructor(address _admin, uint256 _numberOfClustersToSelect, uint256 _startTime) ClusterSelector() {
        startTime = _startTime;
        numberOfClustersToSelect = _numberOfClustersToSelect;
        AccessControl._setRoleAdmin(updaterRole, updaterAdminRole);
        AccessControl._grantRole(updaterAdminRole, _admin);
    }



    /// @notice Current Epoch
    function getCurrentEpoch() public view override returns (uint256) {
        return (block.timestamp - startTime) / epochLength;
    }

    /// @notice Returns the list of selected clusters in the current epoch
    /// @return List of the clusters selected
    function getCurrentClusters() public override returns (address[] memory) {
        uint256 epoch = getCurrentEpoch();
        address[] memory nodes = clustersSelected[epoch];
        if (nodes.length == 0) {
            // select and save from the tree
            clustersSelected[epoch] = selectTopNClusters(uint256(blockhash(block.number)), numberOfClustersToSelect);
            nodes = clustersSelected[epoch];
            for (uint256 index = 0; index < nodes.length; index++) {
                emit ClusterSelected(epoch, nodes[index]);
            }
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
        if (nodes[existingNode].node == address(0)) {
            assert(false);
        } else {
            int96 differenceInKeyBalance = int96(newBalance) - int96(nodes[existingNode].balance);
            _update(root, existingNode, differenceInKeyBalance);
        }
    }

    /// @inheritdoc IEpochSelector
    function updateNumberOfClustersToSelect(uint256 _numberOfClusters) external onlyRole(updaterRole) {
        uint256 oldNumberOfClusters = numberOfClustersToSelect;
        require(_numberOfClusters!= 0 && oldNumberOfClusters != _numberOfClusters, "Should be a valid number");
        uint256 currentEpoch = getCurrentEpoch();
        numberOfClustersToSelect = _numberOfClusters;

        emit UpdateNumberOfClustersToSelect(currentEpoch, oldNumberOfClusters, _numberOfClusters);

    }
}
