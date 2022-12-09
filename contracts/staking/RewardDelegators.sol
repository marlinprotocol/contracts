// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "./interfaces/IClusterRewards.sol";
import "./interfaces/IClusterRegistry.sol";
import "./interfaces/IRewardDelegators.sol";
import "./EpochSelection/EpochSelector.sol";

contract RewardDelegators is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade
    IRewardDelegators  // interface
{
    using MathUpgradeable for uint256;

    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()));
        _;
    }

    modifier onlyClusterRegistry()  {
        require(address(clusterRegistry) == _msgSender());
        _;
    }

//-------------------------------- Overrides start --------------------------------//

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _grantRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0);
    }

    function _authorizeUpgrade(address /*account*/) onlyAdmin internal view override {}

//-------------------------------- Overrides end --------------------------------//

//-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap1;

    function initialize(
        address _stakeAddress,
        address _clusterRewardsAddress,
        address _clusterRegistry,
        address _PONDAddress,
        bytes32[] memory _tokenIds,
        uint256[] memory _rewardFactors,
        uint256[] memory _weightsForThreshold
    )
        initializer
        public
    {
        require(
            _tokenIds.length == _rewardFactors.length,
            "RD:I-Each TokenId should have a corresponding Reward Factor and vice versa"
        );

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        stakeAddress = _stakeAddress;
        emit StakeAddressUpdated(_stakeAddress);

        clusterRegistry = IClusterRegistry(_clusterRegistry);
        emit ClusterRegistryUpdated(_clusterRegistry);

        clusterRewards = IClusterRewards(_clusterRewardsAddress);
        emit ClusterRewardsAddressUpdated(_clusterRewardsAddress);

        PONDToken = IERC20Upgradeable(_PONDAddress);
        emit PONDAddressUpdated(_PONDAddress);

        for(uint256 i=0; i < _tokenIds.length; i++) {
            rewardFactor[_tokenIds[i]] = _rewardFactors[i];
            _updateWeightForThreshold(_tokenIds[i], _weightsForThreshold[i]);
            tokenIndex[_tokenIds[i]] = tokenList.length;
            tokenList.push(_tokenIds[i]);
            emit AddReward(_tokenIds[i], _rewardFactors[i]);
        }
    }

