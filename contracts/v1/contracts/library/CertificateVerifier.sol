pragma solidity ^0.4.24;


/**
 * @title Library for certificate verification
 * @author Marlin Labs
 * @notice This will be used by the Certificate contract
 */
library CertificateVerifier {

    // Message - _publisher+_client+_maxNonce, Size - 20+20+1
    string constant SIGNED_MSG_AUTH_PREFIX = "\x19Ethereum Signed Message:\n41";

    /**
    @notice Verifies authorization certificate
    @param _publisher Address of the publisher
    @param _client Address of the client
    @param _maxNonce Max nonce
    @param _v Recovery ID of ECDSA signature
    @param _r R-value of ECDSA signature
    @param _s S-value of ECDSA signature
    @return {
      "_success": "Boolean, true if the certificate is valid"
    }
    */
    function isValidAuthCertificate(
        address _publisher,
        address _client,
        uint8 _maxNonce,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        public
        pure
        returns (bool _valid)
    {
        // Construct message and check if signature is valid
        bytes32 _hashedMsg = keccak256(
            abi.encodePacked(
                SIGNED_MSG_AUTH_PREFIX,
                _publisher,
                _client,
                _maxNonce
            )
        );
        address _signer = ecrecover(
            _hashedMsg,
            _v,
            _r,
            _s
        );
        _valid = (_signer == _publisher);
    }

    // Message - _authR+_authS+_authV+_nonce, Size - 32+32+1+1
    string constant SIGNED_MSG_SERV_PREFIX = "\x19Ethereum Signed Message:\n66";

    /**
    @notice Verifies service certificate
    @param _publisher Address of the publisher
    @param _client Address of the client
    @param _maxNonce Max nonce
    @param _authV Recovery ID of ECDSA signature in authorization certificate
    @param _authR R-value of ECDSA signature in authorization certificate
    @param _authS S-value of ECDSA signature in authorization certificate
    @param _nonce Nonce of this txn
    @param _authV Recovery ID of ECDSA signature in service certificate
    @param _authR R-value of ECDSA signature in service certificate
    @param _authS S-value of ECDSA signature in service certificate
    @return {
      "_success": "Boolean, true if the certificate is valid"
    }
    */
    function isValidServiceCertificate(
        address _publisher,
        address _client,
        uint8 _maxNonce,
        uint8 _authV,
        bytes32 _authR,
        bytes32 _authS,
        uint8 _nonce,
        uint8 _servV,
        bytes32 _servR,
        bytes32 _servS
    )
        public
        pure
        returns (bool _valid)
    {
        // Verify authorization certificate
        require(
            isValidAuthCertificate(
                _publisher,
                _client,
                _maxNonce,
                _authV,
                _authR,
                _authS
            ),
            "Authorization certificate should be valid"
        );

        // Verify nonce is within range
        require(_nonce > 0, "Nonce should be positive");
        require(_nonce <= _maxNonce, "Nonce should be less than maximum");


        // Construct message and check if signature is valid
        bytes32 _hashedMsg = keccak256(
            abi.encodePacked(
                SIGNED_MSG_SERV_PREFIX,
                _authR,
                _authS,
                _authV,
                _nonce
            )
        );
        address _signer = ecrecover(
            _hashedMsg,
            _servV,
            _servR,
            _servS
        );
        _valid = (_signer == _client);
    }

    // Message - _servR+_servS+_servV, Size - 32+32+1
    string constant SIGNED_MSG_WIN_PREFIX = "\x19Ethereum Signed Message:\n65";

    /**
    @notice Verifies claim certificate
    @param _publisher Address of the publisher
    @param _client Address of the client
    @param _maxNonce Max nonce
    @param _nonce Nonce of this txn
    @param _vArray Array of the recovery IDs of the signatures
    @param _rArray Array of the r-value of ECDSA signatures
    @param _sArray Array of the s-value of ECDSA signatures
    @return {
      "_success": "Boolean, true if the certificate is valid"
    }
    */
    function isValidClaimCertificate(
        address _publisher,
        address _client,
        uint8 _maxNonce,
        uint8 _nonce,
        uint8[3] _vArray,
        bytes32[3] _rArray,
        bytes32[3] _sArray,
        address _winner
    )
        public
        pure
        returns (bool _is)
    {
        // Verify service certificate
        require(
            isValidServiceCertificate(
                _publisher,
                _client,
                _maxNonce,
                _vArray[0],
                _rArray[0],
                _sArray[0],
                _nonce,
                _vArray[1],
                _rArray[1],
                _sArray[1]
            ),
            "Service certificate should be valid"
        );

        // Construct message and check if signature is valid
        bytes32 _hashedMsg = keccak256(
            abi.encodePacked(
                SIGNED_MSG_WIN_PREFIX,
                _rArray[1],
                _sArray[1],
                _vArray[1]
            )
        );
        address _signer = ecrecover(
            _hashedMsg,
            _vArray[2],
            _rArray[2],
            _sArray[2]
        );
        _is = (_signer == _winner);
    }


    struct ReplayProtectionStruct {
        mapping(bytes32 => bool) used;
    }

    function isServiceCertUsed(ReplayProtectionStruct storage _self, bytes32 _hash)
        public
        view
        returns (bool _used)
    {
        _used = _self.used[_hash];
    }
}
