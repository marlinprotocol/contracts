// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

contract User {
    address payable serverless_addr;

    constructor(address addr) {
        serverless_addr = payable(addr);
    }

    event CalledBack(bytes32 indexed jobId, bytes outputs);

    bytes32 txhash = 0xc7d9122f583971d4801747ab24cf3e83984274b8d565349ed53a73e0a547d113;

    function setJob(bytes calldata input) external payable returns (bool success) {
        uint256 job_deposit = 1000000000;
        uint256 callback_deposit = 1 ether;
        (bool _success,) = serverless_addr.call{value: job_deposit + callback_deposit}(
            abi.encodeWithSignature("jobPlace(bytes32,bytes,uint256,uint256)",
                txhash,
                input,
                job_deposit,
                callback_deposit
            )
        );
        return _success;
    }

    function oysterResultCall(bytes32 jobId, bytes calldata output)  public {
        emit CalledBack(jobId, output);
    }

    receive() external payable {

    }
}
