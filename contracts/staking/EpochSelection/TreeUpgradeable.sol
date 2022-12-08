// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../Errors.sol";

/**
    @dev Contract implements an upgradeable version of tree which stores
    elements in order of insertion. When a element is added, it is added 
    to the left most empty leaf in the tree. When an element is deleted, 
    it is replaced with the element in the right most leaf in the tree.
    Each element in the tree stores the weight of all elements on the left
    and right side of the node.
*/
contract TreeUpgradeable is Initializable {
    /**
        @notice Struct that stores the value on the node and the sum of
        weights on left and right side of the node.
        @param value Value on the node
        @param leftSum Sum of nodes on the left side of the current node
        @param rightSum Sum of nodes on the right side of the current node
    */
    struct Node {
        uint80 value;
        uint80 leftSum;
        uint80 rightSum;
    }
    /**
        @notice Mapping of address of a node to it's index in nodes array
    */
    mapping(address => uint256) public addressToIndexMap;
    /**
        @notice Mapping of index in nodes array to address of the node
    */
    mapping(uint256 => address) public indexToAddressMap;
    /**
        @notice Array of nodes stored in the tree
    */
    Node[] public nodes;

    function __TreeUpgradeable_init() internal onlyInitializing {
        _initTree();
    }

    function __TreeUpgradeable_init_unchained() internal onlyInitializing {
        _initTree();
    }

    /**
        @dev Initializes the tree with 0 element as the first element.
        Node indexes start from 1.
    */
    function _initTree() internal {
        require(nodes.length == 0, Errors.INVALID_INIT_STATE);
        // root starts from index 1
        nodes.push(Node(0, 0, 0));
    }

    function _add(uint256 _index, uint80 _value) internal {
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

    function _sub(uint256 _index, uint80 _value) internal {
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

    function _insert(address _addr, uint80 _value) internal {
        require(_addr != address(0), Errors.CANT_INSERT_ZERO_ADDRESS);
        require(addressToIndexMap[_addr] == 0, Errors.ADDRESS_ALREADY_EXISTS);
        uint256 _index = nodes.length;
        nodes.push(Node(0, 0, 0));

        addressToIndexMap[_addr] = _index;
        indexToAddressMap[_index] = _addr;

        _add(_index, _value);
    }

    function _update(uint256 _index, uint80 _value) internal {
        require(_index != 0, Errors.ZERO_INDEX_INVALID);
        require(indexToAddressMap[_index] != address(0), Errors.ADDRESS_DOESNT_EXIST);
        uint80 _currentValue = nodes[_index].value;

        if(_currentValue >= _value) {
            _sub(_index, _currentValue - _value);
        } else {
            _add(_index, _value - _currentValue);
        }
    }

    function _upsert(address _addr, uint80 _value) internal {
        require(_addr != address(0), Errors.CANT_INSERT_ZERO_ADDRESS);
        uint256 _index = addressToIndexMap[_addr];
        if(_index == 0) {
            _insert(_addr, _value);
        } else {
            _update(_index, _value);
        }
    }

    function _delete(uint256 _index) internal {
        require(_index != 0, Errors.ZERO_INDEX_INVALID);
        address _deleteNodeAddress = indexToAddressMap[_index];
        require(_deleteNodeAddress != address(0), Errors.ADDRESS_DOESNT_EXIST);
        uint256 _lastNodeIndex = nodes.length - 1;
        uint80 _lastNodeValue = nodes[_lastNodeIndex].value;

        _sub(_lastNodeIndex, _lastNodeValue);

        _update(_index, _lastNodeValue);
        address _lastNodeAddress = indexToAddressMap[_lastNodeIndex];

        indexToAddressMap[_index] = _lastNodeAddress;
        addressToIndexMap[_lastNodeAddress] = _index;

        delete indexToAddressMap[_lastNodeIndex];
        delete addressToIndexMap[_deleteNodeAddress];

        nodes.pop();
    }
}