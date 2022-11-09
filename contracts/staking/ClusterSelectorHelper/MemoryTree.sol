// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// import "forge-std/console2.sol";

library MemoryTree {
    struct MemoryNode {
        uint256 node; // sorting condition
        uint256 balance;
        uint256 left;
        uint256 sumOfLeftBalances;
        uint256 right;
        uint256 sumOfRightBalances;
    }

    uint256 constant numberOfElements = 85;

    // function test_memory_insert() public {
    //     MemoryTree.MemoryNode[] memory result;
    //     assembly {
    //         let pos := mload(0x40)
    //         mstore(0x40, add(pos, add(mul(numberOfElements, 32), 32)))
    //         mstore(result, numberOfElements)
    //     }
    //     uint256 length = result.length;
    //     for (uint256 index = 0; index < numberOfElements; ) {
    //         assembly {
    //             // MemoryNode(index, 1, 1, 2, 3, 4)
    //             let pos := mload(0x40)
    //             mstore(0x40, add(pos, 192))

    //             mstore(pos, index)
    //             mstore(add(pos, 32), 1)
    //             mstore(add(pos, 64), 1)
    //             mstore(add(pos, 96), 1)
    //             mstore(add(pos, 128), 1)
    //             mstore(add(pos, 160), 1)

    //             mstore(add(add(result, mul(index, 32)), 32), pos)
    //         }
    //         unchecked {
    //             ++index;
    //         }
    //     }
    // }

    function upsert(
        MemoryNode[] memory tree,
        uint256 indexOfLastElement,
        uint256 key,
        uint256 balance,
        bool toAdd
    ) internal pure returns (MemoryNode[] memory) {
        if (hasElement(tree, key)) {
            return insert(tree, indexOfLastElement, key, balance, toAdd);
        } else {
            return update(tree, key, balance);
        }
    }

    function update(
        MemoryNode[] memory tree,
        uint256 key,
        uint256 balance
    ) internal pure returns (MemoryNode[] memory) {
        if (tree.length > 1 && key != 0) {
            return _update(tree, 1, key, balance);
        } else {
            revert("Invalid Tree structure");
        }
    }

    function _update(
        MemoryNode[] memory tree,
        uint256 _indexOfRoot,
        uint256 key,
        uint256 balance
    ) internal pure returns (MemoryNode[] memory) {
        if (tree[_indexOfRoot].node == 0) {
            revert("Node not stored");
        } else if (tree[_indexOfRoot].node == key) {
            tree[_indexOfRoot].balance = balance;
            return tree;
        } else if (tree[_indexOfRoot].node < key) {
            tree[_indexOfRoot].sumOfLeftBalances -= tree[_indexOfRoot].node;
            MemoryNode[] memory _t = _update(tree, tree[_indexOfRoot].left, key, balance);
            tree[_indexOfRoot].sumOfLeftBalances += balance;
            return _t;
        } else {
            tree[_indexOfRoot].sumOfRightBalances -= tree[_indexOfRoot].node;
            MemoryNode[] memory _t = _update(tree, tree[_indexOfRoot].right, key, balance);
            tree[_indexOfRoot].sumOfRightBalances += balance;
            return _t;
        }
    }

    function hasElement(MemoryNode[] memory tree, uint256 key) internal pure returns (bool) {
        if (key != 0 && tree.length > 1) {
            return _hasElement(tree, 1, key);
        }

        return false;
    }

    function _hasElement(
        MemoryNode[] memory tree,
        uint256 _indexOfRoot,
        uint256 key
    ) internal pure returns (bool) {
        MemoryNode memory _node = tree[_indexOfRoot];

        if (_node.node == 0) {
            return false;
        } else if (_node.node == key) {
            return true;
        } else if (_node.node < key) {
            return _hasElement(tree, _node.left, key);
        } else {
            return _hasElement(tree, _node.right, key);
        }
    }

    function search(MemoryNode[] memory tree, uint256 key) internal pure returns (MemoryNode memory value) {
        if (key != 0 && tree.length > 1) {
            value = _search(tree, 1, key);
        }
    }

    function _search(
        MemoryNode[] memory tree,
        uint256 _indexOfRoot,
        uint256 key
    ) internal pure returns (MemoryNode memory) {
        MemoryNode memory _node = tree[_indexOfRoot];

        if (_node.node == 0 || _node.node == key) {
            return _node; // tree[0] will always be empty
        } else if (_node.node < key) {
            return _search(tree, _node.left, key);
        } else {
            return _search(tree, _node.right, key);
        }
    }

    function create(
        MemoryNode[] memory tree,
        uint256 size
    ) internal pure {
        assembly {
            let pos := mload(0x40)
            mstore(0x40, add(pos, add(mul(size, 32), 32)))
            mstore(tree, size)
        }
    }


    // function insert(
    //     MemoryNode[] memory tree,
    //     MemoryNode memory node,
    //     uint256 index
    // ) internal pure {
    //     assembly {
    //         mstore(add(add(tree, mul(index, 32)), 32), node)
    //     }
    // }

    // function update(
    //     MemoryNode[] memory tree,
    //     MemoryNode memory node,
    //     uint256 index
    // ) internal pure {

    // }

    function insert(
        MemoryNode[] memory tree,
        uint256 indexOfLastElement,
        uint256 key,
        uint256 balance,
        bool toAdd
    ) internal pure returns (MemoryNode[] memory) {
        uint256 length = tree.length;

        if (length == 0) {
            // in first insert add two elements
            assembly {
                let pos := mload(0x40)
                mstore(0x40, add(pos, add(mul(numberOfElements, 32), 32)))
                mstore(tree, numberOfElements)
            }
            assembly {
                let pos := mload(0x40)
                mstore(0x40, add(pos, 192))

                mstore(pos, 0)
                mstore(add(pos, 32), 0)
                mstore(add(pos, 64), 0)
                mstore(add(pos, 96), 0)
                mstore(add(pos, 128), 0)
                mstore(add(pos, 160), 0)

                mstore(add(add(tree, mul(0, 32)), 32), pos)
            }

            uint256 _balance = balance;

            assembly {
                let pos := mload(0x40)
                mstore(0x40, add(pos, 192))

                mstore(pos, key)
                mstore(add(pos, 32), _balance)
                mstore(add(pos, 64), 0)
                mstore(add(pos, 96), 0)
                mstore(add(pos, 128), 0)
                mstore(add(pos, 160), 0)

                mstore(add(add(tree, mul(1, 32)), 32), pos)
            }

            return tree;
        } else {
            // console2.log("insert", "length of tree", tree.length);
            (MemoryNode[] memory _t, ) = _insert(tree, 1, indexOfLastElement, key, balance, toAdd);
            return _t;
        }
    }

    function _insert(
        MemoryNode[] memory tree,
        uint256 _indexOfRoot,
        uint256 _indexOfLastElement,
        uint256 key,
        uint256 balance,
        bool toAdd
    ) internal pure returns (MemoryNode[] memory, uint256) {
        // console2.log("_insert", _indexOfRoot);
        uint256 nextElementPosition = _indexOfLastElement + 1;
        if (_indexOfRoot == 0) {
            uint256 _balance = balance;
            assembly {
                let pos := mload(0x40)
                mstore(0x40, add(pos, 192))

                mstore(pos, key)
                mstore(add(pos, 32), _balance)
                mstore(add(pos, 64), 0)
                mstore(add(pos, 96), 0)
                mstore(add(pos, 128), 0)
                mstore(add(pos, 160), 0)

                mstore(add(add(tree, mul(nextElementPosition, 32)), 32), pos)
            }

            return (tree, nextElementPosition);
        }

        // console2.log("_insert tree.length", tree.length);
        // console2.log("_indexOfRoot", _indexOfRoot);
        MemoryNode memory _node = tree[_indexOfRoot];
        // console2.log("check tree.");

        if (_node.node < key) {
            (MemoryNode[] memory _t, uint256 _indexOfPrevious) = _insert(tree, _node.left, _indexOfLastElement, key, balance, toAdd);
            _node.left = _indexOfPrevious;
            if (toAdd) {
                _node.sumOfLeftBalances += balance;
            }
            return (_t, _indexOfRoot);
        } else {
            (MemoryNode[] memory _t, uint256 _indexOfPrevious) = _insert(tree, _node.right, _indexOfLastElement, key, balance, toAdd);
            _node.right = _indexOfPrevious;
            if (toAdd) {
                _node.sumOfRightBalances += balance;
            }
            return (_t, _indexOfRoot);
        }
    }
}
