pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract Distribution {

    using SafeMath for uint256;

    uint256 lastEpochRewardPerWeight;
    uint256 lastUpdatedEpoch;

    uint256 runningFeederEpochWeight;

    uint rewardPerEpoch;

    struct ClusterData {
        uint256 lastEpochWeight;
        uint256 rewards;
    }

    mapping(address => ClusterData) clusters;

    function addWeight(address[] memory _clusters, uint256[] memory _weight) public {
        for(uint256 i =0; i < _clusters.length; i++) {
            clusters[_clusters[i]].rewards += clusters[_clusters[i]].lastEpochWeight*lastEpochRewardPerWeight; 
            clusters[_clusters[i]].lastEpochWeight = _weight[i];
            runningFeederEpochWeight += _weight[i];
        }
    }

    function closeRunningEpoch() public {
        lastEpochRewardPerWeight = runningFeederEpochWeight.div(rewardPerEpoch);
        lastUpdatedEpoch = lastUpdatedEpoch.add(1);
        delete runningFeederEpochWeight;
    }



    function claimReward(address _cluster) public {
        uint256 rewards = clusters[_cluster].rewards + clusters[_cluster].lastEpochWeight*lastEpochRewardPerWeight; 
        delete clusters[_cluster];
        _transferTokens(_cluster, rewards);
    }

    function _transferTokens(address _to, uint256 _amount) internal {

    }
}