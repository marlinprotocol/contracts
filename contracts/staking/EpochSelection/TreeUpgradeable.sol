// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Errors.sol";

import "hardhat/console.sol";

contract TreeUpgradeable {
    struct Node {
        uint80 value;
        uint80 leftSum;
        uint80 rightSum;
    }

    mapping(address => uint256) public addressToIndexMap;
    mapping(uint256 => address) public indexToAddressMap;

    Node[] public nodes;

    function _add(uint256 _index, uint80 _value) internal {
        nodes[_index].value += _value;
        while(_index > 1) {
            bool _side = _index % 2 == 0;
            _index = _index >> 1;
            if(_side == true) {
                // console.log("increasing left sum of", _index);
                nodes[_index].leftSum += _value;
            } else {
                // console.log("increasing right sum of", _index);
                nodes[_index].rightSum += _value;
            }
        }
    }

    function _sub(uint256 _index, uint80 _value) internal {
        nodes[_index].value -= _value;
        while(_index > 1) {
            bool _side = _index % 2 == 0;
            _index = _index >> 1;
            if(_side == true) {
                // console.log("decreasing left sum of", _index);
                nodes[_index].leftSum -= _value;
            } else {
                // console.log("decreasing right sum of", _index);
                nodes[_index].rightSum -= _value;
            }
        }
    }

    function _insert(address _addr, uint80 _value) internal {
        require(_addr != address(0));
        uint256 _index = nodes.length;
        nodes.push(Node(0, 0, 0));

        addressToIndexMap[_addr] = _index;
        indexToAddressMap[_index] = _addr;

        // console.log("inserting node at", _index);

        _add(_index, _value);
    }

    function _update(uint256 _index, uint80 _value) internal {
        require(_index != 0);
        uint80 _currentValue = nodes[_index].value;

        // console.log("updating node at", _index);
        // console.log("changing ", _currentValue, _value);

        if(_currentValue >= _value) {
            _sub(_index, _currentValue - _value);
        } else {
            _add(_index, _value - _currentValue);
        }
    }

    function _delete(uint256 _index) internal {
        require(_index != 0);
        uint256 _lastNodeIndex = nodes.length - 1;
        uint80 _lastNodeValue = nodes[_lastNodeIndex].value;

        // console.log("deleting node at ", _index);

        _sub(_lastNodeIndex, _lastNodeValue);

        _update(_index, _lastNodeValue);
        address _lastNodeAddress = indexToAddressMap[_lastNodeIndex];
        address _deleteNodeAddress = indexToAddressMap[_index];

        indexToAddressMap[_index] = _lastNodeAddress;
        addressToIndexMap[_lastNodeAddress] = _index;

        delete indexToAddressMap[_lastNodeIndex];
        delete addressToIndexMap[_deleteNodeAddress];

        nodes.pop();
    }
}

// abstract contract SelectorHelper is AccessControl, IClusterSelector {
//     /// @notice ID for update role
//     bytes32 public constant UPDATER_ROLE = keccak256(abi.encode("updater"));

//     /// @notice ID for admin role
//     bytes32 public constant ADMIN_ROLE = keccak256(abi.encode("admin"));

//     uint32 public idCounters;
//     uint32[] public emptyIds;

//     mapping(address => uint32) public addressToIndexMap;
//     mapping(uint32 => address) public indexToAddressMap;

//     /// @notice List of all nodes
//     mapping(uint32 => Node) nodes;

//     /// @notice Total number of all nodes in the tree
//     uint256 totalElements;

//     /// @notice Address of the current root
//     uint32 public root;

//     constructor(address _admin) {
//         AccessControl._setRoleAdmin(UPDATER_ROLE, ADMIN_ROLE);
//         AccessControl._grantRole(ADMIN_ROLE, _admin);
//     }

//     /// @notice Height of the tree at a given moment
//     /// @return Height of the tree
//     function heightOfTheTree() public view returns (uint256) {
//         return height(root);
//     }

//     /// @notice Height of any node at a given moment
//     /// @param node Address of the node whose height needs to be searched
//     /// @return Height of the node
//     function height(uint32 node) public view returns (uint32) {
//         if (node == 0) return 0;
//         return nodes[node].height;
//     }

