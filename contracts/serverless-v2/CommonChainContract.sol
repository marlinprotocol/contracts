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
// import "../staking/tree/TreeUpgradeable.sol";

contract CommonChainContract is
    Initializable, // initializer
    ContextUpgradeable, // _msgSender, _msgData
    ERC165Upgradeable, // supportsInterface
    AccessControlEnumerableUpgradeable, // RBAC enumeration
    AttestationAutherUpgradeable,
    // TreeUpgradeable,
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

    function __CommonChainContract_init(
        address _admin,
        EnclaveImage[] memory _images,
        IERC20 _token,
        uint256 _executionBufferTime,
        uint256 _noOfNodesToSelect
    ) public initializer {
        __Context_init();
        __ERC165_init();
        __AccessControlEnumerable_init();
        __AttestationAuther_init_unchained(_images);
        // __TreeUpgradeable_init_unchained();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        token = _token;
        executionBufferTime = _executionBufferTime;
        noOfNodesToSelect = _noOfNodesToSelect;
    }

    //-------------------------------- Initializer end --------------------------------//

    //-------------------------------- Gateway start --------------------------------//

    IERC20 public token;
    uint256 public executionBufferTime;
    uint256 public noOfNodesToSelect;

    struct RequestChain {
        address contractAddress;
        string rpcUrl;
    }

    mapping(uint256 => RequestChain) public requestChains;

    // TODO: Add a getter to return chainIDs gateway is registered on, check if chainIDs is actually required in gateway struct
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
        bytes32 digest = keccak256(abi.encode(_chainIds));
        address signer = digest.recover(_signature);

        _allowOnlyVerified(signer);

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

    // function addGatewayStake(
    //     bytes memory _enclavePubKey,
    //     uint256 _amount
    // ) external onlyGatewayOperator(_enclavePubKey) {
    //     // transfer stake
    //     token.safeTransferFrom(_msgSender(), address(this), _amount);

    //     address enclaveKey = _pubKeyToAddress(_enclavePubKey);
    //     gateways[enclaveKey].stakeAmount += _amount;

    //     emit GatewayStakeAdded(_enclavePubKey, _amount, gateways[enclaveKey].stakeAmount);
    // }

    // function removeGatewayStake(
    //     bytes memory _enclavePubKey,
    //     uint256 _amount
    // ) external onlyGatewayOperator(_enclavePubKey) {
    //     // transfer stake
    //     token.safeTransfer(_msgSender(), _amount);

    //     address enclaveKey = _pubKeyToAddress(_enclavePubKey);
    //     gateways[enclaveKey].stakeAmount -= _amount;

    //     emit GatewayStakeRemoved(_enclavePubKey, _amount, gateways[enclaveKey].stakeAmount);
    // }

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

    // function addChains(
    //     bytes memory _enclavePubKey,
    //     uint256[] memory _chainIds
    // ) external onlyGatewayOperator(_enclavePubKey) {
    //     require(_chainIds.length > 0, "EMPTY_REQ_CHAINS");

    //     for (uint256 index = 0; index < _chainIds.length; index++) {
    //         addChain(
    //             _enclavePubKey, 
    //             _chainIds[index]
    //         );
    //     }
    // }

    // function addChain(
    //     bytes memory _enclavePubKey,
    //     uint256 _chainId
    // ) public onlyGatewayOperator(_enclavePubKey) {
    //     require(requestChains[_chainId].contractAddress != address(0), "UNSUPPORTED_CHAIN");

    //     address enclaveKey = _pubKeyToAddress(_enclavePubKey);
    //     uint256[] memory chainIdList = gateways[enclaveKey].chainIds;
    //     for (uint256 index = 0; index < chainIdList.length; index++) {
    //         require(chainIdList[index] != _chainId, "CHAIN_ALREADY_EXISTS");
    //     }
    //     gateways[enclaveKey].chainIds.push(_chainId);

    //     emit ChainAdded(_enclavePubKey, _chainId);
    // }

    // function removeChains(
    //     bytes memory _enclavePubKey,
    //     uint256[] memory _chainIds
    // ) external onlyGatewayOperator(_enclavePubKey) {
    //     require(_chainIds.length > 0, "EMPTY_REQ_CHAINS");

    //     for (uint256 index = 0; index < _chainIds.length; index++) {
    //         removeChain(
    //             _enclavePubKey, 
    //             _chainIds[index]
    //         );
    //     }
    // }

    // function removeChain(
    //     bytes memory _enclavePubKey,
    //     uint256 _chainId
    // ) public onlyGatewayOperator(_enclavePubKey) {
    //     address enclaveKey = _pubKeyToAddress(_enclavePubKey);
    //     uint256[] memory chainIdList = gateways[enclaveKey].chainIds;
    //     uint256 len = chainIdList.length;
    //     require(len > 0, "EMPTY_CHAINLIST");

    //     uint256 index = 0;
    //     for (; index < len; index++) {
    //         if (chainIdList[index] == _chainId) 
    //             break;
    //     }

    //     require(index == len, "CHAIN_NOT_FOUND");
    //     if (index != len - 1)
    //         gateways[enclaveKey].chainIds[index] = gateways[enclaveKey].chainIds[len - 1];

    //     gateways[enclaveKey].chainIds.pop();

    //     emit ChainRemoved(_enclavePubKey, _chainId);
    // }

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
        address signer = digest.recover(_signature);

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

        // add node to the tree
        // _insert_unchecked(enclaveKey, uint64(_stakeAmount));

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
        require(
            executors[enclaveKey].activeJobs == 0,
            "ACTIVE_JOBS_PENDING"
        );
        delete executors[enclaveKey];

        // remove node from the tree
        // _deleteIfPresent(enclaveKey);

        emit ExecutorDeregistered(_enclavePubKey);

        // return stake amount
    }

    // function addExecutorStake(
    //     bytes memory _enclavePubKey,
    //     uint256 _amount
    // ) external onlyExecutorOperator(_enclavePubKey) {
    //     // transfer stake
    //     token.safeTransferFrom(_msgSender(), address(this), _amount);

    //     address enclaveKey = _pubKeyToAddress(_enclavePubKey);
    //     executors[enclaveKey].stakeAmount += _amount;

    //     // update the value in tree only if the node exists in the tree
    //     // if(executors[enclaveKey].activeJobs != executors[enclaveKey].jobCapacity)
    //     //     _update_unchecked(enclaveKey, uint64(_amount));

    //     emit ExecutorStakeAdded(_enclavePubKey, _amount, executors[enclaveKey].stakeAmount);
    // }

    // function removeExecutorStake(
    //     bytes memory _enclavePubKey,
    //     uint256 _amount
    // ) external onlyExecutorOperator(_enclavePubKey) {
    //     // transfer stake
    //     token.safeTransfer(_msgSender(), _amount);

    //     address enclaveKey = _pubKeyToAddress(_enclavePubKey);
    //     executors[enclaveKey].stakeAmount -= _amount;

    //     // update the value in tree only if the node exists in the tree
    //     // if(executors[enclaveKey].activeJobs != executors[enclaveKey].jobCapacity)
    //     //     _update_unchecked(enclaveKey, uint64(_amount));

    //     emit ExecutorStakeRemoved(_enclavePubKey, _amount, executors[enclaveKey].stakeAmount);
    // }

    //-------------------------------- Executor end --------------------------------//

    //-------------------------------- Job start --------------------------------//

    struct Job {
        uint256 reqChainId;
        bytes32 codehash;
        bytes codeInputs;
        uint256 deadline;
        uint256 execStartTime;
        address jobOwner;
        address gatewayOperator;
        uint8 outputCount;
    }

    // jobId => Job
    mapping(uint256 => Job) public jobs;

    // jobId => executors
    mapping(uint256 => address[]) public selectedExecutors;

    // struct JobOutput {
    //     bytes output;
    //     uint256 totalTime;
    //     uint8 errorCode;
    // }

    // CAN REMOVE
    // jobId => JobOutput
    // mapping(uint256 => JobOutput[]) public jobOutputs;

    event JobRelayed(
        uint256 indexed jobId,
        uint256 reqChainId,
        bytes32 codehash,
        bytes codeInputs,
        uint256 deadline,
        address[] selectedNodes
    );

    event JobResponded(
        uint256 indexed jobId,
        bytes output,
        uint256 totalTime,
        uint256 errorCode,
        uint8 outputCount
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
        // TODO: can we trust gateway enclave here and not use require
        require(requestChains[_reqChainId].contractAddress != address(0), "UNSUPPORTED_CHAIN");

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

        address[] memory selectedNodes = _selectExecutors(_jobId);
        // for (uint256 index = 0; index < selectedNodes.length; index++) {
        //     executors[selectedNodes[index]].activeJobs += 1;
            
        //     // if jobCapacity reached then delete from the tree so as to not consider this node in new jobs allocation
        //     if(executors[selectedNodes[index]].activeJobs == executors[selectedNodes[index]].jobCapacity)
        //         _deleteIfPresent(selectedNodes[index]);
        // }

        jobs[_jobId] = Job({
            reqChainId: _reqChainId,
            codehash: _codehash,
            codeInputs: _codeInputs,
            deadline: _deadline,
            execStartTime: block.timestamp,
            jobOwner: _jobOwner,
            gatewayOperator: _msgSender(),
            outputCount: 0
        });

        // TODO emit executors (DONE)
        emit JobRelayed(_jobId, _reqChainId, _codehash, _codeInputs, _deadline, selectedNodes);
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

        require(isJobExecutor(_jobId, signer), "NOT_SELECTED_EXECUTOR");

        // add back the node to the tree as now it can accept a new job
        // if(executors[signer].activeJobs == executors[signer].jobCapacity)
        //     _insert_unchecked(signer, uint64(executors[signer].stakeAmount));

        executors[signer].activeJobs -= 1;

        // jobOutputs[_jobId].push(JobOutput({
        //     output: _output,
        //     totalTime: _totalTime,
        //     errorCode: _errorCode
        // }));

        emit JobResponded(_jobId, _output, _totalTime, _errorCode, ++jobs[_jobId].outputCount);

        // cleanup job after 3rd output submitted

        // on reward distribution, 1st output executor node gets max reward
        // reward ratio - 2:1:0
    }


    address[] temp;
    function _selectExecutors(
        uint256 _jobId
    ) internal returns (address[] memory selectedNodes) {
        uint256 randomizer = uint256(keccak256(abi.encode(blockhash(block.number - 1), block.timestamp)));
        // selectedNodes = _selectN(randomizer, noOfNodesToSelect);
        // require(selectedNodes.length != 0, "NO_EXECUTOR_SELECTED");
        // Update this to enclaves key
        temp.push(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
        temp.push(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
        temp.push(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);
        selectedNodes = temp;
        selectedExecutors[_jobId] = selectedNodes;
    }

    function isJobExecutor(
        uint256 _jobId,
        address _executor
    ) public view returns (bool) {
        address[] memory selectedNodes = selectedExecutors[_jobId];
        uint256 len = selectedExecutors[_jobId].length;
        for (uint256 index = 0; index < len; index++) {
            if(selectedNodes[index] == _executor)
                return true;
        }
        return false;
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

    // function reassignExecutionNode(
    //     uint256 _jobId,
    //     bytes memory _executorPubKey
    // ) external {
    //     // check for time
    //     require(
    //         block.timestamp > jobs[_jobId].execStartTime + jobs[_jobId].deadline + executionBufferTime,
    //         "DEADLINE_NOT_OVER"
    //     );

    //     jobs[_jobId].executorId = _executorPubKey;
    //     jobs[_jobId].execStartTime = block.timestamp;

    //     address executorKey = _pubKeyToAddress(_executorPubKey);
    //     executors[executorKey].activeJobs -= 1;

    //     emit ExecutorReassigned(_jobId, _executorPubKey);

            // delete job (no new execution node is selected)
            // delete previously selected list of executors (selectedExecutors[])
    //     // slash Execution node

    // }

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
