// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Errors.sol";


/// @dev Contract implements an upgradeable version of tree which stores
/// elements in order of insertion. When a element is added, it is added
/// to the left most empty leaf in the tree. When an element is deleted,
/// it is replaced with the element in the right most leaf in the tree.
/// Each element in the tree stores the weight of all elements on the left
/// and right side of the node.
contract TreeUpgradeable is Initializable {
    /// @notice Struct that stores the value on the node and the sum of
    /// weights on left and right side of the node.
    /// @param value Value on the node
    /// @param leftSum Sum of nodes on the left side of the current node
    /// @param rightSum Sum of nodes on the right side of the current node
    struct Node {
        uint64 value;
        uint64 leftSum;
        uint64 rightSum;
    }

    /// @notice Mapping of address of a node to it's index in nodes array
    mapping(address => uint256) public addressToIndexMap;

    /// @notice Mapping of index in nodes array to address of the node
    mapping(uint256 => address) public indexToAddressMap;

    /// @notice Array of nodes stored in the tree
    Node[] public nodes;

    uint256[47] __gap;

    function __TreeUpgradeable_init_unchained() internal onlyInitializing {
        _init_tree();
    }

    /// @dev Initializes the tree with 0 element as the first element.
    /// Node indexes start from 1.
    function _init_tree() internal {
        require(nodes.length == 0, Errors.INVALID_INIT_STATE);
        // root starts from index 1
        nodes.push(Node(0, 0, 0));
    }

    // assumes index is not 0
    function _add_unchecked(uint256 _index, uint64 _value) internal {
        nodes[_index].value += _value;
        while(_index > 1) {
            bool _side = _index % 2 == 0;
            _index = _index >> 1;
            if(_side == true) {
                nodes[_index].leftSum += _value;
            } else {
                nodes[_index].rightSum += _value;
            }
        }
    }

    // assumes index is not 0
    function _sub_unchecked(uint256 _index, uint64 _value) internal {
        nodes[_index].value -= _value;
        while(_index > 1) {
            bool _side = _index % 2 == 0;
            _index = _index >> 1;
            if(_side == true) {
                nodes[_index].leftSum -= _value;
            } else {
                nodes[_index].rightSum -= _value;
            }
        }
    }

    // assumes _addr not already in tree
    function _insert_unchecked(address _addr, uint64 _value) internal {
        uint256 _index = nodes.length;
        nodes.push(Node(0, 0, 0));

        addressToIndexMap[_addr] = _index;
        indexToAddressMap[_index] = _addr;

        _add_unchecked(_index, _value);
    }

    // assumes index is not 0
    function _update_unchecked(uint256 _index, uint64 _value) internal {
        uint64 _currentValue = nodes[_index].value;

        if(_currentValue >= _value) {
            _sub_unchecked(_index, _currentValue - _value);
        } else {
            _add_unchecked(_index, _value - _currentValue);
        }
    }

    // assumes _addr already in tree
    function _update_unchecked(address _addr, uint64 _value) internal {
        _update_unchecked(addressToIndexMap[_addr], _value);
    }

    function _upsert(address _addr, uint64 _value) internal {
        uint256 _index = addressToIndexMap[_addr];
        if(_index == 0) {
            _insert_unchecked(_addr, _value);
        } else {
            _update_unchecked(_index, _value);
        }
    }

    // assumes _addr already in tree at _index
    function _delete_unchecked(address _addr, uint256 _index) internal {
        uint256 _lastNodeIndex = nodes.length - 1;
        address _lastNodeAddress = indexToAddressMap[_lastNodeIndex];
        uint64 _lastNodeValue = nodes[_lastNodeIndex].value;
        // left and right sum will always be 0 for last node

        _sub_unchecked(_lastNodeIndex, _lastNodeValue);
        _update_unchecked(_index, _lastNodeValue);

        indexToAddressMap[_index] = _lastNodeAddress;
        addressToIndexMap[_lastNodeAddress] = _index;

        delete indexToAddressMap[_lastNodeIndex];
        delete addressToIndexMap[_addr];

        nodes.pop();
    }

    function _deleteIfPresent(address _addr) internal {
        uint256 _index = addressToIndexMap[_addr];
        if(_index == 0) {
            return;
        }

        _delete_unchecked(_addr, _index);
    }
}
