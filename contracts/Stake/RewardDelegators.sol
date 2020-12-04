pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "./PerfOracle.sol";
import "./ClusterRegistry.sol";

contract RewardDelegators is Initializable, Ownable {

    using SafeMath for uint256;

    struct Stake {
        uint256 mpond;
        uint256 pond;
    }

    struct Cluster {
        Stake totalDelegation;
        mapping(address => Stake) delegators;
        mapping(address => uint256) rewardDebt;
        mapping(address => uint256) lastDelegatorRewardDistNonce;
        uint256 accPondRewardPerShare;
        uint256 accMPondRewardPerShare;
        uint256 lastRewardDistNonce;
    }

    mapping(address => Cluster) clusters;

    uint256 constant pondPerMpond = 10**6;

    uint256 public undelegationWaitTime;
    address stakeAddress;
    uint256 minMPONDStake;
    uint256 PondRewardFactor;
    uint256 MPondRewardFactor;

    PerfOracle public oracle;
    ClusterRegistry clusterRegistry;
    ERC20 MPONDToken;

    modifier onlyStake() {
        require(msg.sender == stakeAddress, "ClusterRegistry:onlyStake: only stake contract can invoke this function");
        _;
    }

    function initialize(
        uint256 _undelegationWaitTime, 
        address _stakeAddress, 
        address _oracleAddress,
        address _clusterRegistry,
        address _rewardDelegatorsAdmin,
        uint256 _minMPONDStake, 
        address _MPONDAddress,
        uint256 _PondRewardFactor,
        uint256 _MPondRewardFactor
        ) 
        public 
        initializer
    {
        undelegationWaitTime = _undelegationWaitTime;
        stakeAddress = _stakeAddress;
        clusterRegistry = ClusterRegistry(_clusterRegistry);
        oracle = PerfOracle(_oracleAddress);
        MPONDToken = ERC20(_MPONDAddress);
        minMPONDStake = _minMPONDStake;
        PondRewardFactor = _PondRewardFactor;
        MPondRewardFactor = _MPondRewardFactor;
        initialize(_rewardDelegatorsAdmin);
    }
    

    function _updateRewards(address _cluster) public {
        uint256 reward = oracle.claimReward(_cluster);
        if(reward == 0) {
            return;
        }
        Cluster memory cluster = clusters[_cluster];
        uint256 totalStakeAtReward = cluster.totalDelegation.pond.add(cluster.totalDelegation.mpond.mul(pondPerMpond));
        if(totalStakeAtReward == 0) {
            clusters[_cluster].lastRewardDistNonce++;
            return;
        }
        
        uint256 commissionReward = reward.mul(clusterRegistry.getCommission(_cluster)).div(100);
        transferRewards(clusterRegistry.getRewardAddress(_cluster), commissionReward);
        uint256 delegatorReward = reward.sub(commissionReward);
        uint256 weightedStake = PondRewardFactor.mul(cluster.totalDelegation.pond)
                                                .add(
                                                    MPondRewardFactor
                                                    .mul(cluster.totalDelegation.mpond)
                                                    .mul(pondPerMpond)
                                                );
        cluster.accPondRewardPerShare = cluster.accPondRewardPerShare
                                            .add(
                                                delegatorReward
                                                .mul(PondRewardFactor)
                                                .mul(10**30)
                                                .div(weightedStake)
                                            );
        cluster.accMPondRewardPerShare = cluster.accMPondRewardPerShare
                                            .add(
                                                delegatorReward
                                                .mul(MPondRewardFactor)
                                                .mul(pondPerMpond)
                                                .mul(10**30)
                                                .div(weightedStake)
                                            );
        cluster.lastRewardDistNonce++;
        clusters[_cluster] = cluster;

    }

    function delegate(address _delegator, address _cluster, uint256 _MPONDAmount, uint256 _PONDAmount) public onlyStake {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        require(
            clusterRegistry.isClusterValid(_cluster),
            "ClusterRegistry:delegate - Cluster should be registered to delegate"
        );
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        Stake memory delegatorStake = clusters[_cluster].delegators[_delegator];
        uint256 delegatorEffectiveStake = delegatorStake.pond.add(delegatorStake.mpond.mul(pondPerMpond));
        uint256 totalRewards = delegatorStake.pond.mul(clusterData.accPondRewardPerShare)
                                                    .add(delegatorStake.mpond.mul(clusterData.accMPondRewardPerShare));
        if(delegatorEffectiveStake != 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(clusters[_cluster].rewardDebt[_delegator]);
            if(pendingRewards != 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
            }
        }
        if(_PONDAmount != 0) {
            clusters[_cluster].totalDelegation.pond = clusterData.totalDelegation.pond.add(_PONDAmount);
            clusters[_cluster].delegators[_delegator].pond = delegatorStake.pond.add(_PONDAmount);
            totalRewards = totalRewards.add(_PONDAmount.mul(clusterData.accPondRewardPerShare));
        }
        if(_MPONDAmount != 0) {
            clusters[_cluster].totalDelegation.mpond = clusterData.totalDelegation.mpond.add(_MPONDAmount);
            clusters[_cluster].delegators[_delegator].mpond = delegatorStake.mpond.add(_MPONDAmount);
            totalRewards = totalRewards.add(_MPONDAmount.mul(clusterData.accMPondRewardPerShare));
        }
        clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
    }

    function undelegate(address _delegator, address _cluster, uint256 _MPONDAmount, uint256 _PONDAmount) public onlyStake {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        Stake memory delegatorStake = clusters[_cluster].delegators[_delegator];
        uint256 totalRewards = delegatorStake.pond.mul(clusterData.accPondRewardPerShare)
                                                    .add(delegatorStake.mpond.mul(clusterData.accMPondRewardPerShare));
        if(clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(clusters[_cluster].rewardDebt[_delegator]);
            if(pendingRewards != 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
            }
        }
        if(_PONDAmount != 0) {
            clusters[_cluster].totalDelegation.pond = clusterData.totalDelegation.pond.sub(_PONDAmount);
            clusters[_cluster].delegators[_delegator].pond = clusters[_cluster].delegators[_delegator]
                                                                                    .pond.sub(_PONDAmount);
            totalRewards = totalRewards.sub(_PONDAmount.mul(clusterData.accPondRewardPerShare));
        } 
        if(_MPONDAmount != 0) {
            clusters[_cluster].totalDelegation.mpond = clusterData.totalDelegation.mpond.sub(_MPONDAmount);
            clusters[_cluster].delegators[_delegator].mpond = clusters[_cluster].delegators[_delegator]
                                                                                    .mpond.sub(_MPONDAmount);
            totalRewards = totalRewards.sub(_MPONDAmount.mul(clusterData.accMPondRewardPerShare));
        }
        clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
    }

    function withdrawRewards(address _delegator, address _cluster) public returns(uint256) {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        Stake memory delegatorStake = clusters[_cluster].delegators[_delegator];
        uint256 delegatorEffectiveStake = delegatorStake.pond.add(delegatorStake.mpond.mul(pondPerMpond));
        uint256 totalRewards = delegatorStake.pond.mul(clusterData.accPondRewardPerShare)
                                                    .add(delegatorStake.mpond.mul(clusterData.accMPondRewardPerShare));
        if(delegatorEffectiveStake != 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(clusters[_cluster].rewardDebt[_delegator]);
            if(pendingRewards != 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
                clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
            }
            return pendingRewards;
        }
        return 0;
    }

    function transferRewards(address _to, uint256 _amount) internal {
        MPONDToken.transfer(_to, _amount);
    }

    function getEffectiveStake(address _cluster) public view returns(uint256) {
        Cluster memory cluster = clusters[_cluster];
        if(clusterRegistry.isClusterValid(_cluster) && cluster.totalDelegation.mpond >= minMPONDStake) {
            return (cluster.totalDelegation.pond.add(cluster.totalDelegation.mpond.mul(pondPerMpond)));
        }
        return 0;
    }

    function getClusterDelegation(address _cluster) 
        public 
        view 
        returns(uint256 POND, uint256 MPOND) 
    {
        Stake memory clusterStake = clusters[_cluster].totalDelegation;
        return (clusterStake.pond, clusterStake.mpond);
    }

    function getDelegation(address _cluster, address _delegator) 
        public 
        view
        returns(uint256 POND, uint256 MPOND) 
    {
        Stake memory delegatorStake = clusters[_cluster].delegators[_delegator];
        return (delegatorStake.pond, delegatorStake.mpond);
    }

    function updateUndelegationWaitTime(uint256 _undelegationWaitTime) public onlyOwner {
        undelegationWaitTime = _undelegationWaitTime;
    }

    function updateMinMPONDStake(uint256 _minMPONDStake) public onlyOwner {
        minMPONDStake = _minMPONDStake;
    }

    function updateRewardFactors(uint256 _PONDRewardFactor, uint256 _MPONDRewardFactor) public onlyOwner {
        PondRewardFactor = _PONDRewardFactor;
        MPondRewardFactor = _MPONDRewardFactor;
    }
}