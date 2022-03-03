// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../arbBridge/IInbox.sol";

contract IInboxImplementation is IInbox {
    constructor() public {}

    function createRetryableTicket(
        address destAddr,
        uint256 l2CallValue,
        uint256 maxSubmissionCost,
        address excessFeeRefundAddress,
        address callValueRefundAddress,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes calldata data
    ) external payable returns (uint256) {
        return 0;
    }
}

