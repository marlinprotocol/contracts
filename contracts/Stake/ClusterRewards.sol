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

    function initialize(
        address _owner, 
        address _rewardDelegatorsAddress, 
        bytes32[] memory _networkIds,
        uint256[] memory _rewardWeight,
        uint256 _totalRewardsPerEpoch, 
        address _PONDAddress,
        uint256 _payoutDenomination,
        address _feeder,
        uint256 _rewardDistributionWaitTime) 
        public
        initializer
    {
        require(
            _networkIds.length == _rewardWeight.length, 
            "ClusterRewards:initialize - Each NetworkId need a corresponding RewardPerEpoch and vice versa"
        );
        super.initialize(_owner);
        uint256 weight = 0;
        rewardDelegatorsAddress = _rewardDelegatorsAddress;
        for(uint256 i=0; i < _networkIds.length; i++) {
            rewardWeight[_networkIds[i]] = _rewardWeight[i];
            weight = weight.add(_rewardWeight[i]);
            emit NetworkAdded(_networkIds[i], _rewardWeight[i]);
        }
        totalWeight = weight;
        totalRewardsPerEpoch = _totalRewardsPerEpoch;
        POND = ERC20(_PONDAddress);
        payoutDenomination = _payoutDenomination;
        feeder = _feeder;
        rewardDistributionWaitTime = _rewardDistributionWaitTime;
    }

    function changeFeeder(address _newFeeder) public onlyOwner {
        feeder = _newFeeder;
    }

    function addNetwork(bytes32 _networkId, uint256 _rewardWeight) public onlyOwner {
        require(rewardWeight[_networkId] == 0, "ClusterRewards:addNetwork - Network already exists");
        require(_rewardWeight != 0, "ClusterRewards:addNetwork - Reward can't be 0");
        rewardWeight[_networkId] = _rewardWeight;
        totalWeight = totalWeight.add(_rewardWeight);
        emit NetworkAdded(_networkId, _rewardWeight);
    }

    function removeNetwork(bytes32 _networkId) public onlyOwner {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "ClusterRewards:removeNetwork - Network doesn't exist");
        delete rewardWeight[_networkId];
        totalWeight = totalWeight.sub(networkWeight);
        emit NetworkRemoved(_networkId);
    }

    function changeNetworkReward(bytes32 _networkId, uint256 _updatedRewardWeight) public onlyOwner {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "ClusterRewards:changeNetworkRewards - Network doesn't exists");
        rewardWeight[_networkId] = _updatedRewardWeight;
        totalWeight = totalWeight.sub(networkWeight).add(_updatedRewardWeight);
        emit NetworkRewardUpdated(_networkId, _updatedRewardWeight);
    }


    function feed(bytes32 _networkId, address[] memory _clusters, uint256[] memory _payouts, uint256 _epoch) public onlyFeeder {
        uint256 rewardDistributed = rewardDistributedPerEpoch[_epoch];
        if(rewardDistributed == 0) {
            require(block.timestamp > latestNewEpochRewardAt.add(rewardDistributionWaitTime), 
                "ClusterRewards:feed - Can't distribute reward for new epoch within such short interval, please wait and try again");
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
        require(rewardDistributed <= totalRewardsPerEpoch, "ClusterRewards:feed - Reward Distributed  can't  be more  than totalRewardPerEpoch");
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
        if(pendingRewards != 0) {
            transferRewards(rewardDelegatorsAddress, pendingRewards.sub(1));
            clusterRewards[_cluster] = 1;
            return pendingRewards.sub(1);
        }
        return 0;
    }

    function transferRewards(address _to, uint256 _amount) internal {
        POND.transfer(_to, _amount);
    }

    function updateRewardDelegatorAddress(address _updatedRewardDelegator) public onlyOwner {
        require(
            _updatedRewardDelegator != address(0),
            "ClusterRewards:updateRewardDelegatorAddress - Updated Reward delegator address cannot be 0"
        );
        rewardDelegatorsAddress = _updatedRewardDelegator;
    }

    function updatePONDAddress(address _updatedPOND) public onlyOwner {
        require(
            _updatedPOND != address(0),
            "ClusterRewards:updatePONDAddress - Updated POND token address cannot be 0"
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