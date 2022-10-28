// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// import "forge-std/console2.sol";

library ClusterLib {
    string constant CANNOT_RR_ADDRESS_ZERO = "1";
    string constant CANNOT_LR_ADDRESS_ZERO = "2";
    string constant CANNOT_BE_ADDRESS_ZERO = "3";
    string constant NODE_NOT_PRESENT_IN_THE_TREE = "4";
    string constant ERROR_OCCURED_DURING_WEIGHTED_SEARCH = "5";
    string constant ERROR_OCCURED_DURING_UPDATE = "6";
    string constant CANNOT_INSERT_DUPLICATE_ELEMENT_INTO_TREE = "7";
    string constant ERROR_OCCURED_DURING_DELETE = "8";
    string constant INSUFFICIENT_ELEMENTS_IN_TREE = "9";
    string constant ERROR_OCCURED_DURING_TRAVERSING_SELECTED_NODE = "10";
    string constant ERROR_OCCURED_DURING_TRAVERSING_NON_SELECTED_NODE = "11";

    /// @notice Checks if the array has an element in it
    /// @param array Array to check
    /// @param element Element to check in the array
    function ifArrayHasElement(address[] memory array, address element) internal pure returns (bool) {
        if (element == address(0)) {
            return false;
        }
        for (uint256 index = 0; index < array.length; index++) {
            if (element == array[index]) {
                return true;
            }
        }
        return false;
    }

    /// @notice Returns indexes when only balances and left and right weights are provided
    /// @param sumOfLeftBalances Sum of balances of nodes on the left
    /// @param balance Balance of the node
    /// @param sumOfRightBalances Sum of balances of nodes on the right
    /// @return First index of the search
    /// @return Second index of the search
    /// @return Third index of the search
    function _getIndexesWithWeights(
        uint256 sumOfLeftBalances,
        uint256 balance,
        uint256 sumOfRightBalances
    )
        internal
        pure
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (sumOfLeftBalances, sumOfLeftBalances + balance, sumOfLeftBalances + balance + sumOfRightBalances);
    }

    /// @notice Add element to array
    /// @param array Array to which the element must be added
    /// @param toAdd Element to add
    /// @return A new array with element added to it
    function _addAddressToEncodedArray(bytes memory array, address toAdd) internal pure returns (bytes memory) {
        address[] memory _currentNodePath = abi.decode(array, (address[]));
        uint256 lengthOfNewPath = _currentNodePath.length + 1;

        assembly {
            mstore(_currentNodePath, lengthOfNewPath)
        }

        _currentNodePath[lengthOfNewPath - 1] = toAdd;
        return abi.encode(_currentNodePath);
    }

    function _getAddressesFromEncodedArray(bytes memory array) internal pure returns (address[] memory) {
        return abi.decode(array, (address[]));
    }

    // function _addAddressToEncodedArray(address[] memory array, address toAdd) internal pure returns (address[] memory) {
    //     let _array = new address[](array.length
    //     array.push(toAdd);
    //     return _array;
    // }

    // function _addAddressToEncodedArray(bytes memory array, address toAdd) internal pure returns (bytes memory) {
    //     return abi.encodePacked(array, toAdd);
    // }

    // function ifArrayHasElement(bytes memory array, address element) internal pure returns (bool) {
    //     uint256 index = 0;
    //     while (index < array.length) {
    //         address temp = bytesToAddress(slice(array, index, 20));
    //         if (temp == element) {
    //             return true;
    //         }
    //         index += 20;
    //     }

    //     return false;
    // }

    // function bytesToAddress(bytes memory bys) private pure returns (address addr) {
    //     assembly {
    //         addr := mload(add(bys, 20))
    //     }
    // }

    // function slice(
    //     bytes memory _bytes,
    //     uint256 _start,
    //     uint256 _length
    // ) internal pure returns (bytes memory) {
    //     require(_length + 31 >= _length, "slice_overflow");
    //     require(_bytes.length >= _start + _length, "slice_outOfBounds");

    //     bytes memory tempBytes;

    //     assembly {
    //         switch iszero(_length)
    //         case 0 {
    //             // Get a location of some free memory and store it in tempBytes as
    //             // Solidity does for memory variables.
    //             tempBytes := mload(0x40)

    //             // The first word of the slice result is potentially a partial
    //             // word read from the original array. To read it, we calculate
    //             // the length of that partial word and start copying that many
    //             // bytes into the array. The first word we copy will start with
    //             // data we don't care about, but the last `lengthmod` bytes will
    //             // land at the beginning of the contents of the new array. When
    //             // we're done copying, we overwrite the full first word with
    //             // the actual length of the slice.
    //             let lengthmod := and(_length, 31)

    //             // The multiplication in the next line is necessary
    //             // because when slicing multiples of 32 bytes (lengthmod == 0)
    //             // the following copy loop was copying the origin's length
    //             // and then ending prematurely not copying everything it should.
    //             let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
    //             let end := add(mc, _length)

    //             for {
    //                 // The multiplication in the next line has the same exact purpose
    //                 // as the one above.
    //                 let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
    //             } lt(mc, end) {
    //                 mc := add(mc, 0x20)
    //                 cc := add(cc, 0x20)
    //             } {
    //                 mstore(mc, mload(cc))
    //             }

    //             mstore(tempBytes, _length)

    //             //update free-memory pointer
    //             //allocating the array padded to 32 bytes like the compiler does now
    //             mstore(0x40, and(add(mc, 31), not(31)))
    //         }
    //         //if we want a zero-length slice let's just return a zero-length array
    //         default {
    //             tempBytes := mload(0x40)
    //             //zero out the 32 bytes slice we are about to return
    //             //we need to do it because Solidity does not garbage collect
    //             mstore(tempBytes, 0)

    //             mstore(0x40, add(tempBytes, 0x20))
    //         }
    //     }

    //     return tempBytes;
    // }
}
