pragma solidity ^0.4.24;

import 'LIN.sol';

contract Certificate {
    function isValidAuthCertificate(
        address publisherAddress,
        address clientAddress,
        uint8 maxNonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        public
        pure
        returns (bool result)
    {
        bytes32 hashedMsg = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n41", publisherAddress, clientAddress, maxNonce));
        address signatureAddress = ecrecover(hashedMsg, v, r, s);
        return signatureAddress == publisherAddress;
    }

    function isValidServiceCertificate(
        address publisherAddress,
        address clientAddress,
        uint8 maxNonce,
        uint8 auth_v,
        bytes32 auth_r,
        bytes32 auth_s,
        uint8 nonce,
        uint8 serv_v,
        bytes32 serv_r,
        bytes32 serv_s
    )
        public
        pure
        returns (bool result)
    {
        require(nonce > 0);
        require(nonce <= maxNonce);
        require(isValidAuthCertificate(publisherAddress, clientAddress, maxNonce, auth_v, auth_r, auth_s));
        bytes32 hashedMsg = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n66", auth_r, auth_s, auth_v, nonce));
        address signatureAddress = ecrecover(hashedMsg, serv_v, serv_r, serv_s);
        return signatureAddress == clientAddress;
    }

    function isWinningCertificate(
        address publisherAddress,
        address clientAddress,
        uint8 maxNonce,
        uint8 nonce,
        uint8[3] vArray,
        bytes32[3] rArray,
        bytes32[3] sArray,
        address winner
    )
        public
        pure
        returns (bool result)
    {
        require(isValidServiceCertificate(publisherAddress, clientAddress, maxNonce, vArray[0], rArray[0], sArray[0], nonce, vArray[1], rArray[1], sArray[1]));

        // Remove hashing step if you can confirm that ECDSA signatures are uniformly distributed
        bytes32 finalHash = keccak256(abi.encodePacked(rArray[2], sArray[2], vArray[2]));
        require(finalHash[0] & 0x3 == 0); // 25% chance

        bytes32 hashedMsg = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n65", rArray[1], sArray[1], vArray[1]));
        address signatureAddress = ecrecover(hashedMsg, vArray[2], rArray[2], sArray[2]);
        return signatureAddress == winner;
    }

    function settleWinningCertificate(
        address publisherAddress,
        address clientAddress,
        uint8 maxNonce,
        uint8 nonce,
        uint8[3] vArray,
        bytes32[3] rArray,
        bytes32[3] sArray
    )
        external
        returns (bool result)
    {
        require(isWinningCertificate(publisherAddress, clientAddress, maxNonce, nonce, vArray, rArray, sArray, msg.sender));

        LIN tokenContract = LIN(address(0x692a70D2e424a56D2C6C27aA97D1a86395877b3A));
        return tokenContract.transfer(msg.sender, 10);
    }
}
