pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "./PerfOracle.sol";

contract ClusterRegistry is Initializable, Ownable {

    using SafeMath for uint256;

    struct Stake {
        uint256 mpond;
        uint256 pond;
    }

    struct Cluster {
        uint256 commission;
        address rewardAddress;
        address clientKey;
        Stake totalDelegation;
        mapping(address => Stake) delegators;
        mapping(address => uint256) rewardDebt;
        mapping(address => uint256) lastDelegatorRewardDistNonce;
        uint256 accPondRewardPerShare;
        uint256 accMPondRewardPerShare;
        uint256 lastRewardDistNonce;
        Status status;
    }

    mapping(address => Cluster) clusters;

    uint256 constant pondPerMpond = 10**6;

    uint256 public undelegationWaitTime;
    address stakeAddress;
    uint256 minMPONDStake;
    uint256 PondRewardFactor = 100;
    uint256 MPondRewardFactor = 100;

    PerfOracle public oracle;
    ERC20 MPONDToken;

    enum Status{NOT_REGISTERED, REGISTERED}

    event ClusterRegistered(address cluster, uint256 commission, address rewardAddress, address clientKey);
    event CommissionUpdated(address cluster, uint256 updatedCommission);
    event RewardAddressUpdated(address cluster, address updatedRewardAddress);
    event ClusterUnregistered(address cluster);

    modifier onlyStake() {
        require(msg.sender == stakeAddress, "ClusterRegistry:onlyStake: only stake contract can invoke this function");
        _;
    }

    function initialize(
        uint256 _undelegationWaitTime, 
        address _stakeAddress, 
        address _oracleAddress,
        address _oracleOwner, 
        address _clusterRegistryAdmin,
        uint256 _minMPONDStake, 
        uint256 _rewardPerEpoch, 
        address _MPONDAddress,
        uint256 _payoutDenomination,
        uint256 _PondRewardFactor,
        uint256 _MPondRewardFactor
        ) 
        public 
        initializer
    {
        undelegationWaitTime = _undelegationWaitTime;
        stakeAddress = _stakeAddress;
        oracle = PerfOracle(_oracleAddress);
        // oracle = new PerfOracle(_oracleOwner, address(this), _rewardPerEpoch, _MPONDAddress, _payoutDenomination);
        MPONDToken = ERC20(_MPONDAddress);
        minMPONDStake = _minMPONDStake;
        PondRewardFactor = _PondRewardFactor;
        MPondRewardFactor = _MPondRewardFactor;
        initialize(_clusterRegistryAdmin);
    }

    function register(uint256 _commission, address _rewardAddress, address _clientKey) public returns(bool) {
        require(
            clusters[msg.sender].status == Status.NOT_REGISTERED, 
            "ClusterRegistry:register - Cluster is already registered"
        );
        require(_commission <= 100, "ClusterRegistry:register - Commission can't be more than 100%");
        clusters[msg.sender].commission = _commission;
        clusters[msg.sender].rewardAddress = _rewardAddress;
        clusters[msg.sender].clientKey = _clientKey;
        clusters[msg.sender].status = Status.REGISTERED;
        
        emit ClusterRegistered(msg.sender, _commission, _rewardAddress, _clientKey);
    }

    function updateCommission(uint256 _commission) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateCommission - Cluster not registered"
        );
        require(_commission <= 100, "ClusterRegistry:updateCommission - Commission can't be more than 100%");
        clusters[msg.sender].commission = _commission;
        emit CommissionUpdated(msg.sender, _commission);
    }

    function updateRewardAddress(address _rewardAddress) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateRewardAddress - Cluster not registered"
        );
        clusters[msg.sender].rewardAddress = _rewardAddress;
        emit RewardAddressUpdated(msg.sender, _rewardAddress);
    }

    function updateClientKey(address _clientKey) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateClientKey - Cluster not registered"
        );
        clusters[msg.sender].clientKey = _clientKey;
    }

    function unregister() public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateCommission - Cluster not registered"
        );
        clusters[msg.sender].status = Status.NOT_REGISTERED;
        emit ClusterUnregistered(msg.sender);
    }

    function isClusterValid(address _cluster) public view returns(bool) {
        return (clusters[_cluster].status != Status.NOT_REGISTERED);
    }

    function isClusterActive(address _cluster) public view returns(bool) {
        return (
            clusters[_cluster].status == Status.REGISTERED 
            && clusters[_cluster].totalDelegation.mpond >= minMPONDStake
        );
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
        uint256 commissionReward = reward.mul(cluster.commission).div(100);
        transferRewards(cluster.rewardAddress, commissionReward);
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

    function delegate(address _delegator, address _cluster, uint256 _amount, uint256 _tokenType) public onlyStake {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        require(
            clusterData.status != Status.NOT_REGISTERED,
            "ClusterRegistry:delegate - Cluster should be registered to delegate"
        );
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        Stake memory delegatorStake = clusters[_cluster].delegators[_delegator];
        uint256 delegatorEffectiveStake = delegatorStake.pond.add(delegatorStake.mpond.mul(pondPerMpond));
        uint256 totalRewards = delegatorStake.pond.mul(clusterData.accPondRewardPerShare)
                                                    .add(delegatorStake.mpond.mul(clusterData.accMPondRewardPerShare));
        if(delegatorEffectiveStake > 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(clusters[_cluster].rewardDebt[_delegator]);
            if(pendingRewards > 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
            }
        }
        if(_tokenType == 0) {
            clusters[_cluster].totalDelegation.pond = clusterData.totalDelegation.pond.add(_amount);
            clusters[_cluster].delegators[_delegator].pond = delegatorStake.pond.add(_amount);
            totalRewards = totalRewards.add(_amount.mul(clusterData.accPondRewardPerShare));
        } else if(_tokenType == 1) {
            clusters[_cluster].totalDelegation.mpond = clusterData.totalDelegation.mpond.add(_amount);
            clusters[_cluster].delegators[_delegator].mpond = delegatorStake.mpond.add(_amount);
            totalRewards = totalRewards.add(_amount.mul(clusterData.accMPondRewardPerShare));
        } else {
            revert("ClusterRegistry:delegate - Token type invalid");
        }
        clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
    }

    function undelegate(address _delegator, address _cluster, uint256 _amount, uint256 _tokenType) public onlyStake {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        require(
            clusterData.status != Status.NOT_REGISTERED,
            "ClusterRegistry:undelegate - Cluster should be registered to delegate"
        );
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        Stake memory delegatorStake = clusters[_cluster].delegators[_delegator];
        uint256 delegatorEffectiveStake = delegatorStake.pond.add(delegatorStake.mpond.mul(pondPerMpond));
        uint256 totalRewards = delegatorStake.pond.mul(clusterData.accPondRewardPerShare)
                                                    .add(delegatorStake.mpond.mul(clusterData.accMPondRewardPerShare));
        if(clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(clusters[_cluster].rewardDebt[_delegator]);
            if(pendingRewards > 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
            }
        }
        if(_tokenType == 0) {
            clusters[_cluster].totalDelegation.pond = clusterData.totalDelegation.pond.sub(_amount);
            clusters[_cluster].delegators[_delegator].pond = clusters[_cluster].delegators[_delegator]
                                                                                    .pond.sub(_amount);
            totalRewards = totalRewards.sub(_amount.mul(clusterData.accPondRewardPerShare));
        } else if(_tokenType == 1) {
            clusters[_cluster].totalDelegation.mpond = clusterData.totalDelegation.mpond.sub(_amount);
            clusters[_cluster].delegators[_delegator].mpond = clusters[_cluster].delegators[_delegator]
                                                                                    .mpond.sub(_amount);
            totalRewards = totalRewards.sub(_amount.mul(clusterData.accMPondRewardPerShare));
        } else {
            revert("ClusterRegistry:delegate - Token type invalid");
        }
        clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
    }

    function withdrawRewards(address _delegator, address _cluster) public {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        Stake memory delegatorStake = clusters[_cluster].delegators[_delegator];
        uint256 delegatorEffectiveStake = delegatorStake.pond.add(delegatorStake.mpond.mul(pondPerMpond));
        uint256 totalRewards = delegatorStake.pond.mul(clusterData.accPondRewardPerShare)
                                                    .add(delegatorStake.mpond.mul(clusterData.accMPondRewardPerShare));
        if(delegatorEffectiveStake > 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(clusters[_cluster].rewardDebt[_delegator]);
            if(pendingRewards > 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
                clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
            }
        }
    }

    function transferRewards(address _to, uint256 _amount) internal {
        MPONDToken.transfer(_to, _amount);
    }

    function getEffectiveStake(address _cluster) public view returns(uint256) {
        if(isClusterActive(_cluster)) {
            return (clusters[_cluster].totalDelegation.pond
                                                    .add(clusters[_cluster].totalDelegation.mpond.mul(pondPerMpond)));
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