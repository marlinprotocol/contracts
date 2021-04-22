pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "./IClusterRewards.sol";
import "./IClusterRegistry.sol";

contract RewardDelegators is Initializable, Ownable {

    using SafeMath for uint256;

    struct Cluster {
        mapping(bytes32 => uint256) totalDelegations;
        mapping(address => mapping(bytes32 => uint256)) delegators;
        mapping(address => mapping(bytes32 => uint256)) rewardDebt;
        mapping(bytes32 => uint256) accRewardPerShare;
    }

    mapping(address => Cluster) clusters;

    uint256 public undelegationWaitTime;
    address stakeAddress;
    uint256 public minMPONDStake;
    bytes32 public MPONDTokenId;
    mapping(bytes32 => uint256) rewardFactor;
    mapping(bytes32 => uint256) tokenIndex;
    mapping(bytes32 => bytes32) __unused_1;
    bytes32[] tokenList;
    IClusterRewards clusterRewards;
    IClusterRegistry clusterRegistry;
    ERC20 PONDToken;

    event AddReward(bytes32 tokenId, uint256 rewardFactor);
    event RemoveReward(bytes32 tokenId);
    event MPONDTokenIdUpdated(bytes32 MPONDTokenId);
    event RewardsUpdated(bytes32 tokenId, uint256 rewardFactor);
    event ClusterRewardDistributed(address cluster);
    event RewardsWithdrawn(address cluster, address delegator, bytes32[] tokenIds, uint256 rewards);
    event UndelegationWaitTimeUpdated(uint256 undelegationWaitTime);
    event MinMPONDStakeUpdated(uint256 minMPONDStake);

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
        require(
            _tokenIds.length == _rewardFactors.length,
            "RewardDelegators:initalize - Each TokenId should have a corresponding Reward Factor and vice versa"
        );
        undelegationWaitTime = _undelegationWaitTime;
        emit UndelegationWaitTimeUpdated(_undelegationWaitTime);
        stakeAddress = _stakeAddress;
        clusterRegistry = IClusterRegistry(_clusterRegistry);
        clusterRewards = IClusterRewards(_clusterRewardsAddress);
        PONDToken = ERC20(_PONDAddress);
        minMPONDStake = _minMPONDStake;
        emit MinMPONDStakeUpdated(_minMPONDStake);
        MPONDTokenId = _MPONDTokenId;
        emit MPONDTokenIdUpdated(_MPONDTokenId);
        for(uint256 i=0; i < _tokenIds.length; i++) {
            rewardFactor[_tokenIds[i]] = _rewardFactors[i];
            tokenIndex[_tokenIds[i]] = tokenList.length;
            tokenList.push(_tokenIds[i]);
            emit AddReward(_tokenIds[i], _rewardFactors[i]);
        }
        super.initialize(_rewardDelegatorsAdmin);
    }

    function updateMPONDTokenId(bytes32 _updatedMPONDTokenId) external onlyOwner {
        MPONDTokenId = _updatedMPONDTokenId;
        emit MPONDTokenIdUpdated(_updatedMPONDTokenId);
    }

    function addRewardFactor(bytes32 _tokenId, uint256 _rewardFactor) external onlyOwner {
        require(rewardFactor[_tokenId] == 0, "RewardDelegators:addReward - Reward already exists");
        require(_rewardFactor != 0, "RewardDelegators:addReward - Reward can't be 0");
        rewardFactor[_tokenId] = _rewardFactor;
        tokenIndex[_tokenId] = tokenList.length;
        tokenList.push(_tokenId);
        emit AddReward(_tokenId, _rewardFactor);
    }

    function removeRewardFactor(bytes32 _tokenId) external onlyOwner {
        require(rewardFactor[_tokenId] != 0, "RewardDelegators:addReward - Reward doesn't exist");
        bytes32 tokenToReplace = tokenList[tokenList.length - 1];
        uint256 originalTokenIndex = tokenIndex[_tokenId];
        tokenList[originalTokenIndex] = tokenToReplace;
        tokenIndex[tokenToReplace] = originalTokenIndex;
        tokenList.pop();
        delete rewardFactor[_tokenId];
        delete tokenIndex[_tokenId];
        emit RemoveReward(_tokenId);
    }

    function updateRewardFactor(bytes32 _tokenId, uint256 _updatedRewardFactor) external onlyOwner {
        require(rewardFactor[_tokenId] != 0, "RewardDelegators:updateReward - Can't update reward that doesn't exist");
        require(_updatedRewardFactor != 0, "RewardDelegators:updateReward - Reward can't be 0");
        rewardFactor[_tokenId] = _updatedRewardFactor;
        emit RewardsUpdated(_tokenId, _updatedRewardFactor);
    }

    function _updateRewards(address _cluster) public {
        uint256 reward = clusterRewards.claimReward(_cluster);
        if(reward == 0) {
            return;
        }

        uint256 commissionReward = reward.mul(clusterRegistry.getCommission(_cluster)).div(100);
        uint256 delegatorReward = reward.sub(commissionReward);
        bytes32[] memory tokens = tokenList;
        uint256[] memory delegations = new uint256[](tokens.length);
        uint256 delegatedTokens = 0;
        for(uint i=0; i < tokens.length; i++) {
            delegations[i] = clusters[_cluster].totalDelegations[tokens[i]];
            if(delegations[i] != 0) {
                delegatedTokens++;
            }
        }
        for(uint i=0; i < tokens.length; i++) {
            // clusters[_cluster].accRewardPerShare[tokens[i]] = clusters[_cluster].accRewardPerShare[tokens[i]].add(
            //                                                         delegatorReward
            //                                                         .mul(rewardFactor[tokens[i]])
            //                                                         .mul(10**30)
            //                                                         .div(weightedStake)
            //                                                     );
            if(delegations[i] != 0) {
                clusters[_cluster].accRewardPerShare[tokens[i]] = clusters[_cluster].accRewardPerShare[tokens[i]].add(
                                                                    delegatorReward
                                                                    .mul(10**30)
                                                                    .div(delegatedTokens)
                                                                    .div(delegations[i])
                                                                );
            }
        }
        transferRewards(clusterRegistry.getRewardAddress(_cluster), commissionReward);
        emit ClusterRewardDistributed(_cluster);
    }

    function delegate(
        address _delegator,
        address _cluster,
        bytes32[] calldata _tokens,
        uint256[] calldata _amounts
    ) external onlyStake {
        _updateTokens(_delegator, _cluster, _tokens, _amounts, true);
    }

    function _updateTokens(
        address _delegator, 
        address _cluster, 
        bytes32[] memory _tokens, 
        uint256[] memory _amounts, 
        bool isDelegation
    ) internal returns(uint256 _aggregateReward) {
        _updateRewards(_cluster);
        bool isWithdrawal;
        if(_amounts.length == 0) {
            isWithdrawal = true;
        }

        for(uint256 i = 0; i < _tokens.length; i++) {
            uint256 _amount;
            if(!isWithdrawal) {
                _amount = _amounts[i];
                if(_amount ==  0) continue;
            }

            bytes32 _tokenId = _tokens[i];

            (uint256 _reward, uint256 _newBalance) = _updateRewardForToken(_cluster, _delegator, _tokenId, _amount, isWithdrawal, isDelegation);
            
            _aggregateReward = _aggregateReward.add(_reward);

            if(!isWithdrawal) {
                // update balances
                clusters[_cluster].delegators[_delegator][_tokenId] = _newBalance;
                if(isDelegation) {
                    clusters[_cluster].totalDelegations[_tokenId] = clusters[_cluster].totalDelegations[_tokenId]
                                                                    .add(_amount);
                } else {
                    clusters[_cluster].totalDelegations[_tokenId] = clusters[_cluster].totalDelegations[_tokenId]
                                                                    .sub(_amount);
                }
            }
        }
        
        if(_aggregateReward != 0) {
            transferRewards(_delegator, _aggregateReward);
            emit RewardsWithdrawn(_cluster, _delegator, _tokens, _aggregateReward);
        }
    }

    function _updateRewardForToken(
        address _cluster, 
        address _delegator, 
        bytes32 _tokenId, 
        uint256 _amount, 
        bool isWithdrawal, 
        bool isDelegation
    ) internal returns(uint256 _reward, uint256 _newBalance) {
        uint256 _accRewardPerShare = clusters[_cluster].accRewardPerShare[_tokenId];
        uint256 _balance = clusters[_cluster].delegators[_delegator][_tokenId];
        uint256 _rewardDebt = clusters[_cluster].rewardDebt[_delegator][_tokenId];

        uint256 _tokenPendingRewards =  _accRewardPerShare.mul(_balance);

        // calculating pending rewards for the delegator if any
        _reward = _tokenPendingRewards.div(10**30).sub(_rewardDebt);

        if(isWithdrawal && (_reward == 0)) return (0, _balance);

        if(isDelegation) {
            _newBalance =  _balance.add(_amount);
        } else {
            _newBalance =  _balance.sub(_amount);
        }
        
        // update the debt for next reward calculation
        clusters[_cluster].rewardDebt[_delegator][_tokenId] = _accRewardPerShare.mul(_newBalance).div(10**30);
        
        return (_reward, _newBalance);
    }

    function undelegate(
        address _delegator,
        address _cluster,
        bytes32[] calldata _tokens,
        uint256[] calldata _amounts
    ) external onlyStake {
        _updateTokens(_delegator, _cluster, _tokens, _amounts, false);
    }

    function withdrawRewards(address _delegator, address _cluster) external returns(uint256) {
        return _updateTokens(_delegator, _cluster, tokenList, new uint256[](0), true);
    }

    function transferRewards(address _to, uint256 _amount) internal {
        PONDToken.transfer(_to, _amount);
    }

    function isClusterActive(address _cluster) external returns(bool) {
        if(
            clusterRegistry.isClusterValid(_cluster)
            && clusters[_cluster].totalDelegations[MPONDTokenId] > minMPONDStake
        ) {
            return true;
        }
        return false;
    }

    function getClusterDelegation(address _cluster, bytes32 _tokenId)
        external
        view
        returns(uint256)
    {
        return clusters[_cluster].totalDelegations[_tokenId];
    }

    function getDelegation(address _cluster, address _delegator, bytes32 _tokenId)
        external
        view
        returns(uint256)
    {
        return clusters[_cluster].delegators[_delegator][_tokenId];
    }

    function updateUndelegationWaitTime(uint256 _undelegationWaitTime) external onlyOwner {
        undelegationWaitTime = _undelegationWaitTime;
        emit UndelegationWaitTimeUpdated(_undelegationWaitTime);
    }

    function updateMinMPONDStake(uint256 _minMPONDStake) external onlyOwner {
        minMPONDStake = _minMPONDStake;
        emit MinMPONDStakeUpdated(_minMPONDStake);
    }

    function updateStakeAddress(address _updatedStakeAddress) external onlyOwner {
        require(
            _updatedStakeAddress != address(0),
            "RewardDelegators:updateStakeAddress - Updated Stake contract address cannot be 0"
        );
        stakeAddress = _updatedStakeAddress;
    }

    function updateClusterRewards(
        address _updatedClusterRewards
    ) external onlyOwner {
        require(
            _updatedClusterRewards != address(0),
            "RewardDelegators:updateClusterRewards - ClusterRewards address cannot be 0"
        );
        clusterRewards = IClusterRewards(_updatedClusterRewards);
    }

    function updateClusterRegistry(
        address _updatedClusterRegistry
    ) external onlyOwner {
        require(
            _updatedClusterRegistry != address(0),
            "RewardDelegators:updateClusterRegistry - Cluster Registry address cannot be 0"
        );
        clusterRegistry = IClusterRegistry(_updatedClusterRegistry);
    }

    function updatePONDAddress(address _updatedPOND) external onlyOwner {
        require(
            _updatedPOND != address(0),
            "RewardDelegators:updatePONDAddress - Updated POND token address cannot be 0"
        );
        PONDToken = ERC20(_updatedPOND);
    }

    function getFullTokenList() external view returns (bytes32[] memory) {
        return tokenList;
    }

    function getAccRewardPerShare(address _cluster, bytes32 _tokenId) public view returns(uint256) {
        return clusters[_cluster].accRewardPerShare[_tokenId];
    }
}
