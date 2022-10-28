// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./SelectorHelper.sol";

contract SingleSelector is SelectorHelper {
    constructor() {}

    /// @inheritdoc IClusterSelector
    function insert(address newNode, uint96 balance) public virtual override {
        require(newNode != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[newNode];
        if (node.node == address(0)) {
            root = _insert(root, newNode, balance);
            totalElements++;
        } else {
            // int256 differenceInKeyBalance = int256(clusterBalance) - int256(node.balance);
            _update(root, newNode, int96(balance) - int96(node.balance));
        }
    }

    /// @inheritdoc IClusterSelector
    function insertMultiple(address[] calldata newNodes, uint96[] calldata balances) public virtual override {
        require(newNodes.length == balances.length, "arity mismatch");
        for (uint256 index = 0; index < newNodes.length; index++) {
            insert(newNodes[index], balances[index]);
        }
    }

    /// @inheritdoc IClusterSelector
    function deleteNode(address key) public virtual override {
        require(key != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[key];
        require(node.node == key, ClusterLib.NODE_NOT_PRESENT_IN_THE_TREE);
        if (node.node == key) {
            // delete node
            (root) = _deleteNode(root, key, node.balance);
            totalElements--;
        }
    }

    /// @inheritdoc IClusterSelector
    function update(address existingNode, uint96 newBalance) public virtual override {
        require(existingNode != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        if (nodes[existingNode].node == address(0)) {
            assert(false);
        } else {
            int96 differenceInKeyBalance = int96(newBalance) - int96(nodes[existingNode].balance);
            _update(root, existingNode, differenceInKeyBalance);
        }
    }

    /// @notice Search a single node from the tree. Probability of getting selected is proportional to node's balance
    /// @param randomizer random number used for traversing the tree
    /// @return Address of the selected node
    function weightedSearch(uint256 randomizer) public view returns (address) {
        Node memory _root = nodes[root];
        uint256 totalWeightInTree = _getTotalBalancesIncludingWeight(_root);
        uint256 searchNumber = randomizer % totalWeightInTree;
        // console2.log("totalWeightInTree", totalWeightInTree);
        // console2.log("searchNumber", searchNumber);
        return _weightedSearch(root, searchNumber);
    }

    /// @notice internal function to recursively search the node
    /// @param _node address of the node
    /// @param searchNumber random number used for traversing the tree
    /// @return Address of the selected node
    function _weightedSearch(address _node, uint256 searchNumber) public view returns (address) {
        // |-----------sumOfLeftWeight -------|----balance-----|------sumOfRightWeights------|
        Node memory node = nodes[_node];
        (uint256 index1, uint256 index2, uint256 index3) = ClusterLib._getIndexesWithWeights(
            node.sumOfLeftBalances,
            node.balance,
            node.sumOfRightBalances
        );

        if (searchNumber <= index1) {
            return _weightedSearch(node.left, searchNumber);
        } else if (searchNumber > index1 && searchNumber <= index2) {
            return _node;
        } else if (searchNumber > index2 && searchNumber <= index3) {
            return _weightedSearch(node.right, searchNumber - index2);
        } else {
            // _printNode(_node);
            // console2.log("indexes", index1, index2, index3);
            // console2.log("search number", searchNumber);
            revert(ClusterLib.ERROR_OCCURED_DURING_WEIGHTED_SEARCH);
        }
    }

    /// @notice Update the balance of the node
    /// @param root Address of the current node
    /// @param key Address of the key
    /// @param diff Difference in the balance of the key
    function _update(
        address root,
        address key,
        int96 diff
    ) internal {
        Node storage currentNode = nodes[root];
        if (root == key) {
            diff > 0 ? currentNode.balance += uint96(diff) : currentNode.balance -= uint96(-diff);
        } else if (key < root) {
            diff > 0 ? currentNode.sumOfLeftBalances += uint96(diff) : currentNode.sumOfLeftBalances -= uint96(-diff);
            _update(currentNode.left, key, diff);
        } else {
            diff > 0 ? currentNode.sumOfRightBalances += uint96(diff) : currentNode.sumOfRightBalances -= uint96(-diff);
            _update(currentNode.right, key, diff);
        }
    }

    /// @notice Insert the node to the by searching the position where to add
    /// @param node Address of the current node
    /// @param key Address to add
    /// @param keyBalance Balance of the key
    function _insert(
        address node,
        address key,
        uint96 keyBalance
    ) internal returns (address) {
        if (node == address(0)) {
            nodes[key] = _newNode(key, keyBalance);
            return nodes[key].node;
        }

        Node storage currentNode = nodes[node];
        if (key < node) {
            currentNode.left = _insert(currentNode.left, key, keyBalance);
            currentNode.sumOfLeftBalances += keyBalance;
        } else {
            currentNode.right = _insert(currentNode.right, key, keyBalance);
            currentNode.sumOfRightBalances += keyBalance;
        }

        // 2. update the height
        currentNode.height = calculateUpdatedHeight(currentNode);

        // 3. Get the height difference
        int256 heightDifference = getHeightDifference(node);

        // Left Left Case
        if (heightDifference > 1 && key < currentNode.left) {
            // console2.log("_insert LL Case", keyBalance);
            return _rightRotate(node);
        }

        // Right Right Case
        if (heightDifference < -1 && key > currentNode.right) {
            // console2.log("_insert RR Case", keyBalance);
            return _leftRotate(node);
        }

        // Left Right Case
        if (heightDifference > 1 && key > currentNode.left) {
            // console2.log("_insert LR Case", keyBalance);
            currentNode.left = _leftRotate(currentNode.left);
            return _rightRotate(node);
        }

        // Right Left Case
        if (heightDifference < -1 && key < currentNode.right) {
            // console2.log("_insert RL Case", keyBalance);
            currentNode.right = _rightRotate(currentNode.right);
            return _leftRotate(node);
        }

        return node;
    }

    /// @notice Returns true if the node is present in the tree with non zero balance.
    /// @param _node Address of the node to search
    /// @return True if node is present
    function search(address _node) public view returns (bool) {
        if (_node == address(0)) {
            return false;
        }
        Node memory node = nodes[_node];
        return node.node == _node && node.balance != 0;
    }

    /// @notice Internal function to delete the node from the key
    /// @param _root Current root
    /// @param key Address of the node to be removed
    /// @param existingBalanceOfKey Balance of the key to be deleted
    function _deleteNode(
        address _root,
        address key,
        uint96 existingBalanceOfKey
    ) internal returns (address) {
        // console2.log("At node", _root);
        // console2.log("Element to delete", key);
        // console2.log("Balance of key to delete", existingBalanceOfKey);
        if (_root == address(0)) {
            return (_root);
        }

        Node storage node = nodes[_root];
        if (key < _root) {
            // console2.log("Moving to left");
            node.sumOfLeftBalances -= existingBalanceOfKey;
            (node.left) = _deleteNode(node.left, key, existingBalanceOfKey);
            // console2.log("After Moving to left");
        } else if (key > _root) {
            // console2.log("Moving to right");
            // console2.log("node.sumOfRightBalances", node.sumOfRightBalances);
            node.sumOfRightBalances -= existingBalanceOfKey;
            (node.right) = _deleteNode(node.right, key, existingBalanceOfKey);
            // console2.log("After Moving to right");
        } else {
            // console2.log("Wow! found node to delete");
            // if node.left and node.right are full, select the next smallest element to node.right, replace it with element to be removed
            // if node.right is full and node.left is null, select the next smallest element to node.right, replace it with element to be removed
            // if node.left is full and node.right is null, select node.left, replace it with node.left
            // if node.left and node.right are null, simply delete the element

            if (node.left != address(0) && node.right != address(0)) {
                // console2.log("case 1");
                return _replaceWithLeastMinimumNode(_root);
            } else if (node.left == address(0) && node.right != address(0)) {
                // console2.log("case 2");
                return _deleteNodeAndReturnRight(_root);
            } else if (node.left != address(0) && node.right == address(0)) {
                // console2.log("case 3");
                return _deleteNodeAndReturnLeft(_root);
            }
            // last case == (node.left == address(0) && node.right == address(0))
            else {
                delete nodes[_root];
                return address(0);
            }
        }

        node.height = calculateUpdatedHeight(node);

        int256 heightDifference = getHeightDifference(_root);

        if (heightDifference > 1 && getHeightDifference(node.left) >= 0) {
            return (_rightRotate(_root));
        }

        if (heightDifference > 1 && getHeightDifference(node.right) < 0) {
            node.left = _leftRotate(node.left);
            return (_rightRotate(_root));
        }

        if (heightDifference < -1 && getHeightDifference(node.right) <= 0) {
            return (_leftRotate(_root));
        }

        if (heightDifference < -1 && getHeightDifference(node.right) > 0) {
            node.right = _rightRotate(node.right);
            return (_leftRotate(_root));
        }

        return (_root);
    }

    /// @notice Internal function to delete when there exists a left node but no right node
    /// @param _node Address of Node to delete
    /// @return Address of node to replace the deleted node
    function _deleteNodeAndReturnLeft(address _node) internal returns (address) {
        Node memory C_ND = nodes[_node];
        delete nodes[_node];

        Node memory SND = nodes[C_ND.left];
        return SND.node;
    }

    ///@notice Internal function to delete when there exist a right node but no left node
    /// @param _node Address of Node to delete
    /// @return Address of node to replace the deleted node
    function _deleteNodeAndReturnRight(address _node) internal returns (address) {
        Node memory C_ND = nodes[_node];
        delete nodes[_node];

        Node memory SND = nodes[C_ND.right];
        return SND.node;
    }

    /// @notice Internal function to delete when both left and right node are defined.
    /// @param _node Address of Node to delete
    /// @return Address of node to replace the deleted node
    function _replaceWithLeastMinimumNode(address _node) internal returns (address) {
        // update deletion here

        Node memory C_ND = nodes[_node];
        Node memory nodeRight = nodes[C_ND.right];

        if (nodeRight.left == address(0)) {
            Node storage nodeRightStorage = nodes[C_ND.right];

            nodeRightStorage.left = C_ND.left;
            nodeRightStorage.sumOfLeftBalances = C_ND.sumOfLeftBalances;
            nodeRightStorage.height = 1 + Math.max(height(nodeRightStorage.left), height(nodeRightStorage.right));

            delete nodes[_node];

            return C_ND.right;
        } else {
            // nodes[_node].balance = 0;
            // return _node

            Node memory leastMinNode = _findLeastMinNode(C_ND.right);

            C_ND.right = _deleteNode(C_ND.right, leastMinNode.node, leastMinNode.balance);
            delete nodes[_node];

            Node storage lmnStore = nodes[leastMinNode.node];

            // lmn is removed in storage, so create a new one
            lmnStore.node = leastMinNode.node;
            lmnStore.balance = leastMinNode.balance;
            lmnStore.left = C_ND.left;
            lmnStore.right = C_ND.right;
            lmnStore.sumOfLeftBalances = C_ND.sumOfLeftBalances;

            Node memory C_ND_right = nodes[C_ND.right];
            lmnStore.sumOfRightBalances = _getTotalBalancesIncludingWeight(C_ND_right);
            lmnStore.height = calculateUpdatedHeight(lmnStore);

            return leastMinNode.node;
        }
    }

    /// @notice Find the least minimum node for given node
    /// @param _node Address of node from which least min node has to be found
    /// @return Copy of Node that will be replaced
    function _findLeastMinNode(address _node) internal view returns (Node memory) {
        Node memory node = nodes[_node];

        if (node.left != address(0)) {
            return _findLeastMinNode(node.left);
        }

        return (node);
    }
}
