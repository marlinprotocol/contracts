// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


contract ClusterRewards is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable  // public upgrade
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "only admin");
        _;
    }

//-------------------------------- Overrides start --------------------------------//

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _setupRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._setupRole(role, account);
    }

    function grantRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function renounceRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.renounceRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function _authorizeUpgrade(address /*account*/) onlyAdmin internal view override {}

//-------------------------------- Overrides end --------------------------------//

//-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap1;

    function initialize(
        address _feeder,
        address _claimer,
        bytes32[] memory _networkIds,
        uint256[] memory _rewardWeight,
        uint256 _totalRewardsPerEpoch,
        uint256 _payoutDenomination,
        uint256 _rewardDistributionWaitTime)
        public
        initializer
    {
        require(
            _networkIds.length == _rewardWeight.length,
            "CRW:I-Each NetworkId need a corresponding RewardPerEpoch and vice versa"
        );

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        _setupRole(CLAIMER_ROLE, _claimer);
        _setupRole(FEEDER_ROLE, _feeder);

        uint256 weight = 0;
        for(uint256 i=0; i < _networkIds.length; i++) {
            rewardWeight[_networkIds[i]] = _rewardWeight[i];
            weight = weight + _rewardWeight[i];
            emit NetworkAdded(_networkIds[i], _rewardWeight[i]);
        }
        totalWeight = weight;
        totalRewardsPerEpoch = _totalRewardsPerEpoch;
        payoutDenomination = _payoutDenomination;
        rewardDistributionWaitTime = _rewardDistributionWaitTime;
    }

//-------------------------------- Initializer end --------------------------------//

    mapping(address => uint256) public clusterRewards;

    mapping(bytes32 => uint256) public rewardWeight;
    uint256 public totalWeight;
    uint256 public totalRewardsPerEpoch;
    uint256 public payoutDenomination;

    mapping(uint256 => uint256) public rewardDistributedPerEpoch;
    uint256 public latestNewEpochRewardAt;
    uint256 public rewardDistributionWaitTime;

    event NetworkAdded(bytes32 networkId, uint256 rewardPerEpoch);
    event NetworkRemoved(bytes32 networkId);
    event NetworkRewardUpdated(bytes32 networkId, uint256 updatedRewardPerEpoch);
    event ClusterRewarded(bytes32 networkId);
    event RewardPerEpochChanged(uint256 _updatedRewardPerEpoch);
    event PayoutDenominationChanged(uint256 _updatedPayoutDenomination);
    event RewardDistributionWaitTimeUpdated(uint256 _updatedRewardDistributionWaitTime);

    bytes32 public constant CLAIMER_ROLE = keccak256("CLAIMER_ROLE");
    bytes32 public constant FEEDER_ROLE = keccak256("FEEDER_ROLE");

    modifier onlyClaimer() {
        require(hasRole(CLAIMER_ROLE, _msgSender()), "only claimer");
        _;
    }

    modifier onlyFeeder() {
        require(hasRole(FEEDER_ROLE, _msgSender()), "only feeder");
        _;
    }

    function addNetwork(bytes32 _networkId, uint256 _rewardWeight) external onlyAdmin {
        require(rewardWeight[_networkId] == 0, "CRW:AN-Network already exists");
        require(_rewardWeight != 0, "CRW:AN-Reward cant be 0");
        rewardWeight[_networkId] = _rewardWeight;
        totalWeight = totalWeight + _rewardWeight;
        emit NetworkAdded(_networkId, _rewardWeight);
    }

    function removeNetwork(bytes32 _networkId) external onlyAdmin {
        uint256 networkWeight = rewardWeight[_networkId];
        require( networkWeight != 0, "CRW:RN-Network doesnt exist");
        delete rewardWeight[_networkId];
        totalWeight = totalWeight - networkWeight;
        emit NetworkRemoved(_networkId);
    }

    function changeNetworkReward(bytes32 _networkId, uint256 _updatedRewardWeight) external onlyAdmin {
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
    function claimReward(address _cluster) external onlyClaimer returns(uint256) {
        uint256 pendingRewards = clusterRewards[_cluster];
        if(pendingRewards > 1) {
            uint256 rewardsToTransfer = pendingRewards - 1;
            clusterRewards[_cluster] = 1;
            return rewardsToTransfer;
        }
        return 0;
    }

    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) external onlyAdmin {
        totalRewardsPerEpoch = _updatedRewardPerEpoch;
        emit RewardPerEpochChanged(_updatedRewardPerEpoch);
    }

    function changePayoutDenomination(uint256 _updatedPayoutDenomination) external onlyAdmin {
        payoutDenomination = _updatedPayoutDenomination;
        emit PayoutDenominationChanged(_updatedPayoutDenomination);
    }

    function updateRewardDistributionWaitTime(uint256 _updatedRewardDistributionWaitTime) external onlyAdmin {
        rewardDistributionWaitTime = _updatedRewardDistributionWaitTime;
        emit RewardDistributionWaitTimeUpdated(_updatedRewardDistributionWaitTime);
    }
}
