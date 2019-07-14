pragma solidity ^0.4.24;

import "./library/CertificateVerifier.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract UploadInterface {
    function readStake(address _node) public constant returns (uint256);
    function readPublisherOffer(bytes32 _id) public constant returns (address, string, string, uint256, uint256, uint256, uint256, uint256, uint256);
}

/**
* @title Certificate-verification and payout-handling contract
* @author Marlin Labs
* @notice Master nodes/storage nodes can fetch rewards for their certificates
 */
contract Certificate {

    using CertificateVerifier for CertificateVerifier;
    using CertificateVerifier for CertificateVerifier.ReplayProtectionStruct;

    string constant SIGNED_MSG_WIN_PREFIX = "\x19Ethereum Signed Message:\n65";
    address MARLIN_TOKEN_ADDRESS;
    address MARLIN_UPLOAD_CONTRACT_ADDRESS;

    CertificateVerifier.ReplayProtectionStruct serviceCerts;

    /**
     * @notice Constructor that sets the Marlin token contract address and Publisher-side Upload contract address
     * @param _tokenContractAddress Address of the Marlin token contract
     * @param _uploadContractAddress Address of the publisher-side Upload contract
     */
    constructor(address _tokenContractAddress, address _uploadContractAddress) public {
        MARLIN_TOKEN_ADDRESS = _tokenContractAddress;
        MARLIN_UPLOAD_CONTRACT_ADDRESS = _uploadContractAddress;
    }

    /**
     * @notice Function to be called to fetch reward for delivery certificate
     * @param _offerId ID of the publisher offer from the Upload contract
     * @param _publisher Address of the publisher who created the offer
     * @param _client Address of the master node
     * @param _max Max certificates
     * @param _nonce Nonce of this txn
     * @param _vArray Array of the recovery IDs of the signatures
     * @param _rArray Array of the r-value of ECDSA signatures
     * @param _sArray Array of the s-value of ECDSA signatures
     * @return _success Boolean, true if the payout was successful
     */
    function settleWinningCertificate(
        bytes32 _offerId,
        address _publisher,
        address _client,
        uint8 _max,
        uint8 _nonce,
        uint8[3] _vArray,
        bytes32[3] _rArray,
        bytes32[3] _sArray
    )
        public
        returns (bool _success)
    {
        // make sure service certificate is not re-used
        bytes32 _servCertHashed = keccak256(abi.encodePacked(_vArray[1], _rArray[1], _sArray[1]));
        require(serviceCerts.isServiceCertUsed(_servCertHashed) == false);
        serviceCerts.used[_servCertHashed] = true;

        require(isWinningCertificate(
            _publisher,
            _client,
            _max,
            _nonce,
            _vArray,
            _rArray,
            _sArray,
            msg.sender
        ));

        // fetch delivery reward from upload contract
        uint256 _deliveryReward;
        (,,,,_deliveryReward,,,,) = UploadInterface(MARLIN_UPLOAD_CONTRACT_ADDRESS).readPublisherOffer(_offerId);
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, _deliveryReward));

        _success = true;
    }

    function isWinningCertificate(
        address _publisher,
        address _client,
        uint8 _max,
        uint8 _nonce,
        uint8[3] _vArray,
        bytes32[3] _rArray,
        bytes32[3] _sArray,
        address _winner
    )
        internal
        pure
        returns (bool _is)
    {
        require(CertificateVerifier.isValidServiceCertificate(
            _publisher,
            _client,
            _max,
            _vArray[0],
            _rArray[0],
            _sArray[0],
            _nonce,
            _vArray[1],
            _rArray[1],
            _sArray[1]
        ));

        bytes32 _hashedMsg = keccak256(abi.encodePacked(
            SIGNED_MSG_WIN_PREFIX,
            _rArray[1],
            _sArray[1],
            _vArray[1]
        ));
        address _signer = ecrecover(_hashedMsg, _vArray[2], _rArray[2], _sArray[2]);
        _is = (_signer == _winner);
    }
}
