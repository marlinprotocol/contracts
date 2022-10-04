// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;
import "./IClusterSelector.sol";

interface IEpochSelector is IClusterSelector {
    function getCurrentEpoch() external view returns (uint256);

    function getCurrentClusters() external returns (address[] memory nodes);

    /// @notice Delete a node from tree if it is stored
    /// @param key Address of the node
    function deleteNodeIfPresent(address key) external returns (bool);
}
