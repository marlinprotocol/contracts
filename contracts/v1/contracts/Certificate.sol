pragma solidity ^0.4.24;

import "./library/CertificateVerifier.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract UploadInterface {
    function readStake(address _node) public view returns (uint256);
    function readPublisherOffer(bytes32 _id) public view returns (address, string, string, uint256, uint256, uint256, uint256, uint256, uint256);
}


/**
@title Certificate-verification and payout-handling contract
@author Marlin Labs
@notice Master nodes/storage nodes can fetch rewards for their certificates
*/
contract Certificate {

    using CertificateVerifier for CertificateVerifier;
    using CertificateVerifier for CertificateVerifier.ReplayProtectionStruct;

    address tokenContractAddress;
    address uploadContractAddress;

    CertificateVerifier.ReplayProtectionStruct serviceCerts;

    /**
    @notice Constructor that sets the Marlin token contract address and Publisher-side Upload contract address
    @param _tokenContractAddress Address of the Marlin token contract
    @param _uploadContractAddress Address of the publisher-side Upload contract
    */
    constructor(address _tokenContractAddress, address _uploadContractAddress) public {
        tokenContractAddress = _tokenContractAddress;
        uploadContractAddress = _uploadContractAddress;
    }

    /**
    @notice Function to be called to fetch reward for delivery certificate
    @param _offerId ID of the publisher offer from the Upload contract
    @param _publisher Address of the publisher
    @param _client Address of the client
    @param _maxNonce Max nonce
    @param _nonce Nonce of this txn
    @param _vArray Array of the recovery IDs of the signatures
    @param _rArray Array of the r-value of ECDSA signatures
    @param _sArray Array of the s-value of ECDSA signatures
    @return {
      "_success": "Boolean, true if the payout was successful"
    }
    */
    function settleWinningCertificate(
        bytes32 _offerId,
        address _publisher,
        address _client,
        uint8 _maxNonce,
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
        require(serviceCerts.isServiceCertUsed(_servCertHashed) == false, "Replay protection");
        serviceCerts.used[_servCertHashed] = true;

        require(
            CertificateVerifier.isValidClaimCertificate(
                _publisher,
                _client,
                _maxNonce,
                _nonce,
                _vArray,
                _rArray,
                _sArray,
                msg.sender
            ),
            "Certificate should be winning"
        );

        // fetch delivery reward from upload contract
        uint256 _deliveryReward;
        (,,,,_deliveryReward,,,,) = UploadInterface(uploadContractAddress).readPublisherOffer(_offerId);
        require(ERC20(tokenContractAddress).transfer(msg.sender, _deliveryReward), "Successful transfer");

        _success = true;
    }
}
