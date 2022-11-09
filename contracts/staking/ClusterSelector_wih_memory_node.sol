// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ClusterSelectorHelper/SimpleSelector.sol";
import "./ClusterSelectorHelper/MemoryTree.sol";

contract ClusterSelector is SingleSelector {
    using ClusterLib for uint32[];
    using ClusterLib for uint256[];
    using ClusterLib for address[];
    using ClusterLib for bytes;

    constructor() SingleSelector() {}

    /// @notice Select top N clusters
    /// @return List of addresses selected
    function selectTopNClusters(uint32 randomizer, uint256 N) public view returns (address[] memory) {
        // TODO: Remove totalElements var, return all existing nodes if totalElements <= N
        require(N <= totalElements, ClusterLib.INSUFFICIENT_ELEMENTS_IN_TREE);
        // TODO: Just declare and do not initialize directly(use assembly) as that costs way more because of 0 init
        uint256[] memory selectedNodes = new uint256[](N);
        // TODO: Initialize using assembly with 1(0th index is empty) + 17*5 - 3(min common nodes) nodes as that is the max possible
        MemoryTree.MemoryNode[] memory selectedPathTree = new MemoryTree.MemoryNode[](85);
        // MemoryTree.create(selectedPathTree, 85);

        Node memory _root = nodes[root];
        
        selectedPathTree[1] = MemoryTree.MemoryNode(_root.node, 0, 0, 0, 0, 0);
        uint256 indexOfLastElementInMemoryTree = 1;
        // TODO: use uint256 instead, saves gas
        uint32 totalWeightInTree = _root.sumOfLeftBalances + _root.balance + _root.sumOfRightBalances;
        // TODO: use uint256 instead, saves gas
        uint32 _sumOfBalancesOfSelectedNodes;

        for (uint256 index = 0; index < N; index++) {
            // console2.log("selecting", index, N);
            randomizer = uint32(uint256(keccak256(abi.encode(randomizer, index))));
            // TODO: use uint256 instead, increases range of random number thus harder to manipulate
            uint32 searchNumber = randomizer % (totalWeightInTree - _sumOfBalancesOfSelectedNodes);

            // console2.log("memTreeSize at start", indexOfLastElementInMemoryTree);

            (
                uint32 _node,
                uint32 _selectedNodeBalance,
                ,
                uint256 _indexOfLastElementInMemoryTree
            ) = _selectTopCluster(root, searchNumber, selectedPathTree, 1, indexOfLastElementInMemoryTree);

            // console2.log("memTreeSize", _indexOfLastElementInMemoryTree, indexOfLastElementInMemoryTree);

            indexOfLastElementInMemoryTree = _indexOfLastElementInMemoryTree;
            selectedNodes[index] = _node;
            _sumOfBalancesOfSelectedNodes += _selectedNodeBalance;
        }

        address[] memory sn = new address[](N);
        for (uint256 index = 0; index < N; index++) {
            sn[index] = indexToAddressMap[uint32(selectedNodes[index])];
        }
        return sn;
    }

    /// @notice Select top N Clusters
    function _selectTopCluster(
        uint32 rootIndex,
        uint32 searchNumber,
        MemoryTree.MemoryNode[] memory selectedPathTree,
        uint256 indexOfRootOfMemoryTree,
        uint256 indexOfLastElementInMemoryTree
    )
        internal
        view
        returns (
            uint32, // address of the selected node
            uint32, // balance of the selected node
            // MemoryTree.MemoryNode[] memory paths, // paths to selected nodes // memory tree
            uint256, // updated index of the latest element in the memory tree,
            uint256
        )
    {
        // if not selected then, check if it lies between the indexes
        // console2.log("at", rootIndex, indexOfRootOfMemoryTree);
        Node memory root = nodes[rootIndex];
        MemoryTree.MemoryNode memory mRoot = selectedPathTree[indexOfRootOfMemoryTree];

        (root.balance, root.sumOfLeftBalances, root.sumOfRightBalances) = _getModifiedWeights(root, mRoot);   

        uint256 index1 = root.sumOfLeftBalances;
        uint256 index2 = index1 + root.balance;
        uint256 index3 = index2 + root.sumOfRightBalances;

        // console2.log(index1, index2, index3, searchNumber);

        if (searchNumber <= index1) {
            // console2.log("going left to", root.left, mRoot.left);
            return _searchOnLeft(root, searchNumber, selectedPathTree, mRoot, indexOfRootOfMemoryTree, indexOfLastElementInMemoryTree);
        } else if (searchNumber > index1 && searchNumber <= index2) {
            // console2.log("found it");
            if(mRoot.node == 0) {
                indexOfLastElementInMemoryTree++;
                // console2.log("inserting new selected", indexOfLastElementInMemoryTree, root.node);
                indexOfRootOfMemoryTree = indexOfLastElementInMemoryTree;
                selectedPathTree[indexOfRootOfMemoryTree].node = root.node;
            }
            selectedPathTree[indexOfRootOfMemoryTree].balance += root.balance;
            // console2.log(selectedPathTree[indexOfRootOfMemoryTree].node, selectedPathTree[indexOfRootOfMemoryTree].left, selectedPathTree[indexOfRootOfMemoryTree].right);
            return (root.node, root.balance, indexOfRootOfMemoryTree, indexOfLastElementInMemoryTree);
        } else if (searchNumber > index2 && searchNumber <= index3) {
            // console2.log("going right to", root.right, mRoot.right);
            return _searchOnRight(root, searchNumber - uint32(index2), selectedPathTree, mRoot, indexOfRootOfMemoryTree, indexOfLastElementInMemoryTree);
        }
    }

    function _searchOnLeft(
        Node memory root, 
        uint32 searchNumber, 
        MemoryTree.MemoryNode[] memory selectedPathTree,
        MemoryTree.MemoryNode memory mRoot,
        uint256 indexOfRootOfMemoryTree,
        uint256 indexOfLastElementInMemoryTree
    ) internal view returns (
        uint32,
        uint32,
        uint256,
        uint256
    ){
        (uint32 _sCluster, uint32 _sBalance, uint256 _lastIndexMTree, uint256 _mTreeSize) = _selectTopCluster(root.left, searchNumber, selectedPathTree, mRoot.left, indexOfLastElementInMemoryTree);
        if(indexOfRootOfMemoryTree == 0) {
            indexOfRootOfMemoryTree = _lastIndexMTree + 1;
            _mTreeSize++;
            // console2.log("inserting new left", _lastIndexMTree + 1, root.node);
            selectedPathTree[indexOfRootOfMemoryTree].node = root.node;
            // MemoryTree.insert(selectedPathTree, _lastIndexMTree, root.node, 0, true);
        }
        if(mRoot.left == 0) {
            // console2.log("updating left", root.left, selectedPathTree[_lastIndexMTree].node);
            selectedPathTree[indexOfRootOfMemoryTree].left = _lastIndexMTree;
        }
        selectedPathTree[indexOfRootOfMemoryTree].sumOfLeftBalances += _sBalance;
        // console2.log("node", selectedPathTree[indexOfRootOfMemoryTree].node, selectedPathTree[indexOfRootOfMemoryTree].left, selectedPathTree[indexOfRootOfMemoryTree].right);
        return (_sCluster, _sBalance, indexOfRootOfMemoryTree, _mTreeSize);
    }

    function _searchOnRight(
        Node memory root, 
        uint32 searchNumber, 
        MemoryTree.MemoryNode[] memory selectedPathTree,
        MemoryTree.MemoryNode memory mRoot,
        uint256 indexOfRootOfMemoryTree,
        uint256 indexOfLastElementInMemoryTree
    ) internal view returns (
        uint32,
        uint32,
        uint256,
        uint256
    ){
        (uint32 _sCluster, uint32 _sBalance, uint256 _lastIndexMTree, uint256 _mTreeSize) = _selectTopCluster(root.right, searchNumber, selectedPathTree, mRoot.right, indexOfLastElementInMemoryTree);
        if(indexOfRootOfMemoryTree == 0) {
            // console2.log("inserting new right", _lastIndexMTree + 1, root.node);
            indexOfRootOfMemoryTree = _lastIndexMTree + 1;
            _mTreeSize++;
            selectedPathTree[indexOfRootOfMemoryTree].node = root.node;
            // MemoryTree.insert(selectedPathTree, _lastIndexMTree, root.node, 0, true);
        }
        if(mRoot.right == 0) {
            // console2.log("updating right", root.right, selectedPathTree[_lastIndexMTree].node);
            selectedPathTree[indexOfRootOfMemoryTree].right = _lastIndexMTree;
        }
        selectedPathTree[indexOfRootOfMemoryTree].sumOfRightBalances += _sBalance;
        // console2.log("node", selectedPathTree[indexOfRootOfMemoryTree].node, selectedPathTree[indexOfRootOfMemoryTree].left, selectedPathTree[indexOfRootOfMemoryTree].right);
        return (_sCluster, _sBalance, indexOfRootOfMemoryTree, _mTreeSize);
    }

    /// @notice When a node is selected, the left and right weights have to be reduced in memory
    /// @param node Node to reduce the weights
    /// @return balance updated balance of the node
    /// @return leftWeight reduced left weight of the node
    /// @return rightWeight reduced right weight of the node
    function _getModifiedWeights(Node memory node, MemoryTree.MemoryNode memory mNode)
        internal
        view
        returns (uint32 balance, uint32 leftWeight, uint32 rightWeight)
    {
        leftWeight = node.sumOfLeftBalances;
        rightWeight = node.sumOfRightBalances;
        balance = node.balance;

        if (mNode.node != 0) {
            // console2.log("decreasing weights by", mNode.balance, mNode.sumOfLeftBalances, mNode.sumOfRightBalances);
            leftWeight -= uint32(mNode.sumOfLeftBalances);
            rightWeight -= uint32(mNode.sumOfRightBalances);
            // console2.log(balance, mNode.balance);
            balance -= uint32(mNode.balance);
        }
    }
}
