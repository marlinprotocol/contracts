// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library Errors {
    string constant ZERO_INDEX_INVALID = "1";
    string constant CANT_INSERT_ZERO_ADDRESS = "2";
    string constant ADDRESS_ALREADY_EXISTS = "3";
    string constant ADDRESS_DOESNT_EXIST = "4";
    string constant ERROR_OCCURED_DURING_WEIGHTED_SEARCH = "5";
    string constant ERROR_OCCURED_DURING_UPDATE = "6";
    string constant CANNOT_INSERT_DUPLICATE_ELEMENT_INTO_TREE = "7";
    string constant ERROR_OCCURED_DURING_DELETE = "8";
    string constant INSUFFICIENT_ELEMENTS_IN_TREE = "9";
    string constant ERROR_OCCURED_DURING_TRAVERSING_SELECTED_NODE = "10";
    string constant ERROR_OCCURED_DURING_TRAVERSING_NON_SELECTED_NODE = "11";
    string constant CLUSTER_SELECTION_NOT_COMPLETE = "12";
}
