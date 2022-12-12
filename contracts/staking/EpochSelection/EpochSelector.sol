// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./TreeUpgradeable.sol";
import "../interfaces/IEpochSelector.sol";

/// @title Contract to select the top 5 clusters in an epoch
contract EpochSelectorUpgradeable is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade,
    TreeUpgradeable, // storage tree
    IEpochSelector // interface
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct MemoryNode {
        uint256 node; // sorting condition
        uint256 balance;
        uint256 left;
        uint256 sumOfLeftBalances;
        uint256 right;
        uint256 sumOfRightBalances;
    }

    //-------------------------------- Constants start --------------------------------//

    /// @notice length of epoch
    uint256 public constant EPOCH_LENGTH = 4 hours;

    /// @notice ID for update role
    bytes32 public constant UPDATER_ROLE = keccak256(abi.encode("updater"));

    /// @notice ID for admin role
    bytes32 public constant ADMIN_ROLE = keccak256(abi.encode("admin"));

    /// @notice ID for reward control
    bytes32 public constant REWARD_CONTROLLER_ROLE = keccak256(abi.encode("reward-control"));

    /// @notice timestamp when the selector starts
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable START_TIME;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- Variables start --------------------------------//

    /// @notice Number of clusters selected in every epoch
    uint256 public numberOfClustersToSelect;

    /// @notice clusters selected during each epoch
    mapping(uint256 => address[]) private clustersSelected;

    /// @notice Reward that the msg.sender recevies when cluster are selected for the epoch;
    uint256 public rewardForSelectingClusters;

    /// @notice Reward Token
    address public rewardToken;

    //-------------------------------- Variables end --------------------------------//

    //-------------------------------- Events start --------------------------------//

    /// @notice Event emitted when Cluster is selected
    /// @param epoch Number of Epoch
    /// @param cluster Address of cluster
    event ClusterSelected(uint256 indexed epoch, address indexed cluster);

    /// @notice Event emited when the number of clusters to select is updated
    /// @param newNumberOfClusters New number of clusters selected
    event UpdateNumberOfClustersToSelect(uint256 newNumberOfClusters);

    /// @notice Event emited when the reward is updated
    /// @param newReward New Reward For selecting the tokens
    event UpdateRewardForSelectingTheNodes(uint256 newReward);

    /// @notice Event emited when the reward token is emitted
    /// @param _newRewardToken Address of the new reward token
    event UpdateRewardToken(address _newRewardToken);

    //-------------------------------- Events end --------------------------------//

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
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function _authorizeUpgrade(address /*account*/) onlyRole(ADMIN_ROLE) internal view override {}

    //-------------------------------- Overrides end --------------------------------//

    //-------------------------------- Init starts --------------------------------//

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor(uint256 _startTime) initializer {
        START_TIME = _startTime;
    }

    function initialize(
        address _admin,
        uint256 _numberOfClustersToSelect,
        address _rewardToken,
        uint256 _rewardForSelectingClusters
    ) external initializer {

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __TreeUpgradeable_init_unchained();

        numberOfClustersToSelect = _numberOfClustersToSelect;

        _setRoleAdmin(REWARD_CONTROLLER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(UPDATER_ROLE, ADMIN_ROLE);
        _grantRole(REWARD_CONTROLLER_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);

        rewardToken = _rewardToken;
        rewardForSelectingClusters = _rewardForSelectingClusters;
    }

    //-------------------------------- Init ends --------------------------------//

    //-------------------------------- Cluster Selection starts --------------------------------//

    function getTotalElements() public view override returns (uint256) {
        return nodes.length - 1;
    }

    /// @notice Current Epoch
    function getCurrentEpoch() public view override returns (uint256) {
        return (block.timestamp - START_TIME) / EPOCH_LENGTH;
    }

    /// @notice Returns the list of selected clusters for the next
    /// @return selectedClusters List of the clusters selected
    function selectClusters() public override returns (address[] memory selectedClusters) {
        uint256 nextEpoch = getCurrentEpoch() + 1;
        selectedClusters = clustersSelected[nextEpoch];

        if (selectedClusters.length == 0) {
            // select and save from the tree
            uint256 randomizer = uint256(keccak256(abi.encode(blockhash(block.number - 1), block.timestamp)));
            selectedClusters = selectTopNClusters(randomizer, numberOfClustersToSelect);
            clustersSelected[nextEpoch] = selectedClusters;
            for (uint256 index = 0; index < selectedClusters.length; index++) {
                emit ClusterSelected(nextEpoch, selectedClusters[index]);
            }

            _dispenseReward(msg.sender);
        }
    }

    /// @notice Updates the missing cluster in case epoch was not selected by anyone
    /// @notice The group of selected clusters will be selected again
    /// @param anyPreviousEpochNumber Epoch Number to fix the missing clusters
    function updateMissingClusters(uint256 anyPreviousEpochNumber) public returns (address[] memory previousSelectedClusters) {
        uint256 currentEpoch = getCurrentEpoch();
        require(anyPreviousEpochNumber < currentEpoch, "Can't update current or more epochs");
        return _updateMissingClusters(anyPreviousEpochNumber);
    }

    /// @notice Internal function to Update the missing cluster in case epoch
    /// @param anyPreviousEpochNumber Epoch Number to fix the missing clusters
    function _updateMissingClusters(uint256 anyPreviousEpochNumber) internal returns (address[] memory previousSelectedClusters) {
        if (anyPreviousEpochNumber == 0) {
            return previousSelectedClusters;
        }

        address[] memory clusters = clustersSelected[anyPreviousEpochNumber];
        if (clusters.length == 0) {
            clusters = _updateMissingClusters(anyPreviousEpochNumber - 1);
            clustersSelected[anyPreviousEpochNumber] = clusters;
        } else {
            return clusters;
        }
    }

    /// @notice Weighted random selection of N clusters
    /// @param randomizer seed for randomness
    /// @param N number of clusters to select
    /// @return selectedNodes List of addresses selected
    function selectTopNClusters(uint256 randomizer, uint256 N) public view returns (address[] memory selectedNodes) {
        uint256 totalElements = getTotalElements();
        if(N > totalElements) N = totalElements;
        MemoryNode[] memory selectedPathTree;
        // assembly block sets memory for the MemoryNode array but does not zero initialize each value of each struct
        // To ensure random values are never accessed for the MemoryNodes, we always initialize before using an array node
        assembly {
            let pos := mload(0x40)
            // 2688 is 84*32 so allocating space for 83 struct elements + 1 slot for length
            mstore(0x40, add(pos, 2688))
            // 5 paths * 17 elements max per path as totalElements < 20000 and 2 common elements among those 5 paths
            // which are root and one elements in first level, so 83 elements max
            mstore(selectedPathTree, 83)
        }

        Node memory _root = nodes[1];
        selectedPathTree[1] = MemoryNode(1, 0, 0, 0, 0, 0);

        uint256 indexOfLastElementInMemoryTree = 1;
        // added in next line to save gas and avoid overflow checks
        uint256 totalWeightInTree = _root.value;
        unchecked {
            totalWeightInTree += _root.leftSum + _root.rightSum;
        }
        uint256 _sumOfBalancesOfSelectedNodes = 0;

        selectedNodes = new address[](N);
        for (uint256 index = 0; index < N; ) {
            randomizer = uint256(keccak256(abi.encode(randomizer, index)));
            uint256 searchNumber = randomizer % (totalWeightInTree - _sumOfBalancesOfSelectedNodes);
            uint256 _node;
            uint256 _selectedNodeBalance;

            (_node, _selectedNodeBalance, , indexOfLastElementInMemoryTree) = _selectTopCluster(
                1, // index of root
                searchNumber,
                selectedPathTree,
                1,
                indexOfLastElementInMemoryTree
            );

            selectedNodes[index] = indexToAddressMap[uint32(_node)];
            unchecked {
                _sumOfBalancesOfSelectedNodes += _selectedNodeBalance;
                ++index;
            }
        }
        return selectedNodes;
    }

    /// @notice Select top N Clusters
    function _selectTopCluster(
        uint256 rootIndex,
        uint256 searchNumber,
        MemoryNode[] memory selectedPathTree,
        uint256 indexOfRootOfMemoryTree,
        uint256 indexOfLastElementInMemoryTree
    )
        internal
        view
        returns (
            uint256, // address of the selected node
            uint256, // balance of the selected node
            uint256, // index of the root of memory tree
            uint256 // updated index of the latest element in the memory tree array
        )
    {
        unchecked {
            Node memory _root = nodes[rootIndex];
            MemoryNode memory mRoot;

            uint256 index1 = _root.leftSum;
            uint256 index2 = index1 + _root.value;
            uint256 index3 = index2 + _root.rightSum;

            if (indexOfRootOfMemoryTree != 0) {
                mRoot = selectedPathTree[indexOfRootOfMemoryTree];
                (index1, index2, index3) = _getModifiedIndices(index1, index2, index3, mRoot);
            }

            if (searchNumber <= index1) {
                // seperated to  avoid stack too deep
                return
                    _searchOnLeft(
                        rootIndex,
                        searchNumber,
                        selectedPathTree,
                        mRoot.left,
                        indexOfRootOfMemoryTree,
                        indexOfLastElementInMemoryTree
                    );
            } else if (searchNumber > index1 && searchNumber <= index2) {
                if (indexOfRootOfMemoryTree == 0) {
                    ++indexOfLastElementInMemoryTree;
                    indexOfRootOfMemoryTree = indexOfLastElementInMemoryTree;
                    mRoot.node = rootIndex;
                    mRoot.balance = _root.value;
                    selectedPathTree[indexOfRootOfMemoryTree] = mRoot;
                } else {
                    selectedPathTree[indexOfRootOfMemoryTree].balance += _root.value;
                }
                return (rootIndex, _root.value, indexOfRootOfMemoryTree, indexOfLastElementInMemoryTree);
            } else if (searchNumber > index2 && searchNumber <= index3) {
                // seperated to  avoid stack too deep
                return
                    _searchOnRight(
                        rootIndex,
                        searchNumber - index2,
                        selectedPathTree,
                        mRoot.right,
                        indexOfRootOfMemoryTree,
                        indexOfLastElementInMemoryTree
                    );
            } else {
                revert("search number is more than weight");
            }
        }
    }

    function _searchOnLeft(
        uint256 rootIndex,
        uint256 searchNumber,
        MemoryNode[] memory selectedPathTree,
        uint256 mRootLeft,
        uint256 indexOfRootOfMemoryTree,
        uint256 indexOfLastElementInMemoryTree
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        unchecked {
            (uint256 _sCluster, uint256 _sBalance, uint256 _lastIndexMTree, uint256 _mTreeSize) = _selectTopCluster(
                rootIndex * 2, // left node
                searchNumber,
                selectedPathTree,
                mRootLeft,
                indexOfLastElementInMemoryTree
            );
            if (indexOfRootOfMemoryTree == 0) {
                indexOfRootOfMemoryTree = _lastIndexMTree + 1;
                ++_mTreeSize;
                selectedPathTree[indexOfRootOfMemoryTree] = MemoryNode(rootIndex, 0, 0, 0, 0, 0);
            }
            if (mRootLeft == 0) {
                selectedPathTree[indexOfRootOfMemoryTree].left = _lastIndexMTree;
            }
            selectedPathTree[indexOfRootOfMemoryTree].sumOfLeftBalances += _sBalance;
            return (_sCluster, _sBalance, indexOfRootOfMemoryTree, _mTreeSize);
        }
    }

    function _searchOnRight(
        uint256 rootIndex,
        uint256 searchNumber,
        MemoryNode[] memory selectedPathTree,
        uint256 mRootRight,
        uint256 indexOfRootOfMemoryTree,
        uint256 indexOfLastElementInMemoryTree
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        unchecked {
            (uint256 _sCluster, uint256 _sBalance, uint256 _lastIndexMTree, uint256 _mTreeSize) = _selectTopCluster(
                rootIndex * 2 + 1, // right node
                searchNumber,
                selectedPathTree,
                mRootRight,
                indexOfLastElementInMemoryTree
            );
            if (indexOfRootOfMemoryTree == 0) {
                indexOfRootOfMemoryTree = _lastIndexMTree + 1;
                ++_mTreeSize;
                selectedPathTree[indexOfRootOfMemoryTree] = MemoryNode(rootIndex, 0, 0, 0, 0, 0);
            }
            if (mRootRight == 0) {
                selectedPathTree[indexOfRootOfMemoryTree].right = _lastIndexMTree;
            }
            selectedPathTree[indexOfRootOfMemoryTree].sumOfRightBalances += _sBalance;
            return (_sCluster, _sBalance, indexOfRootOfMemoryTree, _mTreeSize);
        }
    }

    /// @notice calculates the updated indices for picking direction of tree traversal
    /// @dev removes selected node weights from indices for selecting left center and right
    /// @param index1 index to pick left
    /// @param index2 index to pick center
    /// @param index3 index to pick right
    /// @param mNode cummulative weights of selected nodes to be removed from the current indices
    /// @return mIndex1 updated index to pick left
    /// @return mIndex2 updated index to pick center
    /// @return mIndex3 updated index to pick right
    function _getModifiedIndices(
        uint256 index1,
        uint256 index2,
        uint256 index3,
        MemoryNode memory mNode
    )
        internal
        pure
        returns (
            uint256 mIndex1,
            uint256 mIndex2,
            uint256 mIndex3
        )
    {
        mIndex1 = index1 - (mNode.sumOfLeftBalances);
        mIndex2 = index2 - (mNode.sumOfLeftBalances + mNode.balance);
        mIndex3 = index3 - (mNode.sumOfLeftBalances + mNode.balance + mNode.sumOfRightBalances);
    }

    //-------------------------------- Cluster Selection ends --------------------------------//

    //-------------------------------- Tree interactions starts --------------------------------//

    function upsert(address newNode, uint64 balance) external onlyRole(UPDATER_ROLE) {
        _upsert(newNode, balance);
    }

    function upsertMultiple(address[] calldata newNodes, uint64[] calldata balances) external onlyRole(UPDATER_ROLE) {
        for(uint256 i=0; i < newNodes.length; i++) {
            _upsert(newNodes[i], balances[i]);
        }
    }

    function insert(address newNode, uint64 balance) external onlyRole(UPDATER_ROLE) {
        _insert(newNode, balance);
    }

    function insertMultiple(address[] calldata newNodes, uint64[] calldata balances) external onlyRole(UPDATER_ROLE) {
        for(uint256 i=0; i < newNodes.length; i++) {
            _insert(newNodes[i], balances[i]);
        }
    }

    function update(address node, uint64 balance) external onlyRole(UPDATER_ROLE) {
        require(node != address(0));
        _update(addressToIndexMap[node], balance);
    }

    function deleteNode(address node) external onlyRole(UPDATER_ROLE) {
        require(node != address(0));
        _delete(addressToIndexMap[node]);
    }

    function deleteNodeIfPresent(address node) external onlyRole(UPDATER_ROLE) returns(bool) {
        require(node != address(0));
        uint256 _index = addressToIndexMap[node];

        if(_index != 0) {
            _delete(_index);
            return true;
        }

        return false;
    }

    //-------------------------------- Tree interactions ends --------------------------------//

    //-------------------------------- Admin functions starts --------------------------------//

    /// @inheritdoc IEpochSelector
    function updateNumberOfClustersToSelect(uint256 _numberOfClusters) external override onlyRole(ADMIN_ROLE) {
        require(_numberOfClusters != 0 && numberOfClustersToSelect != _numberOfClusters, "Should be a valid number");
        numberOfClustersToSelect = _numberOfClusters;
        emit UpdateNumberOfClustersToSelect(_numberOfClusters);
    }

    /// @notice Updates the reward token
    /// @param _rewardToken Address of the reward token
    function updateRewardToken(address _rewardToken) external onlyRole(REWARD_CONTROLLER_ROLE) {
        require(_rewardToken == rewardToken, "Update reward token");
        rewardToken = _rewardToken;
        emit UpdateRewardToken(_rewardToken);
    }

    function _dispenseReward(address _to) internal {
        if (rewardForSelectingClusters != 0) {
            IERC20Upgradeable _rewardToken = IERC20Upgradeable(rewardToken);
            if (_rewardToken.balanceOf(address(this)) >= rewardForSelectingClusters) {
                _rewardToken.safeTransfer(_to, rewardForSelectingClusters);
            }
        }
    }

    function flushTokens(address token, address to) external onlyRole(REWARD_CONTROLLER_ROLE) {
        IERC20Upgradeable _token = IERC20Upgradeable(token);

        uint256 remaining = _token.balanceOf(address(this));
        if (remaining > 0) {
            _token.safeTransfer(to, remaining);
        }
    }

    //-------------------------------- Admin functions ends --------------------------------//

    // @dev Clusters are selected only for next epoch in this epoch using selectClusters method.
    //      If the method is not called within the previous epoch, then the last selected clusters
    //      are considered as selected for this epoch
    function getClusters(uint256 epochNumber) public view returns (address[] memory) {
        uint256 _nextEpoch = getCurrentEpoch() + 1;
        // To ensure invalid data is not provided for epochs where clusters are not selected
        require(epochNumber <= _nextEpoch, Errors.CLUSTER_SELECTION_NOT_COMPLETE);
        if (epochNumber == 0) {
            return new address[](0);
        }
        address[] memory clusters = clustersSelected[epochNumber];

        if (clusters.length == 0) {
            require(epochNumber != _nextEpoch, Errors.CLUSTER_SELECTION_NOT_COMPLETE);
            return getClusters(epochNumber - 1);
        } else {
            return clusters;
        }
    }
}