//-------------------------------- Initializer end --------------------------------//


    struct Cluster {
        mapping(bytes32 => uint256) totalDelegations;
        mapping(address => mapping(bytes32 => uint256)) delegators;
        mapping(address => mapping(bytes32 => uint256)) rewardDebt;
        mapping(bytes32 => uint256) accRewardPerShare;
    }

    uint256 private constant POND_PER_MPOND = 1_000_000;

    mapping(address => Cluster) clusters;

    address public stakeAddress;
    mapping(bytes32 => uint256) public rewardFactor;
    mapping(bytes32 => uint256) public tokenIndex;
    bytes32[] public tokenList;
    IClusterRewards public clusterRewards;
    IClusterRegistry public clusterRegistry;
    IERC20Upgradeable public PONDToken;

    mapping(bytes32 => uint256) public weightForThreshold; // tokenId -> weight towards threshold for selection
    mapping(bytes32 => uint256) public thresholdForSelection; // networkId -> threshold

    event AddReward(bytes32 tokenId, uint256 rewardFactor);
    event RemoveReward(bytes32 tokenId);
    event RewardsUpdated(bytes32 tokenId, uint256 rewardFactor);
    event ClusterRewardDistributed(address cluster);
    event RewardsWithdrawn(address cluster, address delegator, bytes32[] tokenIds, uint256 rewards);
    event StakeAddressUpdated(address _updatedStakeAddress);
    event ClusterRewardsAddressUpdated(address _updatedClusterRewards);
    event ClusterRegistryUpdated(address _updatedClusterRegistry);
    event PONDAddressUpdated(address _updatedPOND);

    modifier onlyStake() {
        require(_msgSender() == stakeAddress, "RD:OS-only stake contract can invoke");
        _;
    }

    function addRewardFactor(bytes32 _tokenId, uint256 _rewardFactor) external onlyAdmin {
        require(rewardFactor[_tokenId] == 0, "RD:AR-Reward already exists");
        require(_rewardFactor != 0, "RD:AR-Reward cant be 0");
        rewardFactor[_tokenId] = _rewardFactor;
        tokenIndex[_tokenId] = tokenList.length;
        tokenList.push(_tokenId);
        emit AddReward(_tokenId, _rewardFactor);
    }

    function removeRewardFactor(bytes32 _tokenId) external onlyAdmin {
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

    function updateRewardFactor(bytes32 _tokenId, uint256 _updatedRewardFactor) external onlyAdmin {
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

        uint256 commissionReward = (reward * _commission) / 100;
        uint256 delegatorReward = reward - commissionReward;
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
                clusters[_cluster].accRewardPerShare[tokens[i]] = clusters[_cluster].accRewardPerShare[tokens[i]] +
                                                                   (((delegatorReward * (10**30)) / delegatedTokens) / delegations[i]);

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
        _updateTokens(_delegator, _cluster, _tokens, _amounts, true);
    }

    function _updateTokens(
        address _delegator,
        address _cluster,
        bytes32[] memory _tokens,
        uint256[] memory _amounts,
        bool _isDelegation
    ) internal returns(uint256 _aggregateReward) {
        _updateRewards(_cluster);

        for(uint256 i = 0; i < _tokens.length; i++) {
            bytes32 _tokenId = _tokens[i];
            uint256 _amount = _amounts[i];

            (uint256 _oldBalance, uint256 _newBalance) = _updateBalances(
                _cluster,
                _delegator,
                _tokenId,
                _amount,
                _isDelegation
            );

            uint256 _reward = _updateDelegatorRewards(
                _cluster,
                _delegator,
                _tokenId,
                _oldBalance,
                _newBalance
            );

            _aggregateReward = _aggregateReward + _reward;
        }

        bytes32 _networkId = clusterRegistry.getNetwork(_cluster);
        IEpochSelector _epochSelector = clusterRewards.epochSelectors(_networkId);
        _updateEpochSelector(_networkId, _cluster, _epochSelector);

        if(_aggregateReward != 0) {
            transferRewards(_delegator, _aggregateReward);
            emit RewardsWithdrawn(_cluster, _delegator, _tokens, _aggregateReward);
        }
    }

    function _updateBalances(
        address _cluster,
        address _delegator,
        bytes32 _tokenId,
        uint256 _amount,
        bool _isDelegation
    ) internal returns(uint256 _oldBalance, uint256 _newBalance) {
        _oldBalance = clusters[_cluster].delegators[_delegator][_tokenId];

        // short circuit
        if(_amount == 0) {
            _newBalance = _oldBalance;
            return (_oldBalance, _newBalance);
        }

        // update balances
        if(_isDelegation) {
            _newBalance =  _oldBalance + _amount;
            clusters[_cluster].totalDelegations[_tokenId] = clusters[_cluster].totalDelegations[_tokenId]
                                                             + _amount;
        } else {
            _newBalance =  _oldBalance - _amount;
            clusters[_cluster].totalDelegations[_tokenId] = clusters[_cluster].totalDelegations[_tokenId]
                                                             - _amount;
        }
        clusters[_cluster].delegators[_delegator][_tokenId] = _newBalance;
    }

    function _updateDelegatorRewards(
        address _cluster,
        address _delegator,
        bytes32 _tokenId,
        uint256 _oldBalance,
        uint256 _newBalance
    ) internal returns(uint256 _reward) {
        uint256 _accRewardPerShare = clusters[_cluster].accRewardPerShare[_tokenId];
        uint256 _rewardDebt = clusters[_cluster].rewardDebt[_delegator][_tokenId];

        // pending rewards
        uint256 _tokenPendingRewards = (_accRewardPerShare * _oldBalance) / (10**30);

        // calculating pending rewards for the delegator if any
        _reward = _tokenPendingRewards - _rewardDebt;

        // short circuit
        if(_oldBalance == _newBalance && _reward == 0) {
            return _reward;
        }

        // update the debt for next reward calculation
        clusters[_cluster].rewardDebt[_delegator][_tokenId] = (_accRewardPerShare * _newBalance) / (10**30);
    }

    function _updateEpochSelector(bytes32 _networkId, address _cluster, IEpochSelector _epochSelector) internal {
        uint256 totalDelegations = _getTotalDelegations(_cluster, _networkId);

        if(address(_epochSelector) != address(0)) {
            // if total delegation is more than 0.5 million pond, then insert into selector
            if(totalDelegations != 0){
                // divided by 1e6 to bring the range of totalDelegations(maxSupply is 1e28) into uint64
                _epochSelector.insert(_cluster, uint64(totalDelegations.sqrt()));
            }
            // if not, update it to zero
            else{
                _epochSelector.deleteNodeIfPresent(_cluster);
            }
        }
    }

    function updateClusterDelegation(address _cluster, bytes32 _networkId) public onlyClusterRegistry {
        IEpochSelector _epochSelector = clusterRewards.epochSelectors(_networkId);
        require(address(_epochSelector) != address(0), "RD:UES-invalid epoch selector");
        _updateEpochSelector(_networkId, _cluster, _epochSelector);
    }

    function removeClusterDelegation(address _cluster, bytes32 _networkId) public onlyClusterRegistry {
        IEpochSelector _epochSelector = clusterRewards.epochSelectors(_networkId);
        require(address(_epochSelector) != address(0), "RD:UES-invalid epoch selector");
        _epochSelector.deleteNodeIfPresent(_cluster);
    }

    function undelegate(
        address _delegator,
        address _cluster,
        bytes32[] memory _tokens,
        uint256[] memory _amounts
    ) public onlyStake {
        _updateTokens(_delegator, _cluster, _tokens, _amounts, false);
    }

    function withdrawRewards(address _delegator, address _cluster) public returns(uint256) {
        return _updateTokens(_delegator, _cluster, tokenList, new uint256[](tokenList.length), true);
    }

    function withdrawRewards(address _delegator, address[] calldata _clusters) external {
        for(uint256 i=0; i < _clusters.length; i++) {
            withdrawRewards(_delegator, _clusters[i]);
        }
    }

    function transferRewards(address _to, uint256 _amount) internal {
        PONDToken.transfer(_to, _amount);
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

    function updateStakeAddress(address _updatedStakeAddress) external onlyAdmin {
        require(
            _updatedStakeAddress != address(0),
            "RD:USA-Stake contract address cant be 0"
        );
        stakeAddress = _updatedStakeAddress;
        emit StakeAddressUpdated(_updatedStakeAddress);
    }

    function updateClusterRewards(
        address _updatedClusterRewards
    ) external onlyAdmin {
        require(
            _updatedClusterRewards != address(0),
            "RD:UCR-ClusterRewards address cant be 0"
        );
        clusterRewards = IClusterRewards(_updatedClusterRewards);
        emit ClusterRewardsAddressUpdated(_updatedClusterRewards);
    }

    function updateClusterRegistry(
        address _updatedClusterRegistry
    ) external onlyAdmin {
        require(
            _updatedClusterRegistry != address(0),
            "RD:UCR-Cluster Registry address cant be 0"
        );
        clusterRegistry = IClusterRegistry(_updatedClusterRegistry);
        emit ClusterRegistryUpdated(_updatedClusterRegistry);
    }

    function updatePONDAddress(address _updatedPOND) external onlyAdmin {
        require(
            _updatedPOND != address(0),
            "RD:UPA-Updated POND token address cant be 0"
        );
        PONDToken = IERC20Upgradeable(_updatedPOND);
        emit PONDAddressUpdated(_updatedPOND);
    }

    function getAccRewardPerShare(address _cluster, bytes32 _tokenId) external view returns(uint256) {
        return clusters[_cluster].accRewardPerShare[_tokenId];
    }

    function applyDiffs(
        address[] calldata _delegators,
        address[] calldata _clusters,
        bytes32[] calldata _tokens,
        uint256[] calldata _allAmounts,
        bool[] calldata _isDelegations
    ) external onlyAdmin {
        require(_delegators.length == _clusters.length);
        require(_delegators.length * _tokens.length == _allAmounts.length);
        require(_delegators.length == _isDelegations.length);

        for(uint256 _idx = 0; _idx < _delegators.length; _idx++) {
            address _delegator = _delegators[_idx];
            address _cluster = _clusters[_idx];
            uint256[] memory _amounts = _allAmounts[(_idx*_tokens.length):((_idx+1)*_tokens.length)];
            bool _isDelegation = _isDelegations[_idx];

            for(uint256 _tidx = 0; _tidx < _tokens.length; _tidx++) {
                _updateBalances(_cluster, _delegator, _tokens[_tidx], _amounts[_tidx], _isDelegation);
            }
        }
    }

    event ThresholdForSelectionUpdated(bytes32 networkId, uint256 newThreshold);
    function updateThresholdForSelection(bytes32 networkId, uint256 newThreshold) onlyAdmin external {
        _updateThresholdForSelection(networkId, newThreshold);
    }

    function _updateThresholdForSelection(bytes32 _networkId, uint256 _newThreshold) internal {
        thresholdForSelection[_networkId] = _newThreshold;
        emit ThresholdForSelectionUpdated(_networkId, _newThreshold);
    }

    event WeightForThresholdUpdated(bytes32 tokenId, uint256 weight);
    function updateWeightForThreshold(bytes32 tokenId, uint256 newWeight) onlyAdmin external {
        _updateWeightForThreshold(tokenId, newWeight);
    }

    function _updateWeightForThreshold(bytes32 tokenId, uint256 newWeight) internal {
        weightForThreshold[tokenId] = newWeight;
        emit WeightForThresholdUpdated(tokenId, newWeight);
    }

    event RefreshClusterDelegation(address indexed cluster);
    function refreshClusterDelegation(bytes32 _networkId, address[] calldata clusterList) onlyAdmin external {
        address[] memory filteredClustersList;
        uint64[] memory balances;

        IEpochSelector _epochSelector = clusterRewards.epochSelectors(_networkId);

        uint256 addressIndex=0;
        for (uint256 index = 0; index < clusterList.length; index++) {
            address cluster = clusterList[index];
            bytes32 _clusterNetwork = clusterRegistry.getNetwork(cluster);
            require(_networkId == _clusterNetwork, "RD:RCD-incorrect network");

            uint256 totalDelegations = _getTotalDelegations(cluster, _networkId);

            if(totalDelegations != 0){
                filteredClustersList[addressIndex] = cluster;
                balances[addressIndex] = uint64(totalDelegations.sqrt());
                addressIndex++;
                emit RefreshClusterDelegation(cluster);
            }

        }

        _epochSelector.insertMultiple(filteredClustersList, balances);

    }

    function _getTotalDelegations(address cluster, bytes32 networkId) internal view returns(uint256 totalDelegations){
        uint256 _totalWeight;
        for(uint256 i=0; i < tokenList.length; i++) {
            bytes32 _tokenId = tokenList[i];
            uint256 _weight = weightForThreshold[_tokenId];
            if(_weight != 0) {
                _totalWeight += _weight * clusters[cluster].totalDelegations[_tokenId];
            }
        }
        if(_totalWeight >= thresholdForSelection[networkId]){
            totalDelegations = _totalWeight;
        }
        // else totalDelegations should be considered 0
    }
}
