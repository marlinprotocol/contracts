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
import "../staking/tree/TreeUpgradeable.sol";
import "./CommonChainJobs.sol";

contract CommonChainExecutors is
    Initializable, // initializer
    ContextUpgradeable, // _msgSender, _msgData
    ERC165Upgradeable, // supportsInterface
    AccessControlEnumerableUpgradeable, // RBAC enumeration
    AttestationAutherUpgradeable,
    TreeUpgradeable,
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

    modifier onlyJobsContract() {
        require(_msgSender() == address(jobs), "ONLY_JOBS_CONTRACT");
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

    function __CommonChainExecutors_init(
        address _admin,
        EnclaveImage[] memory _images,
        IERC20 _token
    ) public initializer {
        __Context_init();
        __ERC165_init();
        __AccessControlEnumerable_init();
        __AttestationAuther_init_unchained(_images);
        __TreeUpgradeable_init_unchained();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        token = _token;
    }

    //-------------------------------- Initializer end --------------------------------//

    IERC20 public token;
    CommonChainJobs public jobs;

    function setJobsContract(CommonChainJobs _jobs) external onlyAdmin {
        jobs = _jobs;
    }

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
        _insert_unchecked(enclaveKey, uint64(_stakeAmount));

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
        _deleteIfPresent(enclaveKey);

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

        // update the value in tree only if the node exists in the tree
        if(executors[enclaveKey].activeJobs != executors[enclaveKey].jobCapacity)
            _update_unchecked(enclaveKey, uint64(_amount));

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

        // update the value in tree only if the node exists in the tree
        if(executors[enclaveKey].activeJobs != executors[enclaveKey].jobCapacity)
            _update_unchecked(enclaveKey, uint64(_amount));

        emit ExecutorStakeRemoved(_enclavePubKey, _amount, executors[enclaveKey].stakeAmount);
    }

    function allowOnlyVerified(address _key) external view {
        _allowOnlyVerified(_key);
    }

    //--------------------------------------- Executor end -----------------------------------------//

    //-------------------------------- JobsContract functions start --------------------------------//

    function selectExecutors(
        uint256 _noOfNodesToSelect
    ) external onlyJobsContract returns (address[] memory selectedNodes) {
        selectedNodes = _selectExecutors(_noOfNodesToSelect);
        for (uint256 index = 0; index < selectedNodes.length; index++) {
            address executorKey = selectedNodes[index];
            executors[executorKey].activeJobs += 1;
            
            // if jobCapacity reached then delete from the tree so as to not consider this node in new jobs allocation
            if(executors[executorKey].activeJobs == executors[executorKey].jobCapacity)
                _deleteIfPresent(executorKey);
        }
    }

    function _selectExecutors(
        uint256 _noOfNodesToSelect
    ) internal view returns (address[] memory selectedNodes) {
        uint256 randomizer = uint256(keccak256(abi.encode(blockhash(block.number - 1), block.timestamp)));
        selectedNodes = _selectN(randomizer, _noOfNodesToSelect);
        require(selectedNodes.length != 0, "NO_EXECUTOR_SELECTED");
    }

    function updateOnSubmitOutput(
        address _executorKey
    ) external onlyJobsContract {
        // add back the node to the tree as now it can accept a new job
        if(executors[_executorKey].activeJobs == executors[_executorKey].jobCapacity)
            _insert_unchecked(_executorKey, uint64(executors[_executorKey].stakeAmount));

        executors[_executorKey].activeJobs -= 1;
    }

    function updateOnExecutionTimeoutSlash(
        address _executorKey
    ) external onlyJobsContract {
        // add back the node to the tree as now it can accept a new job
        if(executors[_executorKey].activeJobs == executors[_executorKey].jobCapacity)
            _insert_unchecked(_executorKey, uint64(executors[_executorKey].stakeAmount));
        
        executors[_executorKey].activeJobs -= 1;
    }

    //-------------------------------- JobsContract functions end --------------------------------//

}