//     /// @notice Function to create a empty node
//     /// @param node Address of the new node
//     /// @param balance Balance of the new node
//     /// @return newNode Empty node with address and balance
//     function _newNode(uint32 node, uint32 balance) internal pure returns (Node memory newNode) {
//         newNode = Node(node, balance, 0, 0, 1, 0, 0);
//     }

//     /// @inheritdoc IClusterSelector
//     function insert(address newNode, uint32 balance) public override(IClusterSelector) onlyRole(UPDATER_ROLE) {
//         require(newNode != address(0), Errors.CANNOT_BE_ADDRESS_ZERO);
//         uint32 nodeIndex = addressToIndexMap[newNode];
//         Node memory node = nodes[nodeIndex];

//         if (node.node == 0) {
//             uint32 newIndex = getNewId();
//             root = _insert(root, newIndex, balance);
//             totalElements++;
//             indexToAddressMap[newIndex] = newNode;
//             addressToIndexMap[newNode] = newIndex;
//         } else {
//             // int256 differenceInKeyBalance = int256(clusterBalance) - int256(node.balance);
//             _update(root, nodeIndex, int32(balance) - int32(node.balance));
//         }
//     }

//     /// @inheritdoc IClusterSelector
//     function insertMultiple(address[] calldata newNodes, uint32[] calldata balances)
//         public
//         override(IClusterSelector)
//         onlyRole(UPDATER_ROLE)
//     {
//         require(newNodes.length == balances.length, "arity mismatch");
//         for (uint256 index = 0; index < newNodes.length; index++) {
//             insert(newNodes[index], balances[index]);
//         }
//     }

//     /// @notice Insert the node to the by searching the position where to add
//     /// @param node Address of the current node
//     /// @param key Address to add
//     /// @param keyBalance Balance of the key
//     function _insert(
//         uint32 node,
//         uint32 key,
//         uint32 keyBalance
//     ) internal returns (uint32) {
//         if (node == 0) {
//             nodes[key] = _newNode(key, keyBalance);
//             return nodes[key].node;
//         }

//         Node storage currentNode = nodes[node];
//         if (key < node) {
//             currentNode.left = _insert(currentNode.left, key, keyBalance);
//             currentNode.sumOfLeftBalances += keyBalance;
//         } else {
//             currentNode.right = _insert(currentNode.right, key, keyBalance);
//             currentNode.sumOfRightBalances += keyBalance;
//         }

//         // 2. update the height
//         currentNode.height = uint8(calculateUpdatedHeight(currentNode));

//         // 3. Get the height difference
//         int256 heightDifference = getHeightDifference(node);

//         // Left Left Case
//         if (heightDifference > 1 && key < currentNode.left) {
//             return _rightRotate(node);
//         }

//         // Right Right Case
//         if (heightDifference < -1 && key > currentNode.right) {
//             return _leftRotate(node);
//         }

//         // Left Right Case
//         if (heightDifference > 1 && key > currentNode.left) {
//             currentNode.left = _leftRotate(currentNode.left);
//             return _rightRotate(node);
//         }

//         // Right Left Case
//         if (heightDifference < -1 && key < currentNode.right) {
//             currentNode.right = _rightRotate(currentNode.right);
//             return _leftRotate(node);
//         }

//         return node;
//     }

//     /// @inheritdoc IClusterSelector
//     function update(address existingNode, uint32 newBalance) public override(IClusterSelector) onlyRole(UPDATER_ROLE) {
//         uint32 indexKey = addressToIndexMap[existingNode];

//         require(indexKey != 0, Errors.CANNOT_BE_ADDRESS_ZERO);
//         if (nodes[indexKey].node == 0) {
//             assert(false);
//         } else {
//             int32 differenceInKeyBalance = int32(newBalance) - int32(nodes[indexKey].balance);
//             _update(root, indexKey, differenceInKeyBalance);
//         }
//     }

