// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SelectorHelper.sol";
import "../interfaces/IEpochSelector.sol";

/// @title Contract to select the top 5 clusters in an epoch
contract EpochSelector is SelectorHelper, IEpochSelector {
    using SafeERC20 for IERC20;

    struct MemoryNode {
        uint256 node; // sorting condition
        uint256 balance;
        uint256 left;
        uint256 sumOfLeftBalances;
        uint256 right;
        uint256 sumOfRightBalances;
    }

    /// @notice length of epoch
    uint256 public constant EPOCH_LENGTH = 4 hours;

    /// @notice ID for reward control
    bytes32 public constant REWARD_CONTROLLER_ROLE = keccak256(abi.encode("reward-control"));

    /// @notice timestamp when the selector starts
    uint256 public immutable START_TIME;

    /// @notice Number of clusters selected in every epoch
    uint256 public numberOfClustersToSelect;

    /// @notice clusters selected during each epoch
    mapping(uint256 => address[]) private clustersSelected;

    /// @notice Reward that the msg.sender recevies when cluster are selected for the epoch;
    uint256 public rewardForSelectingClusters;

    /// @notice Reward Token
    address public rewardToken;

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

    function deleteNodeIfPresent(address key) public override(IEpochSelector, SelectorHelper) returns (bool) {
        return SelectorHelper.deleteNodeIfPresent(key);
    }

    constructor(
        address _admin,
        uint256 _numberOfClustersToSelect,
        uint256 _startTime,
        address _rewardToken,
        uint256 _rewardForSelectingClusters
    ) SelectorHelper(_admin) {
        START_TIME = _startTime;
        numberOfClustersToSelect = _numberOfClustersToSelect;

        AccessControl._setRoleAdmin(REWARD_CONTROLLER_ROLE, ADMIN_ROLE);
        AccessControl._grantRole(REWARD_CONTROLLER_ROLE, _admin);

        rewardToken = _rewardToken;
        rewardForSelectingClusters = _rewardForSelectingClusters;
    }

    function getTotalElements() public view override returns (uint256) {
        return totalElements;
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
        if(N > totalElements) N = totalElements;
        MemoryNode[] memory selectedPathTree;
        // assembly block sets memory for the MemoryNode array but does not zero initialize each value of each struct
        // To ensure random values are never accessed for the MemoryNodes, we always initialize before using an array node
        assembly {
            let pos := mload(0x40)
            mstore(0x40, add(pos, 2688))
            mstore(selectedPathTree, 83)
        }

        Node memory _root = nodes[root];
        selectedPathTree[1] = MemoryNode(_root.node, 0, 0, 0, 0, 0);

        uint256 indexOfLastElementInMemoryTree = 1;
        // added in next line to save gas and avoid overflow checks
        uint256 totalWeightInTree = _root.balance;
        unchecked {
            totalWeightInTree += _root.sumOfLeftBalances + _root.sumOfRightBalances;
        }
        uint256 _sumOfBalancesOfSelectedNodes = 0;

        selectedNodes = new address[](N);
        for (uint256 index = 0; index < N; ) {
            randomizer = uint256(keccak256(abi.encode(randomizer, index)));
            uint256 searchNumber = randomizer % (totalWeightInTree - _sumOfBalancesOfSelectedNodes);
            uint256 _node;
            uint256 _selectedNodeBalance;

            (_node, _selectedNodeBalance, , indexOfLastElementInMemoryTree) = _selectTopCluster(
                root,
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
        uint32 rootIndex,
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

            uint256 index1 = _root.sumOfLeftBalances;
            uint256 index2 = index1 + _root.balance;
            uint256 index3 = index2 + _root.sumOfRightBalances;

            if (indexOfRootOfMemoryTree != 0) {
                mRoot = selectedPathTree[indexOfRootOfMemoryTree];
                (index1, index2, index3) = _getModifiedIndices(index1, index2, index3, mRoot);
            }

            if (searchNumber <= index1) {
                // seperated to  avoid stack too deep
                return
                    _searchOnLeft(
                        _root,
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
                    mRoot.node = _root.node;
                    mRoot.balance = _root.balance;
                    selectedPathTree[indexOfRootOfMemoryTree] = mRoot;
                } else {
                    selectedPathTree[indexOfRootOfMemoryTree].balance += _root.balance;
                }
                return (_root.node, _root.balance, indexOfRootOfMemoryTree, indexOfLastElementInMemoryTree);
            } else if (searchNumber > index2 && searchNumber <= index3) {
                // seperated to  avoid stack too deep
                return
                    _searchOnRight(
                        _root,
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
        Node memory root,
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
                root.left,
                searchNumber,
                selectedPathTree,
                mRootLeft,
                indexOfLastElementInMemoryTree
            );
            if (indexOfRootOfMemoryTree == 0) {
                indexOfRootOfMemoryTree = _lastIndexMTree + 1;
                ++_mTreeSize;
                selectedPathTree[indexOfRootOfMemoryTree] = MemoryNode(root.node, 0, 0, 0, 0, 0);
            }
            if (mRootLeft == 0) {
                selectedPathTree[indexOfRootOfMemoryTree].left = _lastIndexMTree;
            }
            selectedPathTree[indexOfRootOfMemoryTree].sumOfLeftBalances += _sBalance;
            return (_sCluster, _sBalance, indexOfRootOfMemoryTree, _mTreeSize);
        }
    }

    function _searchOnRight(
        Node memory root,
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
                root.right,
                searchNumber,
                selectedPathTree,
                mRootRight,
                indexOfLastElementInMemoryTree
            );
            if (indexOfRootOfMemoryTree == 0) {
                indexOfRootOfMemoryTree = _lastIndexMTree + 1;
                ++_mTreeSize;
                selectedPathTree[indexOfRootOfMemoryTree] = MemoryNode(root.node, 0, 0, 0, 0, 0);
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
            IERC20 _rewardToken = IERC20(rewardToken);
            if (_rewardToken.balanceOf(address(this)) >= rewardForSelectingClusters) {
                _rewardToken.safeTransfer(_to, rewardForSelectingClusters);
            }
        }
    }

    function flushTokens(address token, address to) external onlyRole(REWARD_CONTROLLER_ROLE) {
        IERC20 _token = IERC20(token);

        uint256 remaining = _token.balanceOf(address(this));
        if (remaining > 0) {
            _token.safeTransfer(to, remaining);
        }
    }

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
