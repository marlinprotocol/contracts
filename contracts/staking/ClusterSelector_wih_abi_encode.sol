// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ClusterSelectorHelper/SimpleSelector.sol";

contract ClusterSelector is SingleSelector {
    using ClusterLib for address[];
    using ClusterLib for bytes;

    constructor() SingleSelector() {}

    /// @notice Select top N clusters
    /// @return List of addresses selected
    function selectTopNClusters(uint256 randomizer, uint256 N) public view returns (address[] memory) {
        require(N <= totalElements, ClusterLib.INSUFFICIENT_ELEMENTS_IN_TREE);

        bytes memory _emptyPath = abi.encode(new address[](0));
        address[] memory selectedNodes = new address[](N);
        bytes[] memory pathToSelectedNodes = new bytes[](N);

        for (uint256 index = 0; index < N; index++) {
            pathToSelectedNodes[index] = _emptyPath;
        }

        Node memory _root = nodes[root];
        uint256 totalWeightInTree = _getTotalBalancesIncludingWeight(_root);
        uint256 _sumOfBalancesOfSelectedNodes;

        for (uint256 index = 0; index < N; index++) {
            randomizer = uint256(keccak256(abi.encode(randomizer, index)));
            uint256 searchNumber = randomizer % (totalWeightInTree - _sumOfBalancesOfSelectedNodes);
            // console2.log("============= search number in iter", index, searchNumber);
            // console2.log("============= _sumOfBalancesOfSelectedNodes", _sumOfBalancesOfSelectedNodes);

            bytes memory currentPath = _emptyPath;
            (address _node, uint256 _selectedNodeBalance, bytes memory _path) = _selectTopCluster(
                root,
                searchNumber,
                selectedNodes,
                pathToSelectedNodes,
                currentPath,
                0
            );

            selectedNodes[index] = _node;
            pathToSelectedNodes[index] = _path;

            _sumOfBalancesOfSelectedNodes += _selectedNodeBalance;
            // console2.log("length of path selected", _path.length);
            // _printArray("path that I need to check", pathToSelectedNodes[index]);
        }
        return selectedNodes;
    }

    /// @notice Select top N Clusters
    /// @param _root Address of the current node (which is referred as root here)
    /// @param searchNumber a random number used to navigate through the tree
    /// @param selectedNodes List of already selected nodes. This node have to ignored while traversing the tree
    /// @param pathsToSelectedNodes Paths to the selected nodes.
    /// @param currentNodePath Stores the current path to the selected node from the root
    /// @param  parentIndex Distance of the selected node from the root
    /// @return Address of the selected node
    /// @return Balance of selected node
    /// @return Path to the selected node
    function _selectTopCluster(
        address _root,
        uint256 searchNumber,
        address[] memory selectedNodes,
        bytes[] memory pathsToSelectedNodes,
        bytes memory currentNodePath,
        uint256 parentIndex
    )
        internal
        view
        returns (
            address,
            uint256,
            bytes memory
        )
    {
        // console2.log("====================================================================================");
        // console2.log("finding cluster", _root);
        // console2.log("searchNumber", searchNumber);
        // console2.log("parentIndex", parentIndex);
        // _printNode(_root);
        // console2.log("length of parent path", currentNodePath.length);
        // _printArray("Selected clusters", selectedNodes);
        // _printPaths("paths to selected clusters", pathsToSelectedNodes);

        Node memory node = nodes[_root];
        // stored in existing variable to conserve memory
        (node.sumOfLeftBalances, node.sumOfRightBalances) = _getModifiedWeightes(node, selectedNodes, pathsToSelectedNodes);

        // console2.log("leftWeight used for search", leftWeight);
        // console2.log("rightWeight used for searching", rightWeight);

        // if the node is already selected, movie either to left or right
        if (selectedNodes.ifArrayHasElement(_root)) {
            // console2.log("_root is already selected", _root);
            // console2.log("searchNumber", searchNumber);
            // _printArray("selected nodes this _root", selectedNodes);

            (uint256 index1, , uint256 index2) = ClusterLib._getIndexesWithWeights(node.sumOfLeftBalances, 0, node.sumOfRightBalances);

            // console2.log("leftWeight", leftWeight);
            // console2.log("node.balance", node.balance);
            // console2.log("rightWeight", rightWeight);
            // console2.log("index1", index1);
            // console2.log("index2", index2);

            currentNodePath = currentNodePath._addAddressToEncodedArray(_root);
            parentIndex++;

            if (searchNumber <= index1) {
                // console2.log(_root, "Selected and moved to left");
                return _selectTopCluster(node.left, searchNumber, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                // console2.log(_root, "Selected and moved to right");
                return
                    _selectTopCluster(node.right, searchNumber - index1, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else {
                revert(ClusterLib.ERROR_OCCURED_DURING_TRAVERSING_SELECTED_NODE);
            }
        }
        // if not selected then, check if it lies between the indexes
        else {
            // console2.log("_root is not selected", _root);
            // console2.log("searchNumber", searchNumber);
            // _printArray("selected nodes this _root", selectedNodes);
            (uint256 index1, uint256 index2, uint256 index3) = ClusterLib._getIndexesWithWeights(
                node.sumOfLeftBalances,
                node.balance,
                node.sumOfRightBalances
            );

            // console2.log("leftWeight", leftWeight);
            // console2.log("node.balance", node.balance);
            // console2.log("rightWeight", rightWeight);
            // console2.log("index1", index1);

            currentNodePath = currentNodePath._addAddressToEncodedArray(_root);
            parentIndex++;

            if (searchNumber <= index1) {
                // console2.log(_root, "Not select and moved to left");
                return _selectTopCluster(node.left, searchNumber, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                // console2.log(_root, "Wow!, Selected");
                return (_root, node.balance, currentNodePath);
            } else if (searchNumber > index2 && searchNumber <= index3) {
                // console2.log(_root, "Not select and moved to right");
                return
                    _selectTopCluster(node.right, searchNumber - index2, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else {
                revert(ClusterLib.ERROR_OCCURED_DURING_TRAVERSING_NON_SELECTED_NODE);
            }
        }
    }

    /// @notice When a node is selected, the left and right weights have to be reduced in memory
    /// @param node Node to reduce the weights
    /// @param selectedNodes List of selected nodes
    /// @param pathsToSelectedNodes Paths to the selected nodes
    /// @return leftWeight reduced left weight of the node
    /// @return rightWeight reduced right weight of the node
    function _getModifiedWeightes(
        Node memory node,
        address[] memory selectedNodes,
        bytes[] memory pathsToSelectedNodes
    ) internal view returns (uint96 leftWeight, uint96 rightWeight) {
        leftWeight = node.sumOfLeftBalances;
        rightWeight = node.sumOfRightBalances;

        for (uint256 index = 0; index < selectedNodes.length; index++) {
            address[] memory _pathsToSelectedNodes = ClusterLib._getAddressesFromEncodedArray(pathsToSelectedNodes[index]);

            if (_pathsToSelectedNodes.ifArrayHasElement(node.left)) {
                Node memory selectedNode = nodes[selectedNodes[index]];
                leftWeight -= selectedNode.balance;
            }

            if (_pathsToSelectedNodes.ifArrayHasElement(node.right)) {
                Node memory selectedNode = nodes[selectedNodes[index]];
                rightWeight -= selectedNode.balance;
            }
        }
    }
}