//     /// @notice Update the balance of the node
//     /// @param node Address of the current node
//     /// @param key Address of the key
//     /// @param diff Difference in the balance of the key
//     function _update(
//         uint32 node,
//         uint32 key,
//         int32 diff
//     ) internal {
//         Node storage currentNode = nodes[node];
//         if (node == key) {
//             diff > 0 ? currentNode.balance += uint32(diff) : currentNode.balance -= uint32(-diff);
//         } else if (key < node) {
//             diff > 0 ? currentNode.sumOfLeftBalances += uint32(diff) : currentNode.sumOfLeftBalances -= uint32(-diff);
//             _update(currentNode.left, key, diff);
//         } else {
//             diff > 0 ? currentNode.sumOfRightBalances += uint32(diff) : currentNode.sumOfRightBalances -= uint32(-diff);
//             _update(currentNode.right, key, diff);
//         }
//     }

//     /// @notice Returns true if the node is present in the tree with non zero balance.
//     /// @param _node Address of the node to search
//     /// @return True if node is present
//     function search(address _node) public view returns (bool) {
//         uint32 nodeKey = addressToIndexMap[_node];
//         if (nodeKey == 0) {
//             return false;
//         }
//         Node memory node = nodes[nodeKey];
//         return node.node == nodeKey && node.balance != 0;
//     }

//     /// @inheritdoc IClusterSelector
//     function deleteNode(address key) public override(IClusterSelector) onlyRole(UPDATER_ROLE) {
//         require(deleteNodeIfPresent(key), Errors.NODE_NOT_PRESENT_IN_THE_TREE);
//     }

//     /// @notice Delete a node from tree if it is stored
//     /// @param key Address of the node
//     function deleteNodeIfPresent(address key) public virtual onlyRole(UPDATER_ROLE) returns (bool) {
//         require(key != address(0), Errors.CANNOT_BE_ADDRESS_ZERO);
//         uint32 indexKey = addressToIndexMap[key];

//         Node memory node = nodes[indexKey];
//         if (node.node == indexKey && indexKey != 0) {
//             // delete node
//             root = _deleteNode(root, indexKey, node.balance);
//             totalElements--;
//             delete indexToAddressMap[indexKey];
//             delete addressToIndexMap[key];
//             emptyIds.push(indexKey);
//             return true;
//         }
//         return false;
//     }

//     /// @notice Internal function to delete the node from the key
//     /// @param _root Current root
//     /// @param key Address of the node to be removed
//     /// @param existingBalanceOfKey Balance of the key to be deleted
//     function _deleteNode(
//         uint32 _root,
//         uint32 key,
//         uint32 existingBalanceOfKey
//     ) internal returns (uint32) {
//         if (_root == 0) {
//             return (_root);
//         }

//         Node storage node = nodes[_root];
//         if (key < _root) {
//             node.sumOfLeftBalances -= existingBalanceOfKey;
//             (node.left) = _deleteNode(node.left, key, existingBalanceOfKey);
//         } else if (key > _root) {
//             node.sumOfRightBalances -= existingBalanceOfKey;
//             (node.right) = _deleteNode(node.right, key, existingBalanceOfKey);
//         } else {
//             // if node.left and node.right are full, select the next smallest element to node.right, replace it with element to be removed
//             // if node.right is full and node.left is null, select the next smallest element to node.right, replace it with element to be removed
//             // if node.left is full and node.right is null, select node.left, replace it with node.left
//             // if node.left and node.right are null, simply delete the element

//             if (node.left != 0 && node.right != 0) {
//                 return _replaceWithLeastMinimumNode(_root);
//             } else if (node.left == 0 && node.right != 0) {
//                 return _deleteNodeAndReturnRight(_root);
//             } else if (node.left != 0 && node.right == 0) {
//                 return _deleteNodeAndReturnLeft(_root);
//             }
//             // last case == (node.left == address(0) && node.right == address(0))
//             else {
//                 delete nodes[_root];
//                 return 0;
//             }
//         }

//         node.height = uint8(calculateUpdatedHeight(node));

//         int256 heightDifference = getHeightDifference(_root);

//         if (heightDifference > 1 && getHeightDifference(node.left) >= 0) {
//             return (_rightRotate(_root));
//         }

//         if (heightDifference > 1 && getHeightDifference(node.right) < 0) {
//             node.left = _leftRotate(node.left);
//             return (_rightRotate(_root));
//         }

