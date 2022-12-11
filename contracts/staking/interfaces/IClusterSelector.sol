// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IClusterSelector {
    /// @notice Add an element to tree. If the element already exists, it will be updated
    /// @param newNode Address of the node to add
    /// @param balance Balance of the node
    function upsert(address newNode, uint64 balance) external;

    /// @notice function add multiple addresses in one call
    /// @param newNodes newNodes of the node nodes
    /// @param balances Balances of the new nodes.
    function upsertMultiple(address[] calldata newNodes, uint64[] calldata balances) external;

    /// @notice Update the balance of the node
    /// @param cluster Address of the existing node
    /// @param clusterBalance new balance of the node
    function update_unchecked(address cluster, uint64 clusterBalance) external;

    /// @notice Delete a node from the tree
    /// @param key Address of the node to delete
    function delete_unchecked(address key) external;
}
