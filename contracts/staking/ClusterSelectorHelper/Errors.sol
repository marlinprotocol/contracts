// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library Errors {
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
}