//         if (heightDifference < -1 && getHeightDifference(node.right) <= 0) {
//             return (_leftRotate(_root));
//         }

//         if (heightDifference < -1 && getHeightDifference(node.right) > 0) {
//             node.right = _rightRotate(node.right);
//             return (_leftRotate(_root));
//         }

//         return (_root);
//     }

//     /// @notice Internal function to delete when there exists a left node but no right node
//     /// @param _node Address of Node to delete
//     /// @return Address of node to replace the deleted node
//     function _deleteNodeAndReturnLeft(uint32 _node) internal returns (uint32) {
//         Node memory C_ND = nodes[_node];
//         delete nodes[_node];

//         Node memory SND = nodes[C_ND.left];
//         return SND.node;
//     }

//     ///@notice Internal function to delete when there exist a right node but no left node
//     /// @param _node Address of Node to delete
//     /// @return Address of node to replace the deleted node
//     function _deleteNodeAndReturnRight(uint32 _node) internal returns (uint32) {
//         Node memory C_ND = nodes[_node];
//         delete nodes[_node];

//         Node memory SND = nodes[C_ND.right];
//         return SND.node;
//     }

//     /// @notice Internal function to delete when both left and right node are defined.
//     /// @param _node Address of Node to delete
//     /// @return Address of node to replace the deleted node
//     function _replaceWithLeastMinimumNode(uint32 _node) internal returns (uint32) {
//         // update deletion here

//         Node memory C_ND = nodes[_node];
//         Node memory nodeRight = nodes[C_ND.right];

//         if (nodeRight.left == 0) {
//             Node storage nodeRightStorage = nodes[C_ND.right];

//             nodeRightStorage.left = C_ND.left;
//             nodeRightStorage.sumOfLeftBalances = C_ND.sumOfLeftBalances;
//             nodeRightStorage.height = uint8(1 + Math.max(height(nodeRightStorage.left), height(nodeRightStorage.right)));

//             delete nodes[_node];

//             return C_ND.right;
//         } else {
//             Node memory leastMinNode = _findLeastMinNode(C_ND.right);

//             C_ND.right = _deleteNode(C_ND.right, leastMinNode.node, leastMinNode.balance);
//             delete nodes[_node];

//             Node storage lmnStore = nodes[leastMinNode.node];

//             // lmn is removed in storage, so create a new one
//             lmnStore.node = leastMinNode.node;
//             lmnStore.balance = leastMinNode.balance;
//             lmnStore.left = C_ND.left;
//             lmnStore.right = C_ND.right;
//             lmnStore.sumOfLeftBalances = C_ND.sumOfLeftBalances;

//             Node memory C_ND_right = nodes[C_ND.right];
//             lmnStore.sumOfRightBalances = _getTotalBalancesIncludingWeight(C_ND_right);
//             lmnStore.height = uint8(calculateUpdatedHeight(lmnStore));

//             return leastMinNode.node;
//         }
//     }

//     /// @notice Find the least minimum node for given node
//     /// @param _node Address of node from which least min node has to be found
//     /// @return Copy of Node that will be replaced
//     function _findLeastMinNode(uint32 _node) internal view returns (Node memory) {
//         Node memory node = nodes[_node];

//         if (node.left != 0) {
//             return _findLeastMinNode(node.left);
//         }

//         return (node);
//     }

//     /// @notice Right rotate a given node
//     /// @param addressOfZ address of the node to right rotate
//     /// @return Returns the new root after the rotation
//     /// @notice ----------------------------- z -----------------------------
//     /// @notice --------------------------- /   \ ---------------------------
//     /// @notice -------------------------- y     T4 -------------------------
//     /// @notice ------------------------- / \        ------------------------
//     /// @notice ------------------------ x   T3       -----------------------
//     /// @notice ----------------------- / \            ----------------------
//     /// @notice ---------------------- T1  T2            --------------------
//     /// @notice is rotated to
//     /// @notice ----------------------------- y -----------------------------
//     /// @notice --------------------------- /   \ ---------------------------
//     /// @notice -------------------------- x     z --------------------------
//     /// @notice ------------------------- / \   / \ -------------------------
//     /// @notice ------------------------ T1 T2 T3 T4 ------------------------
//     function _rightRotate(uint32 addressOfZ) internal returns (uint32) {
//         if (addressOfZ == 0) {
//             revert(Errors.CANNOT_RR_ADDRESS_ZERO);
//         }
//         Node storage z = nodes[addressOfZ];

