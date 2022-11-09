// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ClusterSelectorHelper/SimpleSelector.sol";

contract ClusterSelector is SingleSelector {
    using ClusterLib for uint32[];
    using ClusterLib for address[];
    using ClusterLib for bytes;

    constructor() SingleSelector() {}

    /// @notice Select top N clusters
    /// @return List of addresses selected
    function selectTopNClusters(uint32 randomizer, uint256 N) public view returns (address[] memory) {
        require(N <= totalElements, ClusterLib.INSUFFICIENT_ELEMENTS_IN_TREE);

        uint32[] memory selectedNodes = new uint32[](N);
        uint32[] memory balancesOfSelectedNodes = new uint32[](N);
        uint32[17][] memory pathToSelectedNodes = new uint32[17][](N);
        uint256[] memory pidxs = new uint256[](N);

        Node memory _root = nodes[root];
        uint32 totalWeightInTree = _getTotalBalancesIncludingWeight(_root);
        uint32 _sumOfBalancesOfSelectedNodes;

        for (uint256 index = 0; index < N; index++) {
            randomizer = uint32(uint256(keccak256(abi.encode(randomizer, index))));
            uint32 searchNumber = randomizer % (totalWeightInTree - _sumOfBalancesOfSelectedNodes);

            (uint32 _node, uint32 _selectedNodeBalance) = _selectTopCluster(
                root,
                searchNumber,
                selectedNodes,
                balancesOfSelectedNodes,
                pathToSelectedNodes,
                pidxs,
                index
            );

            selectedNodes[index] = _node;
            balancesOfSelectedNodes[index] = _selectedNodeBalance;
            _sumOfBalancesOfSelectedNodes += _selectedNodeBalance;
        }

        address[] memory sn = new address[](N);
        for (uint256 index = 0; index < N; index++) {
            sn[index] = indexToAddressMap[selectedNodes[index]];
        }
        return sn;
    }

    /// @notice Select top N Clusters
    /// @param _root Address of the current node (which is referred as root here)
    /// @param searchNumber a random number used to navigate the tree
    /// @param selectedNodes List of already selected nodes. This node have to ignored while traversing the tree
    /// @param pathsToSelectedNodes Paths to the selected nodes.
    /// @return Address of the selected node
    /// @return Balance of selected node
    function _selectTopCluster(
        uint32 _root,
        uint32 searchNumber,
        uint32[] memory selectedNodes,
        uint32[] memory balancesOfSelectedNodes,
        uint32[17][] memory pathsToSelectedNodes,
        uint256[] memory pidxs,
        uint256 index
    ) internal view returns (uint32, uint32) {
        Node memory node = nodes[_root];
        // stored in existing variable to conserve memory
        (node.sumOfLeftBalances, node.sumOfRightBalances) = _getModifiedWeights(
            node,
            balancesOfSelectedNodes,
            pathsToSelectedNodes,
            pidxs,
            index
        );
        // if the node is already selected, movie either to left or right
        if (selectedNodes.ifArrayHasElement(_root)) {
            (uint32 index1, , uint32 index2) = ClusterLib._getIndexesWithWeights(node.sumOfLeftBalances, 0, node.sumOfRightBalances);

            pathsToSelectedNodes[index][pidxs[index]] = _root;
            pidxs[index]++;

            if (searchNumber <= index1) {
                return
                    _selectTopCluster(node.left, searchNumber, selectedNodes, balancesOfSelectedNodes, pathsToSelectedNodes, pidxs, index);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                return
                    _selectTopCluster(
                        node.right,
                        searchNumber - index1,
                        selectedNodes,
                        balancesOfSelectedNodes,
                        pathsToSelectedNodes,
                        pidxs,
                        index
                    );
            } else {
                revert(ClusterLib.ERROR_OCCURED_DURING_TRAVERSING_SELECTED_NODE);
            }
        }
        // if not selected then, check if it lies between the indexes
        else {
            // console2.log("_root is not selected", _root);
            // console2.log("searchNumber", searchNumber);
            // _printArray("selected nodes this _root", selectedNodes);
            (uint32 index1, uint32 index2, uint32 index3) = ClusterLib._getIndexesWithWeights(
                node.sumOfLeftBalances,
                node.balance,
                node.sumOfRightBalances
            );

            pathsToSelectedNodes[index][pidxs[index]] = _root;
            pidxs[index]++;

            if (searchNumber <= index1) {
                return
                    _selectTopCluster(node.left, searchNumber, selectedNodes, balancesOfSelectedNodes, pathsToSelectedNodes, pidxs, index);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                return (_root, node.balance);
            } else if (searchNumber > index2 && searchNumber <= index3) {
                return
                    _selectTopCluster(
                        node.right,
                        searchNumber - index2,
                        selectedNodes,
                        balancesOfSelectedNodes,
                        pathsToSelectedNodes,
                        pidxs,
                        index
                    );
            } else {
                revert(ClusterLib.ERROR_OCCURED_DURING_TRAVERSING_NON_SELECTED_NODE);
            }
        }
    }

    /// @notice When a node is selected, the left and right weights have to be reduced in memory
    /// @param node Node to reduce the weights
    /// @param balancesOfSelectedNodes balance of selected nodes
    /// @param pathsToSelectedNodes Paths to the selected nodes
    /// @return leftWeight reduced left weight of the node
    /// @return rightWeight reduced right weight of the node
    function _getModifiedWeights(
        Node memory node,
        uint32[] memory balancesOfSelectedNodes,
        uint32[17][] memory pathsToSelectedNodes,
        uint256[] memory pidxs,
        uint256 _index
    ) internal pure returns (uint32 leftWeight, uint32 rightWeight) {
        leftWeight = node.sumOfLeftBalances;
        rightWeight = node.sumOfRightBalances;

        for (uint256 index = 0; index < _index; index++) {
            uint32[17] memory _pathsToSelectedNodes = pathsToSelectedNodes[index];

            for (uint256 _idx = 0; _idx < pidxs[index]; _idx++) {
                if (_pathsToSelectedNodes[_idx] == node.left) {
                    leftWeight -= balancesOfSelectedNodes[index];
                    break;
                } else if (_pathsToSelectedNodes[_idx] == node.right) {
                    rightWeight -= balancesOfSelectedNodes[index];
                    break;
                }
            }
        }
    }
}
