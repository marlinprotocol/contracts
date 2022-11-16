// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SimpleSelector.sol";

contract ClusterSelector is SingleSelector {
    struct MemoryNode {
        uint256 node; // sorting condition
        uint256 balance;
        uint256 left;
        uint256 sumOfLeftBalances;
        uint256 right;
        uint256 sumOfRightBalances;
    }

    constructor() SingleSelector() {}

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
        // TODO: use uint256
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
}
