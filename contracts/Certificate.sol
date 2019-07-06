pragma solidity ^0.4.24;

import "./library/CertificateVerifier.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract UploadInterface {
    function readStake(address _node) public constant returns (uint256);
    function readUploadContract(bytes32 _id) public constant returns (address, string, string, uint256, uint256, uint256, uint256, uint256, uint256);
}

contract Certificate {

    using CertificateVerifier for CertificateVerifier;

    string constant SIGNED_MSG_WIN_PREFIX = "\x19Ethereum Signed Message:\n65";
    address MARLIN_TOKEN_ADDRESS;
    address MARLIN_UPLOAD_CONTRACT_ADDRESS;

    constructor(address _tokenContractAddress, address _uploadContractAddress) public {
        MARLIN_TOKEN_ADDRESS = _tokenContractAddress;
        MARLIN_UPLOAD_CONTRACT_ADDRESS = _uploadContractAddress;
    }

    function settleWinningCertificate(
        bytes32 uploadContractId,
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
        // make sure the sender is approved master node of upload contract
        require(UploadInterface(MARLIN_UPLOAD_CONTRACT_ADDRESS).readStake(msg.sender) > 0);

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

        // fetch delivery reward from upload contract
        uint256 _deliveryReward;
        (,,,,_deliveryReward,,,,) = UploadInterface(MARLIN_UPLOAD_CONTRACT_ADDRESS).readUploadContract(uploadContractId);
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, _deliveryReward));

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
