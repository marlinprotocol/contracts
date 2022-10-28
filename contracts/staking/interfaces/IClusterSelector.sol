// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IClusterSelector {
    /// @notice Address of the node
    /// @param node Address of the node
    /// @param balance Balance of the node
    /// @param left Address of the node left of node
    /// @param right Address of the node right of the node
    /// @param sumOfLeftBalances Sum of the balance of nodes on left of the node
    /// @param sumOfRightBalances Sum of the balance of the nodes of right of the node
    /// @param height Height of the current node
    struct Node {
        address node; // sorting condition
        uint96 balance;
        address left;
        uint96 sumOfLeftBalances;
        address right;
        uint96 sumOfRightBalances;
        uint256 height;
    }

    /// @notice Add an element to tree. If the element already exists, it will be updated
    /// @param newNode Address of the node to add
    /// @param balance Balance of the node
    function insert(address newNode, uint96 balance) external;

    /// @notice function add multiple addresses in one call
    /// @param newNodes newNodes of the node nodes
    /// @param balances Balances of the new nodes.
    function insertMultiple(address[] calldata newNodes, uint96[] calldata balances) external;

    /// @notice Update the balance of the node
    /// @param cluster Address of the existing node
    /// @param clusterBalance new balance of the node
    function update(address cluster, uint96 clusterBalance) external;

    /// @notice Delete a node from the tree
    /// @param key Address of the node to delete
    function deleteNode(address key) external;
}
