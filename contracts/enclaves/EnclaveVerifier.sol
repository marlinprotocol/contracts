// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

contract EnclaveVerifier {
    mapping (address => bool) serverless_enclaves;
    constructor(address[] memory _valid_enclaves) {
        for (uint i = 0; i < _valid_enclaves.length; i++) {
            serverless_enclaves[_valid_enclaves[i]] = true;
        }
    }
    function addEnclave(address _enclave) external {
        serverless_enclaves[_enclave] = true;
    }
    function removeEnclave(address _enclave) external {
        delete serverless_enclaves[_enclave];
    }
    function verifyEnclave(address _enclave_key) external view returns (bool) {
        return serverless_enclaves[_enclave_key];
    }
}