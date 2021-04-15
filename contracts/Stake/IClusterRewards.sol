pragma solidity ^0.5.17;

interface IClusterRewards {
    function clusterRewards(address _cluster) external returns(uint256);
    function rewardWeight(bytes32 _networkId) external returns(uint256);
    function totalRewardsPerEpoch() external returns(uint256);
    function feeder() external returns(address);
    function rewardDistributionWaitTime() external returns(uint256);
    function changeFeeder(address _newFeeder) external;
    function addNetwork(bytes32 _networkId, uint256 _rewardWeight) external;
    function removeNetwork(bytes32 _networkId) external;
    function changeNetworkReward(bytes32 _networkId, uint256 _updatedRewardWeight) external;
    function feed(bytes32 _networkId, address[] calldata _clusters, uint256[] calldata _payouts, uint256 _epoch) external;
    function getRewardPerEpoch(bytes32 _networkId) external view returns(uint256);
    function claimReward(address _cluster) external returns(uint256);
    function updateRewardDelegatorAddress(address _updatedRewardDelegator) external;
    function updatePONDAddress(address _updatedPOND) external;
    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) external;
    function changePayoutDenomination(uint256 _updatedPayoutDenomination) external;
    function updateRewardDistributionWaitTime(uint256 _updatedRewardDistributionWaitTime) external;
}