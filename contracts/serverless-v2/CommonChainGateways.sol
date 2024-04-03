// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../enclaves/AttestationAutherUpgradeable.sol";

contract CommonChainGateways is
    Initializable, // initializer
    ContextUpgradeable, // _msgSender, _msgData
    ERC165Upgradeable, // supportsInterface
    AccessControlEnumerableUpgradeable, // RBAC enumeration
    AttestationAutherUpgradeable,
    UUPSUpgradeable // public upgrade
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor(
        IAttestationVerifier attestationVerifier,
        uint256 maxAge
    ) AttestationAutherUpgradeable(attestationVerifier, maxAge) initializer {}

    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "only admin");
        _;
    }

    //-------------------------------- Overrides start --------------------------------//

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC165Upgradeable, AccessControlEnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _grantRole(bytes32 role, address account) internal virtual override(AccessControlEnumerableUpgradeable) {
        super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal virtual override(AccessControlEnumerableUpgradeable) {
        super._revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "AV:RR-All admins cant be removed");
    }

    function _authorizeUpgrade(
        address /*account*/
    ) internal view override onlyAdmin {}

    //-------------------------------- Overrides end --------------------------------//

    //-------------------------------- Initializer start --------------------------------//

    function __CommonChainGateways_init(
        address _admin,
        EnclaveImage[] memory _images,
        IERC20 _token
    ) public initializer {
        require(_admin != address(0), "ZERO_ADDRESS_ADMIN");
        require(address(_token) != address(0), "ZERO_ADDRESS_TOKEN");

        __Context_init();
        __ERC165_init();
        __AccessControlEnumerable_init();
        __AttestationAuther_init_unchained(_images);
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        token = _token;
    }

    //-------------------------------- Initializer end --------------------------------//

    IERC20 public token;
    
    function setTokenContract(IERC20 _token) external onlyAdmin {
        token = _token;
    }

    //-------------------------------- Gateway start --------------------------------//


    struct RequestChain {
        address contractAddress;
        string rpcUrl;
    }

    mapping(uint256 => RequestChain) public requestChains;

    struct Gateway {
        address operator;
        uint256[] chainIds;
        uint256 stakeAmount;
        bool status;
    }

    // enclaveAddress => Gateway
    mapping(address => Gateway) public gateways;

    modifier onlyGatewayOperator(bytes memory _enclavePubKey) {
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        require(
            gateways[enclaveKey].operator == _msgSender(),
            "ONLY_GATEWAY_OPERATOR"
        );
        _;
    }

    event GatewayRegistered(
        bytes enclavePubKey,
        address indexed enclaveAddress,
        address indexed operator
    );

    event GatewayDeregistered(bytes enclavePubKey);

    event GatewayStakeAdded(
        bytes enclavePubKey,
        uint256 addedAmount,
        uint256 totalAmount
    );

    event GatewayStakeRemoved(
        bytes enclavePubKey,
        uint256 removedAmount,
        uint256 totalAmount
    );

    event ChainAddedGlobal(
        uint256 chainId,
        address contractAddress,
        string rpcUrl
    );

    event ChainRemovedGlobal(
        uint256 chainId
    );

    event ChainAdded(
        bytes enclavePubKey,
        uint256 chainId
    );

    event ChainRemoved(
        bytes enclavePubKey,
        uint256 chainId
    );

    function registerGateway(
        bytes memory _attestation,
        bytes memory _enclavePubKey,
        bytes memory _PCR0,
        bytes memory _PCR1,
        bytes memory _PCR2,
        uint256 _enclaveCPUs,
        uint256 _enclaveMemory,
        uint256 _timestampInMilliseconds,
        uint256[] memory _chainIds,
        bytes memory _signature,
        uint256 _stakeAmount
    ) external {
        // attestation verification
        bytes32 imageId = keccak256(abi.encodePacked(_PCR0, _PCR1, _PCR2));
        _verifyKey(
            _attestation,
            _enclavePubKey,
            imageId,
            _enclaveCPUs,
            _enclaveMemory,
            _timestampInMilliseconds
        );

        // signature check
        _verifySign(_chainIds, _signature);

        // transfer stake
        token.safeTransferFrom(_msgSender(), address(this), _stakeAmount);
        
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        for (uint256 index = 0; index < _chainIds.length; index++) {
            require(requestChains[_chainIds[index]].contractAddress != address(0), "UNSUPPORTED_CHAIN");
        }

        // check missing for validating chainIds array for multiple same chainIds
        
        gateways[enclaveKey] = Gateway({
            operator: _msgSender(),
            chainIds: _chainIds,
            stakeAmount: _stakeAmount,
            status: true
        });

        emit GatewayRegistered(_enclavePubKey, enclaveKey, _msgSender());
    }

    function _verifySign(
        uint256[] memory _chainIds,
        bytes memory _signature
    ) internal view {
        bytes32 digest = keccak256(abi.encodePacked(_chainIds));
        address signer = digest.recover(_signature);

        _allowOnlyVerified(signer);
    }

    function deregisterGateway(
        bytes memory _enclavePubKey
    ) external onlyGatewayOperator(_enclavePubKey) {
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        require(
            gateways[enclaveKey].operator != address(0),
            "INVALID_ENCLAVE_KEY"
        );
        delete gateways[enclaveKey];

        _revokeEnclaveKey(_enclavePubKey);

        emit GatewayDeregistered(_enclavePubKey);

        // return stake amount
    }

    function addGatewayStake(
        bytes memory _enclavePubKey,
        uint256 _amount
    ) external onlyGatewayOperator(_enclavePubKey) {
        // transfer stake
        token.safeTransferFrom(_msgSender(), address(this), _amount);

        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        gateways[enclaveKey].stakeAmount += _amount;

        emit GatewayStakeAdded(_enclavePubKey, _amount, gateways[enclaveKey].stakeAmount);
    }

    function removeGatewayStake(
        bytes memory _enclavePubKey,
        uint256 _amount
    ) external onlyGatewayOperator(_enclavePubKey) {
        // transfer stake
        token.safeTransfer(_msgSender(), _amount);

        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        gateways[enclaveKey].stakeAmount -= _amount;

        emit GatewayStakeRemoved(_enclavePubKey, _amount, gateways[enclaveKey].stakeAmount);
    }

    function addChainGlobal(
        uint256[] memory _chainIds,
        RequestChain[] memory _requestChains
    ) external onlyAdmin {
        require(_chainIds.length > 0 && _chainIds.length == _requestChains.length, "INVALID_LENGTH");
        for (uint256 index = 0; index < _requestChains.length; index++) {
            RequestChain memory reqChain = _requestChains[index];
            uint256 chainId = _chainIds[index];
            requestChains[chainId] = reqChain;

            emit ChainAddedGlobal(chainId, reqChain.contractAddress, reqChain.rpcUrl);
        }
    }

    function removeChainGlobal(
        uint256[] memory _chainIds
    ) external onlyAdmin {
        require(_chainIds.length > 0, "INVALID_LENGTH");
        for (uint256 index = 0; index < _chainIds.length; index++) {
            uint256 chainId = _chainIds[index];
            delete requestChains[chainId];

            emit ChainRemovedGlobal(chainId);
        }
    }

    function addChains(
        bytes memory _enclavePubKey,
        uint256[] memory _chainIds
    ) external onlyGatewayOperator(_enclavePubKey) {
        require(_chainIds.length > 0, "EMPTY_REQ_CHAINS");

        for (uint256 index = 0; index < _chainIds.length; index++) {
            addChain(
                _enclavePubKey, 
                _chainIds[index]
            );
        }
    }

    function addChain(
        bytes memory _enclavePubKey,
        uint256 _chainId
    ) public onlyGatewayOperator(_enclavePubKey) {
        require(requestChains[_chainId].contractAddress != address(0), "UNSUPPORTED_CHAIN");

        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        uint256[] memory chainIdList = gateways[enclaveKey].chainIds;
        for (uint256 index = 0; index < chainIdList.length; index++) {
            require(chainIdList[index] != _chainId, "CHAIN_ALREADY_EXISTS");
        }
        gateways[enclaveKey].chainIds.push(_chainId);

        emit ChainAdded(_enclavePubKey, _chainId);
    }

    function removeChains(
        bytes memory _enclavePubKey,
        uint256[] memory _chainIds
    ) external onlyGatewayOperator(_enclavePubKey) {
        require(_chainIds.length > 0, "EMPTY_REQ_CHAINS");

        for (uint256 index = 0; index < _chainIds.length; index++) {
            removeChain(
                _enclavePubKey, 
                _chainIds[index]
            );
        }
    }

    function removeChain(
        bytes memory _enclavePubKey,
        uint256 _chainId
    ) public onlyGatewayOperator(_enclavePubKey) {
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        uint256[] memory chainIdList = gateways[enclaveKey].chainIds;
        uint256 len = chainIdList.length;
        require(len > 0, "EMPTY_CHAINLIST");

        uint256 index = 0;
        for (; index < len; index++) {
            if (chainIdList[index] == _chainId) 
                break;
        }

        require(index == len, "CHAIN_NOT_FOUND");
        if (index != len - 1)
            gateways[enclaveKey].chainIds[index] = gateways[enclaveKey].chainIds[len - 1];

        gateways[enclaveKey].chainIds.pop();

        emit ChainRemoved(_enclavePubKey, _chainId);
    }

    function isChainSupported(
        uint256 _reqChainId
    ) external view returns (bool) {
        return (requestChains[_reqChainId].contractAddress != address(0));
    }

    function allowOnlyVerified(address _key) external view {
        _allowOnlyVerified(_key);
    }

    //-------------------------------- Gateway end --------------------------------//

}
