// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IClusterRewards {
    function clusterRewards(address _cluster) external returns(uint256);
    function rewardWeight(bytes32 _networkId) external returns(uint256);
    function totalRewardsPerEpoch() external returns(uint256);
    function addNetwork(bytes32 _networkId, uint256 _rewardWeight) external;
    function removeNetwork(bytes32 _networkId) external;
    function changeNetworkReward(bytes32 _networkId, uint256 _updatedRewardWeight) external;
    function getRewardPerEpoch(bytes32 _networkId) external view returns(uint256);
    function claimReward(address _cluster) external returns(uint256);
    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) external;
}
