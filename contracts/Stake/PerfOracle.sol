pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

contract PerfOracle is Ownable {

    struct ClusterData {
        uint256 unrewardedWeight;
        uint256 rewards;
        // uint256 lastDrawnEpoch;
        // uint256 rewardDebt;
    }

    mapping(address => ClusterData) clusters;

    uint256 runningFeederEpochWeight;
    uint256 rewardPerWeight;

    uint256 rewardPerEpoch;
    address clusterRegistry;
    ERC20 MPOND;

    uint256 currentEpoch;

    bool feedInProgress;

    modifier onlyClusterRegistry() {
        require(msg.sender == clusterRegistry);
        _;
    }

    constructor(address _owner, address _clusterRegistry, uint256 _rewardPerEpoch, address _MPONDAddress) public Ownable() {
        // transferOwnership(_owner);
        clusterRegistry = _clusterRegistry;
        rewardPerEpoch = _rewardPerEpoch;
        MPOND = ERC20(_MPONDAddress);
    }

    function feed(uint _epoch, address[] memory _clusters, uint256[] memory _perf) public onlyOwner {
        require(_epoch == currentEpoch+1);
        for(uint256 i=0; i < _clusters.length; i++) {
            uint256 weight = getEffectiveStake(_clusters[i])*_perf[i];
            clusters[_clusters[i]].unrewardedWeight = weight;
            runningFeederEpochWeight += weight;
        }
        feedInProgress = true;
    }

    function closeFeed(uint _epoch) public onlyOwner {
        require(_epoch == currentEpoch+1);
        rewardPerWeight = rewardPerEpoch*10**30/runningFeederEpochWeight;
        delete runningFeederEpochWeight;
    }

    function distributeRewards(uint _epoch, address[] memory _clusters) public onlyOwner {
        require(_epoch == currentEpoch+1);
        for(uint256 i=0; i < _clusters.length; i++) {
            clusters[_clusters[i]].rewards += clusters[_clusters[i]].unrewardedWeight*rewardPerWeight/10**30;
        }
    }

    function lockEpoch(uint _epoch) public onlyOwner {
        require(_epoch == currentEpoch+1);
        feedInProgress = false;
        delete rewardPerWeight;
        currentEpoch = _epoch;
    }

    function claimReward(address _cluster) public onlyClusterRegistry returns(uint256) {
        require(!feedInProgress);
        uint256 pendingRewards = clusters[_cluster].rewards;
        if(pendingRewards > 0) {
            transferRewards(clusterRegistry, clusters[_cluster].rewards);
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

    function getEffectiveStake(address _cluster) public returns(uint256) {

    }
}