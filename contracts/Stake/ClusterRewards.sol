pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract ClusterRewards is Initializable, Ownable {

    using SafeMath for uint256;

    mapping(address => uint256) public clusterRewards;

    mapping(bytes32 => uint256) public rewardWeight;
    uint256 totalWeight;
    uint256 public totalRewardsPerEpoch;
    uint256 payoutDenomination;

    address rewardDelegatorsAddress;
    ERC20 POND;
    address public feeder;
    mapping(uint256 => uint256) rewardDistributedPerEpoch;
    uint256 latestNewEpochRewardAt;
    uint256 public rewardDistributionWaitTime;

    event NetworkAdded(bytes32 networkId, uint256 rewardPerEpoch);
    event NetworkRemoved(bytes32 networkId);
    event NetworkRewardUpdated(bytes32 networkId, uint256 updatedRewardPerEpoch);
    event ClusterRewarded(bytes32 networkId);

    modifier onlyRewardDelegatorsContract() {
        require(msg.sender == rewardDelegatorsAddress, "Sender not Reward Delegators contract");
        _;
    }

    modifier onlyFeeder() {
        require(msg.sender == feeder, "Sender not feeder");
        _;
    }

    function changeFeeder(address _newFeeder) public onlyOwner {
        feeder = _newFeeder;
    }

    function addNetwork(bytes32 _networkId, uint256 _rewardWeight) public onlyOwner {
        require(rewardWeight[_networkId] == 0, "CRW:AN-Network already exists");
        require(_rewardWeight != 0, "CRW:AN-Reward cant be 0");
        rewardWeight[_networkId] = _rewardWeight;
        totalWeight = totalWeight.add(_rewardWeight);
        emit NetworkAdded(_networkId, _rewardWeight);
    }

    function removeNetwork(bytes32 _networkId) public onlyOwner {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "CRW:RN-Network doesnt exist");
        delete rewardWeight[_networkId];
        totalWeight = totalWeight.sub(networkWeight);
        emit NetworkRemoved(_networkId);
    }

    function changeNetworkReward(bytes32 _networkId, uint256 _updatedRewardWeight) public onlyOwner {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "CRW:CNR-Network doesnt exist");
        rewardWeight[_networkId] = _updatedRewardWeight;
        totalWeight = totalWeight.sub(networkWeight).add(_updatedRewardWeight);
        emit NetworkRewardUpdated(_networkId, _updatedRewardWeight);
    }


    function feed(
        bytes32 _networkId, 
        address[] memory _clusters, 
        uint256[] memory _payouts, 
        uint256 _epoch
    ) public onlyFeeder {
        uint256 rewardDistributed = rewardDistributedPerEpoch[_epoch];
        if(rewardDistributed == 0) {
            require(
                block.timestamp > latestNewEpochRewardAt.add(rewardDistributionWaitTime), 
                "CRW:F-Cant distribute reward for new epoch within such short interval"
            );
            latestNewEpochRewardAt = block.timestamp;
        }
        uint256 totalNetworkWeight = totalWeight;
        uint256 currentTotalRewardsPerEpoch = totalRewardsPerEpoch;
        uint256 currentPayoutDenomination = payoutDenomination;
        uint256 networkRewardWeight = rewardWeight[_networkId];
        for(uint256 i=0; i < _clusters.length; i++) {
          uint256 clusterReward = currentTotalRewardsPerEpoch
                                    .mul(networkRewardWeight)
                                    .mul(_payouts[i])
                                    .div(totalNetworkWeight)
                                    .div(currentPayoutDenomination);
            rewardDistributed = rewardDistributed.add(clusterReward);
            clusterRewards[_clusters[i]] = clusterRewards[_clusters[i]].add(clusterReward);
        }
        require(
            rewardDistributed <= totalRewardsPerEpoch, 
            "CRW:F-Reward Distributed  cant  be more  than totalRewardPerEpoch"
        );
        rewardDistributedPerEpoch[_epoch] = rewardDistributed;
        emit ClusterRewarded(_networkId);
    }

    function getRewardPerEpoch(bytes32 _networkId) public view returns(uint256) {
        return totalRewardsPerEpoch.mul(rewardWeight[_networkId]).div(totalWeight);
    }

    // only cluster registry is necessary because the rewards 
    // should be updated in the cluster registry against the cluster
    function claimReward(address _cluster) public onlyRewardDelegatorsContract returns(uint256) {
        uint256 pendingRewards = clusterRewards[_cluster];
        if(pendingRewards > 1) {
            uint256 rewardsToTransfer = pendingRewards.sub(1);
            clusterRewards[_cluster] = 1;
            return rewardsToTransfer;
        }
        return 0;
    }

    function transferRewardsToRewardDelegators() public onlyOwner returns(uint256) {
        POND.transfer(rewardDelegatorsAddress, POND.balanceOf(address(this)));
    }

    function updateRewardDelegatorAddress(address _updatedRewardDelegator) public onlyOwner {
        require(
            _updatedRewardDelegator != address(0),
            "CRW:URDA-Updated Reward delegator address cant be 0"
        );
        rewardDelegatorsAddress = _updatedRewardDelegator;
    }

    function updatePONDAddress(address _updatedPOND) public onlyOwner {
        require(
            _updatedPOND != address(0),
            "CRW:UPA-POND token address cant be 0"
        );
        POND = ERC20(_updatedPOND);
    }

    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) public onlyOwner {
        totalRewardsPerEpoch = _updatedRewardPerEpoch;
    }

    function changePayoutDenomination(uint256 _updatedPayoutDenomination) public onlyOwner {
        payoutDenomination = _updatedPayoutDenomination;
    }

    function updateRewardDistributionWaitTime(uint256 _updatedRewardDistributionWaitTime) public onlyOwner {
        rewardDistributionWaitTime = _updatedRewardDistributionWaitTime;
    }
}