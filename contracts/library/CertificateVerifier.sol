pragma solidity ^0.4.24;

library CertificateVerifier {

    string constant SIGNED_MSG_AUTH_PREFIX = "\x19Ethereum Signed Message:\n41";
    string constant SIGNED_MSG_SERV_PREFIX = "\x19Ethereum Signed Message:\n66";

    modifier is_valid_nonce(uint8 nonce, uint8 max) {
        require(nonce > 0);
        require(nonce <= max);
        _;
    }

    function isValidServiceCertificate(
        address publisher,
        address client,
        uint8 max,
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
        is_valid_nonce(nonce, max)
        returns (bool _valid)
    {
        require(isValidAuthCertificate(
            publisher,
            client,
            max,
            auth_v,
            auth_r,
            auth_s
        ));
        bytes32 hashedMsg = keccak256(abi.encodePacked(
            SIGNED_MSG_SERV_PREFIX,
            auth_r,
            auth_s,
            auth_v,
            nonce
        ));
        address signer = ecrecover(
            hashedMsg,
            serv_v,
            serv_r,
            serv_s
        );
        _valid = (signer == client);
    }

    function isValidAuthCertificate(
        address publisher,
        address client,
        uint8 max,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        internal
        pure
        returns (bool _valid)
    {
        bytes32 hashedMsg = keccak256(abi.encodePacked(
            SIGNED_MSG_AUTH_PREFIX,
            publisher,
            client,
            max
        ));
        address signer = ecrecover(hashedMsg, v, r, s);
        _valid = (signer == publisher);
    }
}
