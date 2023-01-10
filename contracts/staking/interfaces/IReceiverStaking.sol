// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IReceiverStaking {
    /// @return Time when earliest epoch starts
    function START_TIME() external view returns(uint256);

    /// @return Length of each epoch
    function EPOCH_LENGTH() external view returns(uint256);

    /// @notice Get Staking Info of user at given epoch
    /// @return userStake User Stake
    /// @return totalStake Total Stake by all users
    /// @return currentEpoch Current epoch
    function getStakeInfo(address user, uint256 epoch) external view returns(uint256 userStake, uint256 totalStake, uint256 currentEpoch);
}