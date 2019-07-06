pragma solidity ^0.4.24;

import "./library/CertificateVerifier.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract Certificate {

    using CertificateVerifier for CertificateVerifier;

    string constant SIGNED_MSG_WIN_PREFIX = "\x19Ethereum Signed Message:\n65";
    uint256 constant TRANSFER_VALUE = 10;
    address MARLIN_TOKEN_ADDRESS;

    constructor(address _tokenContractAddress) public {
        MARLIN_TOKEN_ADDRESS = _tokenContractAddress;
    }

    function settleWinningCertificate(
        address publisher,
        address client,
        uint8 max,
        uint8 nonce,
        uint8[3] vArray,
        bytes32[3] rArray,
        bytes32[3] sArray
    )
        public
        returns (bool _success)
    {
        require(isWinningCertificate(
            publisher,
            client,
            max,
            nonce,
            vArray,
            rArray,
            sArray,
            msg.sender
        ));
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, TRANSFER_VALUE));
        _success = true;
    }

    function isWinningCertificate(
        address publisher,
        address client,
        uint8 max,
        uint8 nonce,
        uint8[3] vArray,
        bytes32[3] rArray,
        bytes32[3] sArray,
        address winner
    )
        internal
        pure
        returns (bool _is)
    {
        require(CertificateVerifier.isValidServiceCertificate(
            publisher,
            client,
            max,
            vArray[0],
            rArray[0],
            sArray[0],
            nonce,
            vArray[1],
            rArray[1],
            sArray[1]
        ));

        bytes32 hashedMsg = keccak256(abi.encodePacked(
            SIGNED_MSG_WIN_PREFIX,
            rArray[1],
            sArray[1],
            vArray[1]
        ));
        address signer = ecrecover(hashedMsg, vArray[2], rArray[2], sArray[2]);
        _is = (signer == winner);
    }
}
