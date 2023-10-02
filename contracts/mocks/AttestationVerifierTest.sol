// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAttestationVerifier {
    function verify(
        bytes memory attestation,
        address sourceEnclaveKey,
        address enclaveKey,
        bytes memory PCR0,
        bytes memory PCR1,
        bytes memory PCR2,
        uint256 enclaveCPUs,
        uint256 enclaveMemory
    ) external view returns (bool);

    function verify(bytes memory data) external view returns (bool);
}

contract AttestationVerifierTest {
    IAttestationVerifier public verifier;

    constructor(address _verifier) {
        verifier = IAttestationVerifier(_verifier);
    }

    function verify(
        bytes memory attestation,
        address sourceEnclaveKey,
        address enclaveKey,
        bytes memory PCR0,
        bytes memory PCR1,
        bytes memory PCR2,
        uint256 enclaveCPUs,
        uint256 enclaveMemory
    ) external view {
        require(
            verifier.verify(attestation, sourceEnclaveKey, enclaveKey, PCR0, PCR1, PCR2, enclaveCPUs, enclaveMemory), 
            "verification failed"
        );
    }

    function verify(bytes memory data) external view {
        require(verifier.verify(data), "verification failed");
    }
}