// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;
import "./IClusterSelector.sol";

interface IEpochSelector is IClusterSelector {

    /// @notice timestamp when the selector starts
    function START_TIME() external view returns(uint256);

    /// @notice length of epoch
    function EPOCH_LENGTH() external view returns(uint256);

    /// @notice Current Epoch
    function getCurrentEpoch() external view returns (uint256);

    /// @notice Clusters are selected only for next epoch in this epoch using selectClusters method.
    /// If the method is not called within the previous epoch, then the last selected clusters
    /// are considered as selected for this epoch
    /// @param epoch Epoch Number
    function getClusters(uint256 epoch) external view returns (address[] memory clusters);

    /// @notice Returns the list of selected clusters for the next
    /// @return nodes List of the clusters selected
    function selectClusters() external returns (address[] memory nodes);

    /// @notice Delete a node from tree if it is stored
    /// @param key Address of the node
    function deleteIfPresent(address key) external;

    /// @notice Update the number of clusters to select
    /// @param numberOfClusters New number of clusters to select
    function updateNumberOfClustersToSelect(uint256 numberOfClusters) external;
}
