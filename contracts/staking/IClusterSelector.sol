// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IClusterSelector {
    struct Node {
        address cluster; // sorting condition
        uint256 balance;
        address left;
        address right;
        uint256 sumOfLeftBalances;
        uint256 sumOfRightBalances;
        uint256 height;
    }

    function insert(address cluster, uint256 clusterBalance) external;

    function update(address cluster, uint256 clusterBalance) external;
}
