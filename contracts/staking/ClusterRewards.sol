// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract ClusterRewards is
    Initializable,
    ContextUpgradeable,
    ERC1967UpgradeUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    mapping(address => uint256) public clusterRewards;

    mapping(bytes32 => uint256) public rewardWeight;
    uint256 totalWeight;
    uint256 public totalRewardsPerEpoch;
    uint256 payoutDenomination;

    address rewardDelegatorsAddress;
    IERC20Upgradeable POND;
    address public feeder;
    mapping(uint256 => uint256) rewardDistributedPerEpoch;
    uint256 latestNewEpochRewardAt;
    uint256 public rewardDistributionWaitTime;

    event NetworkAdded(bytes32 networkId, uint256 rewardPerEpoch);
    event NetworkRemoved(bytes32 networkId);
    event NetworkRewardUpdated(bytes32 networkId, uint256 updatedRewardPerEpoch);
    event ClusterRewarded(bytes32 networkId);
    event FeederChanged(address _newFeeder);
    event RewardDelegatorAddressUpdated(address _updatedRewardDelegator);
    event PONDAddressUpdated(address _updatedPOND);
    event RewardPerEpochChanged(uint256 _updatedRewardPerEpoch);
    event PayoutDenominationChanged(uint256 _updatedPayoutDenomination);
    event RewardDistributionWaitTimeUpdated(uint256 _updatedRewardDistributionWaitTime);

    modifier onlyRewardDelegatorsContract() {
        require(msg.sender == rewardDelegatorsAddress, "Sender not Reward Delegators contract");
        _;
    }

    modifier onlyFeeder() {
        require(msg.sender == feeder, "Sender not feeder");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}
    
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
            "CRW:I-Each NetworkId need a corresponding RewardPerEpoch and vice versa"
        );

        uint256 weight = 0;
        rewardDelegatorsAddress = _rewardDelegatorsAddress;
        for(uint256 i=0; i < _networkIds.length; i++) {
            rewardWeight[_networkIds[i]] = _rewardWeight[i];
            weight = weight + _rewardWeight[i];
            emit NetworkAdded(_networkIds[i], _rewardWeight[i]);
        }
        totalWeight = weight;
        totalRewardsPerEpoch = _totalRewardsPerEpoch;
        POND = IERC20Upgradeable(_PONDAddress);
        payoutDenomination = _payoutDenomination;
        feeder = _feeder;
        rewardDistributionWaitTime = _rewardDistributionWaitTime;

        __Context_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __Ownable_init_unchained();
        transferOwnership(_owner);
    }

    function changeFeeder(address _newFeeder) external onlyOwner {
        feeder = _newFeeder;
        emit FeederChanged(_newFeeder);
    }

    function addNetwork(bytes32 _networkId, uint256 _rewardWeight) external onlyOwner {
        require(rewardWeight[_networkId] == 0, "CRW:AN-Network already exists");
        require(_rewardWeight != 0, "CRW:AN-Reward cant be 0");
        rewardWeight[_networkId] = _rewardWeight;
        totalWeight = totalWeight + _rewardWeight;
        emit NetworkAdded(_networkId, _rewardWeight);
    }

    function removeNetwork(bytes32 _networkId) external onlyOwner {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "CRW:RN-Network doesnt exist");
        delete rewardWeight[_networkId];
        totalWeight = totalWeight - networkWeight;
        emit NetworkRemoved(_networkId);
    }

    function changeNetworkReward(bytes32 _networkId, uint256 _updatedRewardWeight) external onlyOwner {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "CRW:CNR-Network doesnt exist");
        rewardWeight[_networkId] = _updatedRewardWeight;
        totalWeight = totalWeight - networkWeight + _updatedRewardWeight;
        emit NetworkRewardUpdated(_networkId, _updatedRewardWeight);
    }


    function feed(
        bytes32 _networkId,
        address[] calldata _clusters,
        uint256[] calldata _payouts,
        uint256 _epoch
    ) external onlyFeeder {
        uint256 rewardDistributed = rewardDistributedPerEpoch[_epoch];
        if(rewardDistributed == 0) {
            require(
                block.timestamp > latestNewEpochRewardAt + rewardDistributionWaitTime,
                "CRW:F-Cant distribute reward for new epoch within such short interval"
            );
            latestNewEpochRewardAt = block.timestamp;
        }
        uint256 totalNetworkWeight = totalWeight;
        uint256 currentTotalRewardsPerEpoch = totalRewardsPerEpoch;
        uint256 currentPayoutDenomination = payoutDenomination;
        uint256 networkRewardWeight = rewardWeight[_networkId];
        for(uint256 i=0; i < _clusters.length; i++) {
            uint256 clusterReward = ((currentTotalRewardsPerEpoch * networkRewardWeight * _payouts[i]) / totalNetworkWeight) / currentPayoutDenomination;
            rewardDistributed = rewardDistributed + clusterReward;
            clusterRewards[_clusters[i]] = clusterRewards[_clusters[i]] + clusterReward;
        }
        require(
            rewardDistributed <= totalRewardsPerEpoch,
            "CRW:F-Reward Distributed  cant  be more  than totalRewardPerEpoch"
        );
        rewardDistributedPerEpoch[_epoch] = rewardDistributed;
        emit ClusterRewarded(_networkId);
    }

    function getRewardPerEpoch(bytes32 _networkId) external view returns(uint256) {
        return (totalRewardsPerEpoch * rewardWeight[_networkId]) / totalWeight;
    }

    // only cluster registry is necessary because the rewards
    // should be updated in the cluster registry against the cluster
    function claimReward(address _cluster) external onlyRewardDelegatorsContract returns(uint256) {
        uint256 pendingRewards = clusterRewards[_cluster];
        if(pendingRewards > 1) {
            uint256 rewardsToTransfer = pendingRewards - 1;
            clusterRewards[_cluster] = 1;
            return rewardsToTransfer;
        }
        return 0;
    }

    function transferRewardsToRewardDelegators() external onlyOwner returns(bool) {
        return POND.transfer(rewardDelegatorsAddress, POND.balanceOf(address(this)));
    }

    function updateRewardDelegatorAddress(address _updatedRewardDelegator) external onlyOwner {
        require(
            _updatedRewardDelegator != address(0),
            "CRW:URDA-Updated Reward delegator address cant be 0"
        );
        rewardDelegatorsAddress = _updatedRewardDelegator;
        emit RewardDelegatorAddressUpdated(_updatedRewardDelegator);
    }

    function updatePONDAddress(address _updatedPOND) external onlyOwner {
        require(
            _updatedPOND != address(0),
            "CRW:UPA-POND token address cant be 0"
        );
        POND = IERC20Upgradeable(_updatedPOND);
        emit PONDAddressUpdated(_updatedPOND);
    }

    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) external onlyOwner {
        totalRewardsPerEpoch = _updatedRewardPerEpoch;
        emit RewardPerEpochChanged(_updatedRewardPerEpoch);
    }

    function changePayoutDenomination(uint256 _updatedPayoutDenomination) external onlyOwner {
        payoutDenomination = _updatedPayoutDenomination;
        emit PayoutDenominationChanged(_updatedPayoutDenomination);
    }

    function updateRewardDistributionWaitTime(uint256 _updatedRewardDistributionWaitTime) external onlyOwner {
        rewardDistributionWaitTime = _updatedRewardDistributionWaitTime;
        emit RewardDistributionWaitTimeUpdated(_updatedRewardDistributionWaitTime);
    }

    function _authorizeUpgrade(address account) internal override onlyOwner{}
}
