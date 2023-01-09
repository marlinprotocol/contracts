// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IReceiverStaking {
    function START_TIME() external view returns(uint256);
    function EPOCH_LENGTH() external view returns(uint256);
    function getStakeInfo(address user, uint256 epoch) external view returns(uint256 userStake, uint256 totalStake, uint256 currentEpoch);
}