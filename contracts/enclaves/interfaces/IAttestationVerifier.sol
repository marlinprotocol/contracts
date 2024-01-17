// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IAttestationVerifier {
    function verifyUnsafe(
        bytes memory attestation,
        bytes memory  enclaveKey,
        bytes memory PCR0,
        bytes memory PCR1,
        bytes memory PCR2,
        uint256 enclaveCPUs,
        uint256 enclaveMemory
    ) external view returns(bool);
    function verify(
        bytes memory attestation,
        bytes memory  enclaveKey,
        bytes memory PCR0,
        bytes memory PCR1,
        bytes memory PCR2,
        uint256 enclaveCPUs,
        uint256 enclaveMemory
    ) external view;

    function verifyUnsafe(bytes memory data) external view returns (bool);
    function verify(bytes memory data) external view;
}
