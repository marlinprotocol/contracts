// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IReceiverStaking {
    /// @notice Event emitted when signer is updated
    /// @param staker Address of staker
    /// @param signer Address of signer
    event SignerUpdated(address staker, address signer);

    /// @return Time when earliest epoch starts
    function START_TIME() external view returns(uint256);

    /// @return Length of each epoch
    function EPOCH_LENGTH() external view returns(uint256);

    /// @notice Get Info at given epoch
    /// @return totalStake Total Stake by all users
    /// @return currentEpoch Current epoch
    function getEpochInfo(uint256 epoch) external view returns(uint256 totalStake, uint256 currentEpoch);

    function balanceOfSignerAt(address signer, uint256 snapshotId) external view returns (uint256);
}