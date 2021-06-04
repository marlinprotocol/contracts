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

    uint256 __unused_2;
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
    event MinMPONDStakeUpdated(uint256 minMPONDStake);
    event StakeAddressUpdated(address _updatedStakeAddress);
    event ClusterRewardsAddressUpdated(address _updatedClusterRewards);
    event ClusterRegistryUpdated(address _updatedClusterRegistry);
    event PONDAddressUpdated(address _updatedPOND);

    modifier onlyStake() {
        require(msg.sender == stakeAddress, "RD:OS-only stake contract can invoke");
        _;
    }

    function initialize(
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
            "RD:I-Each TokenId should have a corresponding Reward Factor and vice versa"
        );
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
        require(rewardFactor[_tokenId] == 0, "RD:AR-Reward already exists");
        require(_rewardFactor != 0, "RD:AR-Reward cant be 0");
        rewardFactor[_tokenId] = _rewardFactor;
        tokenIndex[_tokenId] = tokenList.length;
        tokenList.push(_tokenId);
        emit AddReward(_tokenId, _rewardFactor);
    }

    function removeRewardFactor(bytes32 _tokenId) external onlyOwner {
        require(rewardFactor[_tokenId] != 0, "RD:RR-Reward doesnt exist");
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
        require(rewardFactor[_tokenId] != 0, "RD:UR-Cant update reward that doesnt exist");
        require(_updatedRewardFactor != 0, "RD:UR-Reward cant be 0");
        rewardFactor[_tokenId] = _updatedRewardFactor;
        emit RewardsUpdated(_tokenId, _updatedRewardFactor);
    }

    function _updateRewards(address _cluster) public {
        uint256 reward = clusterRewards.claimReward(_cluster);
        if(reward == 0) {
            return;
        }

        (uint256 _commission, address _rewardAddress) = clusterRegistry.getRewardInfo(_cluster);

        uint256 commissionReward = reward.mul(_commission).div(100);
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
        if(commissionReward != 0) {
            transferRewards(_rewardAddress, commissionReward);
        }
        emit ClusterRewardDistributed(_cluster);
    }

    function delegate(
        address _delegator,
        address _cluster,
        bytes32[] memory _tokens,
        uint256[] memory _amounts
    ) public onlyStake {
        _updateRewards(_cluster);

        uint256 _aggregateRewardDebt;
        uint256 _aggregateReward;
        for(uint256 i = 0; i < _tokens.length; i++) {
            uint256 _amount = _amounts[i];
            if(_amount == 0) continue;

            bytes32 _tokenId = _tokens[i];

            uint256 _accRewardPerShare = clusters[_cluster].accRewardPerShare[_tokenId];
            uint256 _balance = clusters[_cluster].delegators[_delegator][_tokenId];
            uint256 _rewardDebt = clusters[_cluster].rewardDebt[_delegator][_tokenId];

            // calculating pending rewards for the delegator if any
            _aggregateReward = _aggregateReward.add(_accRewardPerShare.mul(_balance));
            _aggregateRewardDebt = _aggregateRewardDebt.add(_rewardDebt);

            uint256 _newBalance = _balance.add(_amount);

            // update the debt for next reward calculation
            clusters[_cluster].rewardDebt[_delegator][_tokenId] = _accRewardPerShare.mul(_newBalance).div(10**30);

            // update balances
            clusters[_cluster].delegators[_delegator][_tokenId] = _newBalance;
            clusters[_cluster].totalDelegations[_tokenId] = clusters[_cluster].totalDelegations[_tokenId]
                                                                .add(_amount);
        }
        uint256 _pendingRewards = _aggregateReward.div(10**30).sub(_aggregateRewardDebt);
        if(_pendingRewards != 0) {
            transferRewards(_delegator, _pendingRewards);
            emit RewardsWithdrawn(_cluster, _delegator, _tokens, _pendingRewards);
        }
    }

    function undelegate(
        address _delegator,
        address _cluster,
        bytes32[] memory _tokens,
        uint256[] memory _amounts
    ) public onlyStake {
        _updateRewards(_cluster);

        uint256 _aggregateRewardDebt;
        uint256 _aggregateReward;
        for(uint256 i = 0; i < _tokens.length; i++) {
            uint256 _amount = _amounts[i];
            if(_amount == 0) continue;

            bytes32 _tokenId = _tokens[i];

            uint256 _accRewardPerShare = clusters[_cluster].accRewardPerShare[_tokenId];
            uint256 _balance = clusters[_cluster].delegators[_delegator][_tokenId];
            uint256 _rewardDebt = clusters[_cluster].rewardDebt[_delegator][_tokenId];

            // calculating pending rewards for the delegator if any
            _aggregateReward = _aggregateReward.add(_accRewardPerShare.mul(_balance));
            _aggregateRewardDebt = _aggregateRewardDebt.add(_rewardDebt);

            uint256 _newBalance = _balance.sub(_amount);

            // update the debt for next reward calculation
            clusters[_cluster].rewardDebt[_delegator][_tokenId] = _accRewardPerShare.mul(_newBalance).div(10**30);

            // update balances
            clusters[_cluster].delegators[_delegator][_tokenId] = _newBalance;
            clusters[_cluster].totalDelegations[_tokenId] = clusters[_cluster].totalDelegations[_tokenId]
                                                                .sub(_amount);
        }
        uint256 _pendingRewards = _aggregateReward.div(10**30).sub(_aggregateRewardDebt);
        if(_pendingRewards != 0) {
            transferRewards(_delegator, _pendingRewards);
            emit RewardsWithdrawn(_cluster, _delegator, _tokens, _pendingRewards);
        }
    }

    function withdrawRewards(address _delegator, address _cluster) public returns(uint256) {
        _updateRewards(_cluster);

        uint256 _aggregateRewardDebt;
        uint256 _aggregateReward;
        bytes32[] memory _tokenList = tokenList;
        for(uint256 i = 0; i < _tokenList.length; i++) {
            bytes32 _tokenId = _tokenList[i];
            uint256 _accRewardPerShare = clusters[_cluster].accRewardPerShare[_tokenId];
            uint256 _balance = clusters[_cluster].delegators[_delegator][_tokenId];
            uint256 _rewardDebt = clusters[_cluster].rewardDebt[_delegator][_tokenId];

            // calculating pending rewards for the delegator if any
            uint256 _tokenPendingRewards = _accRewardPerShare.mul(_balance);
            if(_tokenPendingRewards.div(10**30) == _rewardDebt) continue;

            _aggregateReward = _aggregateReward.add(_tokenPendingRewards);
            _aggregateRewardDebt = _aggregateRewardDebt.add(_rewardDebt);

            // update the debt for next reward calculation
            clusters[_cluster].rewardDebt[_delegator][_tokenId] = _accRewardPerShare.mul(_balance).div(10**30);
        }
        uint256 _pendingRewards = _aggregateReward.div(10**30).sub(_aggregateRewardDebt);
        if(_pendingRewards != 0) {
            transferRewards(_delegator, _pendingRewards);
            emit RewardsWithdrawn(_cluster, _delegator, _tokenList, _pendingRewards);
            return _pendingRewards;
        }
        return 0;
    }

    function withdrawRewards(address _delegator, address[] calldata _clusters) external {
        for(uint256 i=0; i < _clusters.length; i++) {
            withdrawRewards(_delegator, _clusters[i]);
        }
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

    function updateMinMPONDStake(uint256 _minMPONDStake) external onlyOwner {
        minMPONDStake = _minMPONDStake;
        emit MinMPONDStakeUpdated(_minMPONDStake);
    }

    function updateStakeAddress(address _updatedStakeAddress) external onlyOwner {
        require(
            _updatedStakeAddress != address(0),
            "RD:USA-Stake contract address cant be 0"
        );
        stakeAddress = _updatedStakeAddress;
        emit StakeAddressUpdated(_updatedStakeAddress);
    }

    function updateClusterRewards(
        address _updatedClusterRewards
    ) external onlyOwner {
        require(
            _updatedClusterRewards != address(0),
            "RD:UCR-ClusterRewards address cant be 0"
        );
        clusterRewards = IClusterRewards(_updatedClusterRewards);
        emit ClusterRewardsAddressUpdated(_updatedClusterRewards);
    }

    function updateClusterRegistry(
        address _updatedClusterRegistry
    ) external onlyOwner {
        require(
            _updatedClusterRegistry != address(0),
            "RD:UCR-Cluster Registry address cant be 0"
        );
        clusterRegistry = IClusterRegistry(_updatedClusterRegistry);
        emit ClusterRegistryUpdated(_updatedClusterRegistry);
    }

    function updatePONDAddress(address _updatedPOND) external onlyOwner {
        require(
            _updatedPOND != address(0),
            "RD:UPA-Updated POND token address cant be 0"
        );
        PONDToken = ERC20(_updatedPOND);
        emit PONDAddressUpdated(_updatedPOND);
    }

    function getFullTokenList() external view returns (bytes32[] memory) {
        return tokenList;
    }

    function getAccRewardPerShare(address _cluster, bytes32 _tokenId) external view returns(uint256) {
        return clusters[_cluster].accRewardPerShare[_tokenId];
    }
}
