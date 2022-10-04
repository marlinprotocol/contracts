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

    /// @notice length of epoch
    uint256 public constant epochLength = 4 hours;

    /// @notice timestamp when the selector starts
    uint256 public immutable startTime;

    /// @notice Number of clusters selected in every epoch
    uint256 public immutable numberOfClustersToSelect;

    /// @notice clusters selected during each epoch
    mapping(uint256 => address[]) public clustersSelected;

    /// @notice ID for update role
    bytes32 public constant updaterRole = keccak256(abi.encode("updater")); // find standard format for this

    /// @notice ID for updater admin role
    bytes32 public constant updaterAdminRole = keccak256(abi.encode("updater admin")); // find standard format for this

    constructor(address _admin, uint256 _numberOfClustersToSelect) ClusterSelector() {
        startTime = block.timestamp;
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
            clustersSelected[epoch] = selectTopNClusters(block.timestamp, numberOfClustersToSelect);
            nodes = clustersSelected[epoch];
            for (uint256 index = 0; index < nodes.length; index++) {
                emit ClusterSelected(epoch, nodes[index]);
            }
        }
        return nodes;
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
        require(key != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[key];
        require(node.node == key, ClusterLib.NODE_NOT_PRESENT_IN_THE_TREE);
        if (node.node == key) {
            // delete node
            (root) = _deleteNode(root, key, node.balance);
            totalElements--;
        }
    }

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
}
