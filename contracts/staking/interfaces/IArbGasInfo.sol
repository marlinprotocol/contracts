// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IArbGasInfo {
    function getPricesInArbGas() external view returns (uint, uint, uint);
}