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
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "AV:RR-All admins cannot be removed");
    }

    function _authorizeUpgrade(address /*account*/) onlyAdmin internal view override {}

    function initialize(EnclaveImage[] memory images, address[] memory enclaveKeys) external initializer {
        // The images and their enclave keys are whitelisted without verification that enclave keys are created within
        // the enclave. This is to initialize chain of trust and will be replaced with a more robust solution.
        require(images.length != 0, "AV:I-At least one image must be provided");
        require(images.length == enclaveKeys.length, "AV:I-Image and key length mismatch");

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        for (uint i = 0; i < enclaveKeys.length; i++) {
            address enclaveKey = enclaveKeys[i];
            bytes32 imageId = _whitelistImage(images[i]);
            isVerified[enclaveKey] = imageId;
            emit EnclaveKeyWhitelisted(enclaveKey, imageId);
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

    event EnclaveImageWhitelisted(bytes32 indexed imageId, bytes PCR0, bytes PCR1, bytes PCR2);
    event WhitelistedEnclaveRevoked(address indexed enclaveKey, bytes32 indexed imageId);
    event EnclaveKeyWhitelisted(address indexed enclaveKey, bytes32 indexed imageId);
    event EnclaveKeyVerified(address indexed enclaveKey, bytes32 indexed imageId);

    function whitelistImage(bytes memory PCR0, bytes memory PCR1, bytes memory PCR2) external onlyAdmin {
        _whitelistImage(EnclaveImage(PCR0, PCR1, PCR2));
    }

    // TODO: is this flexibility necessary?
    function whitelistEnclaveKey(address enclaveKey, bytes32 imageId) external onlyAdmin {
        require(whitelistedImages[imageId].PCR0.length != 0, "AV:W-Image not whitelisted");
        require(enclaveKey != address(0), "AV:W-Invalid enclave key");
        require(isVerified[enclaveKey] == bytes32(0), "AV:W-Enclave key already verified");
        isVerified[enclaveKey] = imageId;
        emit EnclaveKeyWhitelisted(enclaveKey, imageId);
    }

    function revokeWhitelistedEnclave(address enclaveKey) external onlyAdmin {
        require(isVerified[enclaveKey] != bytes32(0), "AV:R-Enclave key not verified");
        bytes32 imageId = isVerified[enclaveKey];
        delete whitelistedImages[imageId];
        delete isVerified[enclaveKey];
        emit WhitelistedEnclaveRevoked(enclaveKey, imageId);
    }

    // This function is used to add enclave key of a whitelisted image to the list of verified enclave keys.
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
        bool isValid = _verify(attestation, sourceEnclaveKey, enclaveKey, image, enclaveCPUs, enclaveMemory);
        require(isValid, "AV:VE-Attestation must be signed by source enclave");

        isVerified[enclaveKey] = imageId;
        emit EnclaveKeyVerified(enclaveKey, imageId);
    }

    // This function is used to verify enclave key of any image by the enclave key generated in a whitelisted image.
    function verify(
        bytes memory attestation,
        address sourceEnclaveKey,
        address enclaveKey,
        bytes memory PCR0,
        bytes memory PCR1,
        bytes memory PCR2,
        uint256 enclaveCPUs,
        uint256 enclaveMemory
    ) external view returns(bool) {
        return _verify(attestation, sourceEnclaveKey, enclaveKey, EnclaveImage(PCR0, PCR1, PCR2), enclaveCPUs, enclaveMemory);
    }

    function verify(bytes memory data) external view returns (bool) {
        (
            bytes memory attestation, 
            address sourceEnclaveKey, 
            address enclaveKey, 
            bytes memory PCR0, 
            bytes memory PCR1, 
            bytes memory PCR2, 
            uint256 enclaveCPUs, 
            uint256 enclaveMemory
        ) = abi.decode(data, (bytes, address, address, bytes, bytes, bytes, uint256, uint256));
        return _verify(attestation, sourceEnclaveKey, enclaveKey, EnclaveImage(PCR0, PCR1, PCR2), enclaveCPUs, enclaveMemory);
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

    function _verify(
        bytes memory attestation,
        address sourceEnclaveKey,
        address enclaveKey,
        EnclaveImage memory image,
        uint256 enclaveCPUs,
        uint256 enclaveMemory
    ) internal view returns(bool) {
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

        return (sourceEnclaveKey == signer);
    }
}