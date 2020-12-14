pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "./ClusterRewards.sol";
import "./ClusterRegistry.sol";
import "./StakeManager.sol";

contract RewardDelegators is Initializable, Ownable {

    using SafeMath for uint256;

    struct Cluster {
        mapping(bytes32 => uint256) totalDelegations;
        mapping(address => mapping(bytes32 => uint256)) delegators;
        mapping(address => mapping(bytes32 => uint256)) rewardDebt;
        mapping(address => uint256) lastDelegatorRewardDistNonce;
        mapping(bytes32 => uint256) accRewardPerShare;
        uint256 lastRewardDistNonce;
        uint256 weightedStake;
    }

    mapping(address => Cluster) clusters;

    uint256 constant pondPerMpond = 10**6;

    uint256 public undelegationWaitTime;
    address stakeAddress;
    uint256 minMPONDStake;
    bytes32 MPONDTokenId;
    mapping(bytes32 => uint256) rewardFactor;
    mapping(bytes32 => uint256) tokenIndex;
    bytes32[] public tokenList;
    ClusterRewards public clusterRewards;
    ClusterRegistry clusterRegistry;
    ERC20 PONDToken;

    modifier onlyStake() {
        require(msg.sender == stakeAddress, "ClusterRegistry:onlyStake: only stake contract can invoke this function");
        _;
    }

    function initialize(
        uint256 _undelegationWaitTime, 
        address _stakeAddress, 
        address _clusterRewardsAddress,
        address _clusterRegistry,
        address _rewardDelegatorsAdmin,
        uint256 _minMPONDStake, 
        bytes32 _MPONDTokenId,
        address _PONDAddress,
        bytes32[] memory _tokenIds,
        uint256[] memory _rewardFactors
    ) public initializer {
        undelegationWaitTime = _undelegationWaitTime;
        stakeAddress = _stakeAddress;
        clusterRegistry = ClusterRegistry(_clusterRegistry);
        clusterRewards = ClusterRewards(_clusterRewardsAddress);
        PONDToken = ERC20(_PONDAddress);
        minMPONDStake = _minMPONDStake;
        MPONDTokenId = _MPONDTokenId;
        for(uint256 i=0; i < _tokenIds.length; i++) {
            rewardFactor[_tokenIds[i]] = _rewardFactors[i];
            tokenIndex[_tokenIds[i]] = tokenList.length;
            tokenList.push(_tokenIds[i]);
        }
        super.initialize(_rewardDelegatorsAdmin);
    }

    function updateMPONDTokenId(bytes32 _updatedMPONDTokenId) public onlyOwner {
        MPONDTokenId = _updatedMPONDTokenId;
    }

    function addReward(bytes32 _tokenId, uint256 _rewardFactor) public onlyOwner {
        require(rewardFactor[_tokenId] == 0, "RewardDelegators:addReward - Reward already exists");
        require(_rewardFactor != 0, "RewardDelegators:addReward - Reward can't be 0");
        rewardFactor[_tokenId] = _rewardFactor;
        tokenIndex[_tokenId] = tokenList.length;
        tokenList.push(_tokenId);
    }
    
    function removeRewardFactor(bytes32 _tokenId) public onlyOwner {
        require(rewardFactor[_tokenId] != 0, "RewardDelegators:addReward - Reward doesn't exist");
        bytes32 tokenToReplace = tokenList[tokenList.length - 1];
        uint256 originalTokenIndex = tokenIndex[_tokenId];
        tokenList[originalTokenIndex] = tokenToReplace;
        tokenIndex[tokenToReplace] = originalTokenIndex;
        tokenList.pop();
        delete rewardFactor[_tokenId];
        delete tokenIndex[_tokenId];
    }

    function updateRewardFactor() public onlyOwner {
        // TODO: Think about implications of this function on rewards
    }

    function _updateRewards(address _cluster) public {
        uint256 reward = clusterRewards.claimReward(_cluster);
        if(reward == 0) {
            return;
        }
        Cluster memory cluster = clusters[_cluster];
        if(cluster.weightedStake == 0) {
            clusters[_cluster].lastRewardDistNonce++;
            return;
        }
        
        uint256 commissionReward = reward.mul(clusterRegistry.getCommission(_cluster)).div(100);
        transferRewards(clusterRegistry.getRewardAddress(_cluster), commissionReward);
        uint256 delegatorReward = reward.sub(commissionReward);
        uint256 weightedStake = cluster.weightedStake;
        // uint256 weightedStake = PondRewardFactor.mul(cluster.totalDelegation.pond)
        //                                         .add(
        //                                             MPondRewardFactor
        //                                             .mul(cluster.totalDelegation.mpond)
        //                                             .mul(pondPerMpond)
        //                                         );
        bytes32[] memory tokens = tokenList;
        for(uint i=0; i < tokens.length; i++) {
            clusters[_cluster].accRewardPerShare[tokens[i]] = clusters[_cluster].accRewardPerShare[tokens[i]].add(
                                                                    delegatorReward
                                                                    .mul(rewardFactor[tokens[i]])
                                                                    .mul(10**30)
                                                                    .div(weightedStake)
                                                                );
        }
        clusters[_cluster].lastRewardDistNonce = cluster.lastRewardDistNonce.add(1);
    }

    function delegate(
        address _delegator, 
        address _cluster, 
        bytes32[] memory _tokens, 
        uint256[] memory _amounts
    ) public onlyStake {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        require(
            clusterRegistry.isClusterValid(_cluster),
            "ClusterRegistry:delegate - Cluster should be registered to delegate"
        );
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        uint256 totalRewards;
        uint256 totalRewardDebt;
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 delegatorTokens = clusters[_cluster].delegators[_delegator][_tokens[i]];
            totalRewards = totalRewards.add(
                                delegatorTokens.mul(
                                    clusters[_cluster].accRewardPerShare[_tokens[i]]
                                )
                            );
            totalRewardDebt = totalRewardDebt.add(clusters[_cluster].rewardDebt[_delegator][_tokens[i]]);
            // update balances
            clusters[_cluster].delegators[_delegator][_tokens[i]] = delegatorTokens.add(_amounts[i]);
            clusters[_cluster].totalDelegations[_tokens[i]] = clusters[_cluster].totalDelegations[_tokens[i]]
                                                                .add(_amounts[i]);
            clusters[_cluster].weightedStake = clusterData.weightedStake.add(_amounts[i].mul(rewardFactor[_tokens[i]]));
            totalRewards = totalRewards.add(
                _amounts[i].mul(clusters[_cluster].accRewardPerShare[_tokens[i]])
            );
            clusters[_cluster].rewardDebt[_delegator][_tokens[i]] = totalRewards.div(10**30);
        }
        if(totalRewards != 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(totalRewardDebt);
            if(pendingRewards != 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
            }
        }
        // if(_PONDAmount != 0) {
        //     clusters[_cluster].totalDelegation.pond = clusterData.totalDelegation.pond.add(_PONDAmount);
        //     clusters[_cluster].delegators[_delegator].pond = delegatorStake.pond.add(_PONDAmount);
        //     totalRewards = totalRewards.add(_PONDAmount.mul(clusterData.accPondRewardPerShare));
        // }
        // if(_MPONDAmount != 0) {
        //     clusters[_cluster].totalDelegation.mpond = clusterData.totalDelegation.mpond.add(_MPONDAmount);
        //     clusters[_cluster].delegators[_delegator].mpond = delegatorStake.mpond.add(_MPONDAmount);
        //     totalRewards = totalRewards.add(_MPONDAmount.mul(clusterData.accMPondRewardPerShare));
        // }
        // clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
    }

    function undelegate(
        address _delegator, 
        address _cluster, 
        bytes32[] memory _tokens, 
        uint256[] memory _amounts
    ) public onlyStake {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        uint256 totalRewards;
        uint256 totalRewardDebt;
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 delegatorTokens = clusters[_cluster].delegators[_delegator][_tokens[i]];
            totalRewards = totalRewards.add(
                                delegatorTokens.mul(
                                    clusters[_cluster].accRewardPerShare[_tokens[i]]
                                )
                            );
            totalRewardDebt = totalRewardDebt.add(clusters[_cluster].rewardDebt[_delegator][_tokens[i]]);
            // update balances
            clusters[_cluster].delegators[_delegator][_tokens[i]] = delegatorTokens.sub(_amounts[i]);
            clusters[_cluster].totalDelegations[_tokens[i]] = clusters[_cluster].totalDelegations[_tokens[i]]
                                                                .sub(_amounts[i]);
            clusters[_cluster].weightedStake = clusterData.weightedStake.sub(_amounts[i].mul(rewardFactor[_tokens[i]]));
            totalRewards = totalRewards.sub(
                _amounts[i].mul(clusters[_cluster].accRewardPerShare[_tokens[i]])
            );
            clusters[_cluster].rewardDebt[_delegator][_tokens[i]] = totalRewards.div(10**30);
        }
        if(totalRewards != 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(totalRewardDebt);
            if(pendingRewards != 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
            }
        }
        // if(_PONDAmount != 0) {
        //     clusters[_cluster].totalDelegation.pond = clusterData.totalDelegation.pond.sub(_PONDAmount);
        //     clusters[_cluster].delegators[_delegator].pond = clusters[_cluster].delegators[_delegator]
        //                                                                             .pond.sub(_PONDAmount);
        //     totalRewards = totalRewards.sub(_PONDAmount.mul(clusterData.accPondRewardPerShare));
        // } 
        // if(_MPONDAmount != 0) {
        //     clusters[_cluster].totalDelegation.mpond = clusterData.totalDelegation.mpond.sub(_MPONDAmount);
        //     clusters[_cluster].delegators[_delegator].mpond = clusters[_cluster].delegators[_delegator]
        //                                                                             .mpond.sub(_MPONDAmount);
        //     totalRewards = totalRewards.sub(_MPONDAmount.mul(clusterData.accMPondRewardPerShare));
        // }
        // clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
    }

    function withdrawRewards(address _delegator, address _cluster) public returns(uint256) {
        _updateRewards(_cluster);
        Cluster memory clusterData = clusters[_cluster];
        uint256 currentNonce = clusterData.lastRewardDistNonce;
        uint256 totalRewards;
        uint256 totalRewardDebt;
        bytes32[] memory tokens = tokenList;
        for(uint256 i=0; i < tokens.length; i++) {
            uint256 delegatorTokens = clusters[_cluster].delegators[_delegator][tokens[i]];
            totalRewards = totalRewards.add(
                                delegatorTokens.mul(
                                    clusters[_cluster].accRewardPerShare[tokens[i]]
                                )
                            );
            totalRewardDebt = totalRewardDebt.add(clusters[_cluster].rewardDebt[_delegator][tokens[i]]);
            clusters[_cluster].rewardDebt[_delegator][tokens[i]] = totalRewards.div(10**30);
        }
        if(totalRewards != 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
            uint256 pendingRewards = totalRewards.div(10**30).sub(totalRewardDebt);
            if(pendingRewards != 0) {
                transferRewards(_delegator, pendingRewards);
                clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
            }
            return pendingRewards;
        }
        return 0;
        // if(totalRewards != 0 && clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] < currentNonce) {
        //     uint256 pendingRewards = totalRewards.div(10**30).sub(clusters[_cluster].rewardDebt[_delegator]);
        //     if(pendingRewards != 0) {
        //         transferRewards(_delegator, pendingRewards);
        //         clusters[_cluster].lastDelegatorRewardDistNonce[_delegator] = currentNonce;
        //         clusters[_cluster].rewardDebt[_delegator] = totalRewards.div(10**30);
        //     }
        //     return pendingRewards;
        // }
        // return 0;
    }

    function transferRewards(address _to, uint256 _amount) internal {
        PONDToken.transfer(_to, _amount);
    }

    // function getEffectiveStake(address _cluster) public view returns(uint256) {
    //     Cluster memory cluster = clusters[_cluster];
    //     if(clusterRegistry.isClusterValid(_cluster) && cluster.totalDelegation.mpond >= minMPONDStake) {
    //         return (cluster.totalDelegation.pond.add(cluster.totalDelegation.mpond.mul(pondPerMpond)));
    //     }
    //     return 0;
    // }
    function isClusterActive(address _cluster) public view returns(bool) {
        if(
            clusterRegistry.isClusterValid(_cluster) 
            && clusters[_cluster].totalDelegations[MPONDTokenId] > minMPONDStake
        ) {
            return true;
        }
        return false;
    }

    function getClusterDelegation(address _cluster, bytes32 _tokenId) 
        public 
        view 
        returns(uint256) 
    {
        return clusters[_cluster].totalDelegations[_tokenId];
    }

    function getDelegation(address _cluster, address _delegator, bytes32 _tokenId) 
        public 
        view
        returns(uint256) 
    {
        return clusters[_cluster].delegators[_delegator][_tokenId];
    }

    function updateUndelegationWaitTime(uint256 _undelegationWaitTime) public onlyOwner {
        undelegationWaitTime = _undelegationWaitTime;
    }

    function updateMinMPONDStake(uint256 _minMPONDStake) public onlyOwner {
        minMPONDStake = _minMPONDStake;
    }
}