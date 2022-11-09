// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./ClusterLib.sol";
import "../interfaces/IClusterSelector.sol";

// import "forge-std/console2.sol";

abstract contract SelectorHelper is IClusterSelector {
    uint32 public idCounters;
    uint32[] public emptyIds;

    mapping(address => uint32) public addressToIndexMap;
    mapping(uint32 => address) public indexToAddressMap;

    /// @notice List of all nodes
    mapping(uint32 => Node) nodes;

    /// @notice Total number of all nodes in the tree
    uint256 public totalElements;

    /// @notice Address of the current root
    uint32 public root;

    /// @notice Height of the tree at a given moment
    /// @return Height of the tree
    function heightOfTheTree() public view returns (uint256) {
        return height(root);
    }

    /// @notice Height of any node at a given moment
    /// @param node Address of the node whose height needs to be searched
    /// @return Height of the node
    function height(uint32 node) public view returns (uint32) {
        if (node == 0) return 0;
        return nodes[node].height;
    }

    /// @notice Function to create a empty node
    /// @param node Address of the new node
    /// @param balance Balance of the new node
    /// @return newNode Empty node with address and balance
    function _newNode(uint32 node, uint32 balance) internal pure returns (Node memory newNode) {
        newNode = Node(node, balance, 0, 0, 1, 0, 0);
    }

    /// @notice Right rotate a given node
    /// @param addressOfZ address of the node to right rotate
    /// @return Returns the new root after the rotation
    /// @notice ----------------------------- z -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- y     T4 -------------------------
    /// @notice ------------------------- / \        ------------------------
    /// @notice ------------------------ x   T3       -----------------------
    /// @notice ----------------------- / \            ----------------------
    /// @notice ---------------------- T1  T2            --------------------
    /// @notice is rotated to
    /// @notice ----------------------------- y -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- x     z --------------------------
    /// @notice ------------------------- / \   / \ -------------------------
    /// @notice ------------------------ T1 T2 T3 T4 ------------------------
    function _rightRotate(uint32 addressOfZ) internal returns (uint32) {
        if (addressOfZ == 0) {
            revert(ClusterLib.CANNOT_RR_ADDRESS_ZERO);
        }
        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.left];

        // do not rotate if left is 0
        if (y.node == 0) {
            // console2.log("RR: not because y is 0 ");
            return z.node;
        }
        Node memory T3 = nodes[y.right];

        // cut z.left
        z.sumOfLeftBalances = _getTotalBalancesIncludingWeight(T3);
        z.left = T3.node;
        // cut y.right
        y.sumOfRightBalances = _getTotalBalancesIncludingWeight(z);
        y.right = z.node;

        z.height = uint8(calculateUpdatedHeight(z));
        y.height = uint8(calculateUpdatedHeight(y));
        return y.node;
    }

    /// @notice Lef rotate a given node
    /// @param addressOfZ address of the node to left rotate
    /// @return Returns the new root after the rotation
    /// @notice ----------------------------- z -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- T1    y --------------------------
    /// @notice -------------------------       / \ -------------------------
    /// @notice ------------------------      T2   x ------------------------
    /// @notice -----------------------           / \ -----------------------
    /// @notice ----------------------           T3  T4 ---------------------
    /// @notice is rotated to
    /// @notice ----------------------------- y -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- z     x --------------------------
    /// @notice ------------------------- / \   / \ -------------------------
    /// @notice ------------------------ T1 T2 T3 T4 ------------------------
    function _leftRotate(uint32 addressOfZ) internal returns (uint32) {
        if (addressOfZ == 0) {
            revert(ClusterLib.CANNOT_LR_ADDRESS_ZERO);
        }
        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.right];

        // do not rotate if right is 0
        if (y.node == 0) {
            // console2.log("LR: not because y is 0 ");
            return z.node;
        }
        Node memory T2 = nodes[y.left];

        // cut z.right
        z.sumOfRightBalances = _getTotalBalancesIncludingWeight(T2);
        z.right = T2.node;
        // cut y.left
        y.sumOfLeftBalances = _getTotalBalancesIncludingWeight(z);
        y.left = z.node;

        z.height = uint8(calculateUpdatedHeight(z));
        y.height = uint8(calculateUpdatedHeight(y));
        return y.node;
    }

    /// @notice Returns the (node balance) i.e difference in heights of left and right nodes
    /// @param node Address of the node to get height difference of
    /// @return Height Difference of the node
    function getHeightDifference(uint32 node) public view returns (int32) {
        if (node == 0) return 0;

        Node memory existingNode = nodes[node];

        return int32(height(existingNode.left)) - int32(height(existingNode.right));
    }

    /// @notice Returns the data of the node
    /// @param _node Address of the node
    /// @return node Data of the node
    function nodeData(uint32 _node) public view returns (Node memory node) {
        node = nodes[_node];
    }

    /// @notice Get total weight of the node
    /// @param node Node to calculate total weight for
    /// @return Total weight of the node
    function _getTotalBalancesIncludingWeight(Node memory node) internal pure returns (uint32) {
        return node.balance + node.sumOfLeftBalances + node.sumOfRightBalances;
    }

    function calculateUpdatedHeight(Node memory node) internal view returns (uint256) {
        return Math.max(height(node.right), height(node.left)) + 1;
    }

    // optimise this whole function
    function getNewId() internal returns (uint32) {
        if (emptyIds.length > 0) {
            uint32 id = emptyIds[emptyIds.length - 1];
            emptyIds.pop();
            return id;
        } else {
            uint32 id = ++idCounters;
            return id;
        }
    }

    // function _printNode(address _node) internal view {
    //     Node memory node = nodes[_node];
    //     console2.log("************************************");
    //     console2.log("cluster", node.node);
    //     console2.log("balance", node.balance);
    //     console2.log("left", node.left);
    //     console2.log("right", node.right);
    //     console2.log("sumOfLeftBalances", node.sumOfLeftBalances);
    //     console2.log("sumOfRightBalances", node.sumOfRightBalances);
    //     console2.log(" height", node.height);
    //     console2.log("************************************");
    // }

    // function _printArray(string memory data, bytes memory arrayBytes) internal view {
    //     console2.log(data);
    //     address[] memory array = abi.decode(arrayBytes, (address[]));
    //     console2.log("[");
    //     for (uint256 index = 0; index < array.length; index++) {
    //         console2.log(index, array[index]);
    //     }
    //     console2.log("]");
    // }

    // function _printArray(string memory data, address[] memory array) internal view {
    //     console2.log(data);
    //     console2.log("[");
    //     for (uint256 index = 0; index < array.length; index++) {
    //         console2.log(index, array[index]);
    //     }
    //     console2.log("]");
    // }

    // function _printPaths(string memory data, bytes[] memory bytesdata) internal view {
    //     console2.log(data);

    //     console2.log("[");
    //     for (uint256 index = 0; index < bytesdata.length; index++) {
    //         address[] memory _paths = abi.decode(bytesdata[index], (address[]));
    //         _printArray("subarray ", _paths);
    //     }
    //     console2.log("]");
    // }
}
