pragma solidity ^0.4.24;

/**
 * @title Library for certificate verification
 * @author Marlin Labs
 * @notice This will be used by the Certificate contract
 */
library CertificateVerifier {

    string constant SIGNED_MSG_AUTH_PREFIX = "\x19Ethereum Signed Message:\n41";
    string constant SIGNED_MSG_SERV_PREFIX = "\x19Ethereum Signed Message:\n66";

    modifier is_valid_nonce(uint8 nonce, uint8 max) {
        require(nonce > 0);
        require(nonce <= max);
        _;
    }

    function isValidServiceCertificate(
        address _publisher,
        address _client,
        uint8 _max,
        uint8 _auth_v,
        bytes32 _auth_r,
        bytes32 _auth_s,
        uint8 _nonce,
        uint8 _serv_v,
        bytes32 _serv_r,
        bytes32 _serv_s
    )
        public
        pure
        is_valid_nonce(_nonce, _max)
        returns (bool _valid)
    {
        require(isValidAuthCertificate(
            _publisher,
            _client,
            _max,
            _auth_v,
            _auth_r,
            _auth_s
        ));
        bytes32 _hashedMsg = keccak256(abi.encodePacked(
            SIGNED_MSG_SERV_PREFIX,
            _auth_r,
            _auth_s,
            _auth_v,
            _nonce
        ));
        address _signer = ecrecover(
            _hashedMsg,
            _serv_v,
            _serv_r,
            _serv_s
        );
        _valid = (_signer == _client);
    }

    function isValidAuthCertificate(
        address _publisher,
        address _client,
        uint8 _max,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        internal
        pure
        returns (bool _valid)
    {
        bytes32 _hashedMsg = keccak256(abi.encodePacked(
            SIGNED_MSG_AUTH_PREFIX,
            _publisher,
            _client,
            _max
        ));
        address _signer = ecrecover(_hashedMsg, _v, _r, _s);
        _valid = (_signer == _publisher);
    }
}
