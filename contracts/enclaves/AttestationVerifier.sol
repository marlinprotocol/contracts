// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

contract AttestationVerifier is Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable  // public upgrade
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap_0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "only admin");
        _;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _grantRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0);
    }

    function _authorizeUpgrade(address /*account*/) onlyAdmin internal view override {}

    function initialize(EnclaveImage[] memory images, address[] memory enclaveKeys) external initializer {
        require(images.length == enclaveKeys.length, "AV:I-Image and key length mismatch");
        for (uint i = 0; i < enclaveKeys.length; i++) {
            address enclaveKey = enclaveKeys[i];
            bytes32 imageId = _whitelistImage(images[i]);
            isVerified[enclaveKey] = imageId;
            emit AttestationVerified(enclaveKey, imageId);
        }
    }

    uint256[50] private __gap_1;

    struct EnclaveImage {
        bytes PCR0;
        bytes PCR1;
        bytes PCR2;
    }
    string constant ATTESTATION_PREFIX = "Enclave Attestation Verified";

    mapping(bytes32 => EnclaveImage) public whitelistedImages;
    mapping(address => bytes32) public isVerified;

    event EnclaveImageWhitelisted(bytes32 imageId, bytes PCR0, bytes PCR1, bytes PCR2);
    event WhitelistedImageRemoved(bytes32 imageId);
    event AttestationVerified(address enclaveKey, bytes32 imageId);

    function whitelistImage(bytes memory PCR0, bytes memory PCR1, bytes memory PCR2) external onlyAdmin {
        _whitelistImage(EnclaveImage(PCR0, PCR1, PCR2));
    }

    function _whitelistImage(EnclaveImage memory image) internal returns(bytes32) {
        require(
            image.PCR0.length == 48 &&
            image.PCR1.length == 48 &&
            image.PCR2.length == 48,
            "AV:IWI-PCR values must be 48 bytes"
        );

        bytes32 imageId = keccak256(abi.encodePacked(image.PCR0, image.PCR1, image.PCR2));
        whitelistedImages[imageId] = EnclaveImage(image.PCR0, image.PCR1, image.PCR2);
        emit EnclaveImageWhitelisted(imageId, image.PCR0, image.PCR1, image.PCR2);
        return imageId;
    }

    function removeWhitelistedImage(bytes32 imageId) external onlyAdmin {
        delete whitelistedImages[imageId];
        emit WhitelistedImageRemoved(imageId);
    }

    function verifyEnclaveKey(
        bytes memory attestation, 
        address sourceEnclaveKey,
        address enclaveKey,
        bytes32 imageId, 
        uint256 enclaveCPUs, 
        uint256 enclaveMemory
    ) external {
        require(
            whitelistedImages[imageId].PCR0.length != 0,
            "AV:V-Image of Enclave to verify must be whitelisted"
        );

        EnclaveImage memory image = whitelistedImages[imageId];
        _verify(attestation, sourceEnclaveKey, enclaveKey, image, enclaveCPUs, enclaveMemory);

        isVerified[enclaveKey] = imageId;
        emit AttestationVerified(enclaveKey, imageId);
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
        _verify(attestation, sourceEnclaveKey, enclaveKey, EnclaveImage(PCR0, PCR1, PCR2), enclaveCPUs, enclaveMemory);
    }

    function _verify(
        bytes memory attestation,
        address sourceEnclaveKey,
        address enclaveKey,
        EnclaveImage memory image,
        uint256 enclaveCPUs,
        uint256 enclaveMemory
    ) internal view {
        bytes32 sourceImageId = isVerified[sourceEnclaveKey];
        require(
            sourceImageId != bytes32(0),
            "AV:V-Enclave must be verified"
        );
        require(
            whitelistedImages[sourceImageId].PCR0.length != 0,
            "AV:V-Source image must be whitelisted"
        );

        bytes32 digest = keccak256(abi.encode(
            ATTESTATION_PREFIX, 
            enclaveKey, 
            image.PCR0, 
            image.PCR1, 
            image.PCR2, 
            enclaveCPUs, 
            enclaveMemory
        ));

        address signer = ECDSAUpgradeable.recover(digest, attestation);

        require(sourceEnclaveKey == signer, "AV:V-Attestation must be signed by source enclave");
    }
}