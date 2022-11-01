// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/math/Math.sol";

contract SingleSelector {
    /// @notice Address of the node
    /// @param node Address of the node
    /// @param balance Balance of the node
    /// @param left Address of the node left of node
    /// @param right Address of the node right of the node
    /// @param sumOfLeftBalances Sum of the balance of nodes on left of the node
    /// @param sumOfRightBalances Sum of the balance of the nodes of right of the node
    /// @param height Height of the current node
    struct Node {
        address node; // sorting condition
        uint96 balance;
        address left;
        uint96 sumOfLeftBalances;
        address right;
        uint96 sumOfRightBalances;
        uint256 height;
    }

    string constant CANNOT_RR_ADDRESS_ZERO = "1";
    string constant CANNOT_LR_ADDRESS_ZERO = "2";

    /// @notice List of all nodes
    mapping(address => Node) nodes;

    /// @notice Total number of all nodes in the tree
    uint256 public totalElements;

    /// @notice Address of the current root
    address public root;

    constructor() {}

    /// @notice Update the balance of the node
    /// @param node Address of the current node
    /// @param key Address of the key
    /// @param diff Difference in the balance of the key
    function _update(
        address node,
        address key,
        int96 diff
    ) internal {
        Node storage currentNode = nodes[node];
        if (node == key) {
            diff > 0 ? currentNode.balance += uint96(diff) : currentNode.balance -= uint96(-diff);
        } else if (key < node) {
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
        currentNode.height = _calculateUpdatedHeight(currentNode);

        // 3. Get the height difference
        int256 heightDifference = getHeightDifference(node);

        // Left Left Case
        if (heightDifference > 1 && key < currentNode.left) {
            return _rightRotate(node);
        }

        // Right Right Case
        if (heightDifference < -1 && key > currentNode.right) {
            return _leftRotate(node);
        }

        // Left Right Case
        if (heightDifference > 1 && key > currentNode.left) {
            currentNode.left = _leftRotate(currentNode.left);
            return _rightRotate(node);
        }

        // Right Left Case
        if (heightDifference < -1 && key < currentNode.right) {
            currentNode.right = _rightRotate(currentNode.right);
            return _leftRotate(node);
        }

        return node;
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
        if (_root == address(0)) {
            return (_root);
        }

        Node storage node = nodes[_root];
        if (key < _root) {
            node.sumOfLeftBalances -= existingBalanceOfKey;
            (node.left) = _deleteNode(node.left, key, existingBalanceOfKey);
        } else if (key > _root) {
            node.sumOfRightBalances -= existingBalanceOfKey;
            (node.right) = _deleteNode(node.right, key, existingBalanceOfKey);
        } else {
            // if node.left and node.right are full, select the next smallest element to node.right, replace it with element to be removed
            // if node.right is full and node.left is null, select the next smallest element to node.right, replace it with element to be removed
            // if node.left is full and node.right is null, select node.left, replace it with node.left
            // if node.left and node.right are null, simply delete the element

            if (node.left != address(0) && node.right != address(0)) {
                return _replaceWithLeastMinimumNode(_root);
            } else if (node.left == address(0) && node.right != address(0)) {
                return _deleteNodeAndReturnRight(_root);
            } else if (node.left != address(0) && node.right == address(0)) {
                return _deleteNodeAndReturnLeft(_root);
            }
            // last case == (node.left == address(0) && node.right == address(0))
            else {
                delete nodes[_root];
                return address(0);
            }
        }

        node.height = _calculateUpdatedHeight(node);

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

    /// @notice Function to create a empty node
    /// @param node Address of the new node
    /// @param balance Balance of the new node
    /// @return newNode Empty node with address and balance
    function _newNode(address node, uint96 balance) internal pure returns (Node memory newNode) {
        newNode = Node(node, balance, address(0), 0, address(0), 0, 1);
    }

    /// @notice Right rotate a given node
    /// @param addressOfZ address of the node to right rotate
    /// @return Returns the new root after the rotation
    /// @notice ----------------------------- z -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- y     T4 -------------------------
    /// @notice ------------------------- / \        ------------------------
    /// @notice ------------------------ x   T3       -----------------------
    /// @notice ----------------------- / \            ----------------------
    /// @notice ---------------------- T1  T2            --------------------
    /// @notice is rotated to
    /// @notice ----------------------------- y -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- x     z --------------------------
    /// @notice ------------------------- / \   / \ -------------------------
    /// @notice ------------------------ T1 T2 T3 T4 ------------------------
    function _rightRotate(address addressOfZ) internal returns (address) {
        if (addressOfZ == address(0)) revert(CANNOT_RR_ADDRESS_ZERO);

        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.left];

        // do not rotate if left is 0
        if (y.node == address(0)) return z.node;

        Node memory T3 = nodes[y.right];

        // cut z.left
        z.sumOfLeftBalances = _getTotalBalancesIncludingWeight(T3);
        z.left = T3.node;
        // cut y.right
        y.sumOfRightBalances = _getTotalBalancesIncludingWeight(z);
        y.right = z.node;

        z.height = _calculateUpdatedHeight(z);
        y.height = _calculateUpdatedHeight(y);
        return y.node;
    }

    /// @notice Lef rotate a given node
    /// @param addressOfZ address of the node to left rotate
    /// @return Returns the new root after the rotation
    /// @notice ----------------------------- z -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- T1    y --------------------------
    /// @notice -------------------------       / \ -------------------------
    /// @notice ------------------------      T2   x ------------------------
    /// @notice -----------------------           / \ -----------------------
    /// @notice ----------------------           T3  T4 ---------------------
    /// @notice is rotated to
    /// @notice ----------------------------- y -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- z     x --------------------------
    /// @notice ------------------------- / \   / \ -------------------------
    /// @notice ------------------------ T1 T2 T3 T4 ------------------------
    function _leftRotate(address addressOfZ) internal returns (address) {
        if (addressOfZ == address(0)) revert(CANNOT_LR_ADDRESS_ZERO);

        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.right];

        // do not rotate if right is 0
        if (y.node == address(0)) return z.node;

        Node memory T2 = nodes[y.left];

        // cut z.right
        z.sumOfRightBalances = _getTotalBalancesIncludingWeight(T2);
        z.right = T2.node;
        // cut y.left
        y.sumOfLeftBalances = _getTotalBalancesIncludingWeight(z);
        y.left = z.node;

        z.height = _calculateUpdatedHeight(z);
        y.height = _calculateUpdatedHeight(y);
        return y.node;
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
            lmnStore.height = _calculateUpdatedHeight(lmnStore);

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

    /// @notice Get total weight of the node
    /// @param node Node to calculate total weight for
    /// @return Total weight of the node
    function _getTotalBalancesIncludingWeight(Node memory node) internal pure returns (uint96) {
        return node.balance + node.sumOfLeftBalances + node.sumOfRightBalances;
    }

    function _calculateUpdatedHeight(Node memory node) internal view returns (uint256) {
        return Math.max(height(node.right), height(node.left)) + 1;
    }


    /// @notice Height of the tree at a given moment
    /// @return Height of the tree
    function heightOfTheTree() public view returns (uint256) {
        return height(root);
    }

    /// @notice Height of any node at a given moment
    /// @param node Address of the node whose height needs to be searched
    /// @return Height of the node
    function height(address node) public view returns (uint256) {
        if (node == address(0)) return 0;
        return nodes[node].height;
    }

    /// @notice Returns the (node balance) i.e difference in heights of left and right nodes
    /// @param node Address of the node to get height difference of
    /// @return Height Difference of the node
    function getHeightDifference(address node) public view returns (int256) {
        if (node == address(0)) return 0;

        Node memory existingNode = nodes[node];

        return int256(height(existingNode.left)) - int256(height(existingNode.right));
    }

    /// @notice Returns the data of the node
    /// @param _node Address of the node
    /// @return node Data of the node
    function nodeData(address _node) public view returns (Node memory node) {
        node = nodes[_node];
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
}
