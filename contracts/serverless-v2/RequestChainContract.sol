// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../enclaves/AttestationAutherUpgradeable.sol";

contract RequestChainContract is
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

    function __RequestChainContract_init(
        address _admin,
        IERC20 _token,
        EnclaveImage[] memory _images
    ) public initializer {
        __Context_init();
        __ERC165_init();
        __AccessControlEnumerable_init();
        __AttestationAuther_init_unchained(_images);
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        token = _token;
    }

    //-------------------------------- Initializer end --------------------------------//

    //-------------------------------- Gateway start --------------------------------//

    IERC20 public token;

    struct Gateway {
        address operator;
        bool status;
    }

    // enclaveKey => Gateway
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

    function registerGateway(
        bytes memory _attestation,
        bytes memory _enclavePubKey,
        bytes memory _PCR0,
        bytes memory _PCR1,
        bytes memory _PCR2,
        uint256 _enclaveCPUs,
        uint256 _enclaveMemory,
        uint256 _timestampInMilliseconds
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
        
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        gateways[enclaveKey] = Gateway({
            operator: _msgSender(),
            status: true
        });

        emit GatewayRegistered(_enclavePubKey, enclaveKey, _msgSender());
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
    }

    //-------------------------------- Gateway End --------------------------------//

    //-------------------------------- Job start --------------------------------//

    struct Job {
        bytes32 codehash;
        bytes codeInputs;
        uint256 userTimeout;
        uint256 maxGasPrice;
        uint256 usdcDeposit;
        uint256 callbackDeposit;
        address jobOwner;
    }

    mapping(uint256 => Job) public jobs;

    uint256 public jobCount;

    struct JobOutput {
        bytes output;
        uint256 totalTime;
        uint8 errorCode;
        bool received;
    }

    // jobId => JobOutput
    mapping(uint256 => JobOutput) public jobOutputs;

    modifier onlyJobOwner(uint256 _jobId) {
        require(jobs[_jobId].jobOwner == _msgSender(), "NOT_JOB_OWNER");
        _;
    }

    event JobRelayed(
        uint256 indexed jobId,
        bytes32 codehash,
        bytes codeInputs,
        uint256 userTimeout,
        uint256 maxGasPrice,
        uint256 usdcDeposit,
        uint256 callbackDeposit
    );

    event JobResponded(
        uint256 indexed jobId,
        bytes output,
        uint256 totalTime,
        uint256 errorCode
    );

    event JobCancelled(uint256 indexed jobId);

    function relayJob(
        bytes32 _codehash,
        bytes memory _codeInputs,
        uint256 _userTimeout,
        uint256 _maxGasPrice,
        uint256 _usdcDeposit,
        uint256 _callbackDeposit
    ) external {
        jobs[++jobCount] = Job({
            codehash: _codehash,
            codeInputs: _codeInputs,
            userTimeout: block.timestamp + _userTimeout,
            maxGasPrice: _maxGasPrice,
            usdcDeposit: _usdcDeposit,
            callbackDeposit: _callbackDeposit,
            jobOwner: _msgSender()
        });

        emit JobRelayed(jobCount, _codehash, _codeInputs, _userTimeout, _maxGasPrice, _usdcDeposit, _callbackDeposit);
    }

    function jobResponse(
        bytes memory _signature,
        uint256 _jobId,
        bytes memory _output,
        uint256 _totalTime,
        uint8 _errorCode
    ) external {
        // signature check
        bytes32 digest = keccak256(
            abi.encode(
                _jobId,
                _output,
                _totalTime,
                _errorCode
            )
        );
        address signer = digest.recover(_signature);

        _allowOnlyVerified(signer);

        jobOutputs[_jobId] = JobOutput({
            output: _output,
            totalTime: _totalTime,
            errorCode: _errorCode,
            received: true
        });

        emit JobResponded(_jobId, _output, _totalTime, _errorCode);

        // release escrow


    }

    function jobCancel(
        uint256 _jobId
    ) external onlyJobOwner(_jobId) {
        require(!jobOutputs[_jobId].received, "JOB_OUTPUT_ALREADY_RECEIVED");

        // check time case

        delete jobs[_jobId];
        emit JobCancelled(_jobId);

        // release escrow 
    }

    //-------------------------------- Job End --------------------------------//

}