//         Node storage y = nodes[z.left];

//         // do not rotate if left is 0
//         if (y.node == 0) {
//             return z.node;
//         }
//         Node memory T3 = nodes[y.right];

//         // cut z.left
//         z.sumOfLeftBalances = _getTotalBalancesIncludingWeight(T3);
//         z.left = T3.node;
//         // cut y.right
//         y.sumOfRightBalances = _getTotalBalancesIncludingWeight(z);
//         y.right = z.node;

//         z.height = uint8(calculateUpdatedHeight(z));
//         y.height = uint8(calculateUpdatedHeight(y));
//         return y.node;
//     }

//     /// @notice Left rotate a given node
//     /// @param addressOfZ address of the node to left rotate
//     /// @return Returns the new root after the rotation
//     /// @notice ----------------------------- z -----------------------------
//     /// @notice --------------------------- /   \ ---------------------------
//     /// @notice -------------------------- T1    y --------------------------
//     /// @notice -------------------------       / \ -------------------------
//     /// @notice ------------------------      T2   x ------------------------
//     /// @notice -----------------------           / \ -----------------------
//     /// @notice ----------------------           T3  T4 ---------------------
//     /// @notice is rotated to
//     /// @notice ----------------------------- y -----------------------------
//     /// @notice --------------------------- /   \ ---------------------------
//     /// @notice -------------------------- z     x --------------------------
//     /// @notice ------------------------- / \   / \ -------------------------
//     /// @notice ------------------------ T1 T2 T3 T4 ------------------------
//     function _leftRotate(uint32 addressOfZ) internal returns (uint32) {
//         if (addressOfZ == 0) {
//             revert(Errors.CANNOT_LR_ADDRESS_ZERO);
//         }
//         Node storage z = nodes[addressOfZ];

//         Node storage y = nodes[z.right];

//         // do not rotate if right is 0
//         if (y.node == 0) {
//             return z.node;
//         }
//         Node memory T2 = nodes[y.left];

//         // cut z.right
//         z.sumOfRightBalances = _getTotalBalancesIncludingWeight(T2);
//         z.right = T2.node;
//         // cut y.left
//         y.sumOfLeftBalances = _getTotalBalancesIncludingWeight(z);
//         y.left = z.node;

//         z.height = uint8(calculateUpdatedHeight(z));
//         y.height = uint8(calculateUpdatedHeight(y));
//         return y.node;
//     }

//     /// @notice Returns the (node balance) i.e difference in heights of left and right nodes
//     /// @param node Address of the node to get height difference of
//     /// @return Height Difference of the node
//     function getHeightDifference(uint32 node) public view returns (int32) {
//         if (node == 0) return 0;

//         Node memory existingNode = nodes[node];

//         return int32(height(existingNode.left)) - int32(height(existingNode.right));
//     }

//     /// @notice Returns the data of the node
//     /// @param _node Address of the node
//     /// @return node Data of the node
//     function nodeData(uint32 _node) public view returns (Node memory node) {
//         node = nodes[_node];
//     }

//     /// @notice Get total weight of the node
//     /// @param node Node to calculate total weight for
//     /// @return Total weight of the node
//     function _getTotalBalancesIncludingWeight(Node memory node) internal pure returns (uint32) {
//         return node.balance + node.sumOfLeftBalances + node.sumOfRightBalances;
//     }

//     function calculateUpdatedHeight(Node memory node) internal view returns (uint256) {
//         return Math.max(height(node.right), height(node.left)) + 1;
//     }

//     // TODO: optimise this whole function
//     function getNewId() internal returns (uint32) {
//         if (emptyIds.length > 0) {
//             uint32 id = emptyIds[emptyIds.length - 1];
//             emptyIds.pop();
//             return id;
//         } else {
//             uint32 id = ++idCounters;
//             return id;
//         }
//     }
// }
