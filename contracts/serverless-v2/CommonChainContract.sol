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

contract CommonChainContract is
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

    uint256 public userTimeout;
    uint256 public executionBufferTime;
    uint256 public globalMinTimeout;
    uint256 public globalMaxTimeout;

    function __CommonChainContract_init(
        address _admin,
        EnclaveImage[] memory _images,
        IERC20 _token,
        uint256 _globalMinTimeout,
        uint256 _globalMaxTimeout
    ) public initializer {
        __Context_init();
        __ERC165_init();
        __AccessControlEnumerable_init();
        __AttestationAuther_init_unchained(_images);
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        token = _token;
        globalMinTimeout = _globalMinTimeout;
        globalMaxTimeout = _globalMaxTimeout;
    }

    //-------------------------------- Initializer end --------------------------------//

    //-------------------------------- Gateway start --------------------------------//

    IERC20 public token;

    struct Gateway {
        address operator;
        uint256[] requestChainIds;
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
        uint256[] memory _requestChainIds,
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
        bytes32 digest = keccak256(abi.encode(_requestChainIds));
        address signer = digest.recover(_attestation);

        _allowOnlyVerified(signer);

        // transfer stake
        token.safeTransferFrom(_msgSender(), address(this), _stakeAmount);

        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        gateways[enclaveKey] = Gateway({
            operator: _msgSender(),
            requestChainIds: _requestChainIds,
            stakeAmount: _stakeAmount,
            status: true
        });

        // emit GatewayRegistered(_enclavePubKey, enclaveKey, _msgSender());
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

    function addChain(
        bytes memory _enclavePubKey,
        uint256 _chainId
    ) external onlyGatewayOperator(_enclavePubKey) {
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        uint256[] memory chainList = gateways[enclaveKey].requestChainIds;
        for (uint256 index = 0; index < chainList.length; index++) {
            require(chainList[index] != _chainId, "CHAIN_ALREADY_EXISTS");
        }
        gateways[enclaveKey].requestChainIds.push(_chainId);

        emit ChainAdded(_enclavePubKey, _chainId);
    }

    function removeChain(
        bytes memory _enclavePubKey,
        uint256 _chainId
    ) external onlyGatewayOperator(_enclavePubKey) {
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        uint256[] memory chainList = gateways[enclaveKey].requestChainIds;
        uint256 len = chainList.length;
        require(len > 0, "EMPTY_CHAINLIST");

        uint256 index = 0;
        for (; index < len; index++) {
            if (chainList[index] == _chainId) break;
        }

        require(index == len, "CHAIN_NOT_FOUND");
        if (index != len - 1)
            gateways[enclaveKey].requestChainIds[index] = gateways[enclaveKey].requestChainIds[len - 1];

        gateways[enclaveKey].requestChainIds.pop();

        emit ChainRemoved(_enclavePubKey, _chainId);
    }

    //-------------------------------- Gateway end --------------------------------//

    //-------------------------------- Executor start --------------------------------//

    struct Executor {
        address operator;
        uint256 jobCapacity;
        uint256 activeJobs;
        uint256 stakeAmount;
        bool status;
    }

    // enclaveKey => Execution node details
    mapping(address => Executor) public executors;

        modifier onlyExecutorOperator(bytes memory _enclavePubKey) {
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        require(
            executors[enclaveKey].operator == _msgSender(),
            "ONLY_EXECUTOR_OPERATOR"
        );
        _;
    }

    event ExecutorRegistered(
        bytes enclavePubKey,
        address indexed enclaveAddress,
        address indexed operator
    );

    event ExecutorDeregistered(bytes enclavePubKey);

    event ExecutorStakeAdded(
        bytes enclavePubKey,
        uint256 addedAmount,
        uint256 totalAmount
    );

    event ExecutorStakeRemoved(
        bytes enclavePubKey,
        uint256 removedAmount,
        uint256 totalAmount
    );

    function registerExecutor(
        bytes memory _attestation,
        bytes memory _enclavePubKey,
        bytes memory _PCR0,
        bytes memory _PCR1,
        bytes memory _PCR2,
        uint256 _enclaveCPUs,
        uint256 _enclaveMemory,
        uint256 _timestampInMilliseconds,
        uint256 _jobCapacity,
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
        bytes32 digest = keccak256(abi.encode(_jobCapacity));
        address signer = digest.recover(_attestation);

        _allowOnlyVerified(signer);

        // transfer stake
        token.safeTransferFrom(_msgSender(), address(this), _stakeAmount);

        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        executors[enclaveKey] = Executor({
            operator: _msgSender(),
            jobCapacity: _jobCapacity,
            activeJobs: 0,
            stakeAmount: _stakeAmount,
            status: true
        });

        // emit ExecutorRegistered(_enclavePubKey, enclaveKey, _msgSender());
    }

    function deregisterExecutor(
        bytes memory _enclavePubKey
    ) external onlyExecutorOperator(_enclavePubKey) {
        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        require(
            executors[enclaveKey].operator != address(0),
            "INVALID_ENCLAVE_KEY"
        );
        delete executors[enclaveKey];

        emit ExecutorDeregistered(_enclavePubKey);

        // return stake amount
    }

    function addExecutorStake(
        bytes memory _enclavePubKey,
        uint256 _amount
    ) external onlyExecutorOperator(_enclavePubKey) {
        // transfer stake
        token.safeTransferFrom(_msgSender(), address(this), _amount);

        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        executors[enclaveKey].stakeAmount += _amount;

        emit ExecutorStakeAdded(_enclavePubKey, _amount, executors[enclaveKey].stakeAmount);
    }

    function removeExecutorStake(
        bytes memory _enclavePubKey,
        uint256 _amount
    ) external onlyExecutorOperator(_enclavePubKey) {
        // transfer stake
        token.safeTransfer(_msgSender(), _amount);

        address enclaveKey = _pubKeyToAddress(_enclavePubKey);
        executors[enclaveKey].stakeAmount -= _amount;

        emit ExecutorStakeRemoved(_enclavePubKey, _amount, executors[enclaveKey].stakeAmount);
    }

    //-------------------------------- Executor end --------------------------------//

    //-------------------------------- Job start --------------------------------//

    struct Job {
        uint256 reqChainId;
        bytes32 codehash;
        bytes codeInputs;
        uint256 deadline;
        address jobOwner;
        bytes executorId;
        address gatewayOperator;
    }

    mapping(uint256 => Job) public jobs;

    struct JobOutput {
        bytes output;
        uint256 totalTime;
        uint8 errorCode;
    }

    // jobId => JobOutput
    mapping(uint256 => JobOutput) public jobOutputs;


    event JobRelayed(
        uint256 indexed jobId,
        uint256 reqChainId,
        bytes32 codehash,
        bytes codeInputs,
        uint256 deadline,
        address jobOwner,
        bytes executorPubKey,
        address gatewayOperator
    );

    event JobResponded(
        uint256 indexed jobId,
        bytes output,
        uint256 totalTime,
        uint256 errorCode
    );

    function relayJob(
        bytes memory _signature,
        uint256 _jobId,
        uint256 _reqChainId,
        bytes32 _codehash,
        bytes memory _codeInputs,
        uint256 _deadline,
        address _jobOwner
    ) external {
        // signature check
        bytes32 digest = keccak256(
            abi.encode(
                _jobId,
                _reqChainId,
                _codehash,
                _codeInputs,
                _deadline,
                _jobOwner
            )
        );
        address signer = digest.recover(_signature);

        _allowOnlyVerified(signer);

        // get executor id using algo
        bytes memory executorPubKey = "guess";
        address executorKey = _pubKeyToAddress(executorPubKey);

        require(
            executors[executorKey].activeJobs <
                executors[executorKey].jobCapacity,
            "MAX_JOB_LIMIT_REACHED"
        );
        executors[executorKey].activeJobs += 1;

        jobs[_jobId] = Job({
            reqChainId: _reqChainId,
            codehash: _codehash,
            codeInputs: _codeInputs,
            deadline: block.timestamp + _deadline,
            jobOwner: _jobOwner,
            executorId: executorPubKey,
            gatewayOperator: _msgSender()
        });

        emit JobRelayed(_jobId, _reqChainId, _codehash, _codeInputs, _deadline, _jobOwner, executorPubKey, _msgSender());
    }

    function submitOutput(
        bytes memory _signature,
        uint256 _jobId,
        bytes memory _output,
        uint256 _totalTime,
        uint8 _errorCode
    ) external {
        // signature check
        bytes32 digest = keccak256(
            abi.encode(_jobId, _output, _totalTime, _errorCode)
        );
        address signer = digest.recover(_signature);

        _allowOnlyVerified(signer);

        jobOutputs[_jobId] = JobOutput({
            output: _output,
            totalTime: _totalTime,
            errorCode: _errorCode
        });

        executors[signer].activeJobs -= 1;

        emit JobResponded(_jobId, _output, _totalTime, _errorCode);
    }

    //-------------------------------- Job end --------------------------------//

    //-------------------------------- Timeout start --------------------------------//

    event ExecutorReassigned(
        uint256 jobId,
        bytes executorPubKey
    );

    event GatewayReassigned(
        uint256 jobId,
        address indexed prevGatewayOperator,
        address indexed newGatewayOperator
    );

    function reassignExecutionNode(
        uint256 _jobId,
        bytes memory _executorPubKey
    ) external {
        // check for time
        require(
            block.timestamp + userTimeout + executionBufferTime >
                jobs[_jobId].deadline,
            "DEADLINE_NOT_OVER"
        );

        jobs[_jobId].executorId = _executorPubKey;
        // jobs[_jobId].deadline = block.timestamp + _deadline;

        address executorKey = _pubKeyToAddress(_executorPubKey);
        executors[executorKey].activeJobs -= 1;

        emit ExecutorReassigned(_jobId, _executorPubKey);
    }

    function reassignGatewayRelay(
        address _gatewayOperatorOld,
        uint256 _jobId,
        bytes memory _signature
    ) external {
        // check for time

        require(_msgSender() != jobs[_jobId].gatewayOperator, "SAME_GATEWAY");
        // signature check
        bytes32 digest = keccak256(abi.encode(_jobId, _gatewayOperatorOld));
        address signer = digest.recover(_signature);

        _allowOnlyVerified(signer);
        
        jobs[_jobId].gatewayOperator = _msgSender();

        emit GatewayReassigned(_jobId, _gatewayOperatorOld, _msgSender());

        // slash old gateway
    }

    //-------------------------------- Timeout end --------------------------------//
}
