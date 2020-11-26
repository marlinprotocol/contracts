pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "./ClusterRegistry.sol";

contract PerfOracle is Ownable {

    struct ClusterData {
        uint256 unrewardedWeight;
        uint256 rewards;
        // uint256 lastDrawnEpoch;
        // uint256 rewardDebt;
    }

    mapping(address => ClusterData) clusters;

    uint256 public runningFeederEpochWeight;
    uint256 rewardPerWeight;

    uint256 rewardPerEpoch;
    address clusterRegistryAddress;
    ERC20 MPOND;

    uint256 public currentEpoch;

    bool feedInProgress;

    modifier onlyClusterRegistry() {
        require(msg.sender == clusterRegistryAddress);
        _;
    }

    constructor(address _owner, address _clusterRegistryAddress, uint256 _rewardPerEpoch, address _MPONDAddress) public Ownable() {
        initialize(_owner);
        clusterRegistryAddress = _clusterRegistryAddress;
        rewardPerEpoch = _rewardPerEpoch;
        MPOND = ERC20(_MPONDAddress);
    }

    function feed(uint _epoch, address[] memory _clusters, uint256[] memory _perf) public onlyOwner {
        require(_epoch == currentEpoch+1, "PerfOracle:feed - Invalid Epoch");
        for(uint256 i=0; i < _clusters.length; i++) {
            uint256 weight = ClusterRegistry(clusterRegistryAddress).getEffectiveStake(_clusters[i])*_perf[i];
            clusters[_clusters[i]].unrewardedWeight = weight;
            runningFeederEpochWeight += weight;
        }
        if(runningFeederEpochWeight != 0) {
            feedInProgress = true;
        } 
    }

    function closeFeed(uint _epoch) public onlyOwner {
        require(
            _epoch == currentEpoch+1 
            && feedInProgress,  
            "PerfOracle:closeFeed - Invalid epoch or valid feed not provided"
        );
        rewardPerWeight = rewardPerEpoch*10**30/runningFeederEpochWeight;
        delete runningFeederEpochWeight;
    }

    function distributeRewards(uint _epoch, address[] memory _clusters) public onlyOwner {
        require(
            _epoch == currentEpoch+1 
            && feedInProgress 
            && runningFeederEpochWeight == 0,
            "PerfOracle:distributeRewards - Invalid epoch or feed not closed"
        );
        for(uint256 i=0; i < _clusters.length; i++) {
            clusters[_clusters[i]].rewards += clusters[_clusters[i]].unrewardedWeight*rewardPerWeight/10**30;
        }
    }

    function lockEpoch(uint _epoch) public onlyOwner {
        require(
            _epoch == currentEpoch+1 
            && feedInProgress 
            && runningFeederEpochWeight == 0,
            "PerfOracle:lockEpoch - Invalid epoch or feed not closed"
        );
        feedInProgress = false;
        delete rewardPerWeight;
        currentEpoch = _epoch;
    }

    function claimReward(address _cluster) public onlyClusterRegistry returns(uint256) {
        require(!feedInProgress, "PerfOracle:claimReward - Feed in progress");
        uint256 pendingRewards = clusters[_cluster].rewards;
        if(pendingRewards > 0) {
            transferRewards(clusterRegistryAddress, clusters[_cluster].rewards);
            delete clusters[_cluster].rewards;
        }
        return pendingRewards;
        // if(currentEpoch <= cluster.lastDrawnEpoch) {
        //     return;
        // }
        // uint pendingRewards = cluster.unrewardedWeight*accRewardPerWeight/10**30 - cluster.rewardDebt;
        // if(pendingRewards != 0) {
        //     // 
        // }
        // clusters[_cluster].rewardDebt = cluster.unrewardedWeight*accRewardPerWeight/10**30;
    }

    function transferRewards(address _to, uint256 _amount) internal {
        MPOND.transfer(_to, _amount);
    }
}