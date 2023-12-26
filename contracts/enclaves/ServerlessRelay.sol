// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";
import "./EnclaveVerifier.sol";

contract ServerlessRelay is
    Initializable,  // initializer
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

//-------------------------------- Overrides start --------------------------------//

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

    function _authorizeUpgrade(address /*account*/) onlyRole(DEFAULT_ADMIN_ROLE) internal view override {}

//-------------------------------- Overrides end --------------------------------//

//-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap_1;

    function initialize(address _admin, EnclaveVerifier _serverlessVerifier)
        initializer
        public
    {
        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        active_provider_count = 0;
        serverlessVerifier = _serverlessVerifier;
    }

//-------------------------------- Initializer end --------------------------------//

//-------------------------------- Jobs start --------------------------------//

    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE");

    // Constant Pricing wei per 1ms
    uint256 public constant RATE = 1000000;
    struct Job {
        address sender;
        bool active;
        bytes32 txhash;
        bytes inputs;
        bytes4 id;
        address provider;
        uint256 off_chain_deposit;
        uint256 callback_deposit;
        uint256 block_number; // Block number which placed this job
    }

    struct Provider {
        uint id;
        bool active;
    }

    mapping (address => Provider) providers;
    address[] public provider_list;

    Job[] public jobs;

    uint256 current_provider;

    uint256 active_provider_count;

    EnclaveVerifier serverlessVerifier;

    uint256[49] private __gap_2;

    uint constant MinCallbackGas = 4334;

    uint256 constant JobBlockLimit = 5;

    event JobPlaced(
        uint256 job,
        address indexed sender,
        bytes32 indexed txhash,
        address indexed provider,
        bytes inputs,
        uint256 off_chain_deposit
    );

    event JobFinished(uint256 indexed job, address indexed node, bool indexed success, bytes outputs);
    event JobFailed(uint256 indexed job, uint indexed error, uint exec_time);

    modifier activeJob(uint256 _job) {
        require(jobs[_job].active, "only active jobs");
        _;
    }

    function _nextActiveProvider() internal returns (address) {
        uint len = provider_list.length;
        do {
            current_provider = (current_provider + 1) % len;
        } while (!providers[provider_list[current_provider]].active);
        return provider_list[current_provider];
    }

    function _jobPlace(
        address _sender,
        bytes32 _txhash,
        bytes calldata _inputs,
        uint256 _off_chain_deposit,
        uint256 _callback_deposit
    )
        internal
    {
        require(
            msg.value == _off_chain_deposit + _callback_deposit,
            "Transferred value is not equal to the given deposit values"
        );
        // Check availability of active providers
        require(active_provider_count > 0, "Active providers are unavailable");
        bytes4 id = bytes4(keccak256(abi.encodePacked(_txhash, _inputs)));
        // TODO: Choose provider
        // Implement round robin
        address provider = _nextActiveProvider();
        // TODO: Set the start time, so that provider can be bound to some deadline to post result
        // Can't use time, because time can vary 0-900 seconds. We can go with blocks, that result should be submitted
        // before 5 blocks 
        jobs.push(Job(
            _sender,
            true,
            _txhash,
            _inputs,
            id,
            provider,
            _off_chain_deposit,
            _callback_deposit,
            block.number
        ));

        emit JobPlaced(jobs.length - 1, _sender, _txhash, provider, _inputs, _off_chain_deposit);
    }

    function _verifySignerEnclave(bytes calldata _digest, bytes calldata _sig) internal view {

        address signer = ECDSAUpgradeable.recover(keccak256(_digest), _sig);
        bool  is_verified = serverlessVerifier.verifyEnclave(signer);
        require(is_verified, "Provider is not using verified serverless backend");
    }

    function _callBackWithLimit(uint256 _job_id, Job memory _job, bytes memory _input, uint256 _job_cost) internal {
        uint start_gas = gasleft();
        (bool success,) = _job.sender.call{gas: (_job.callback_deposit / tx.gasprice)}(
            abi.encodeWithSignature("oysterResultCall(bytes32,bytes)", _job_id, _input)
        );
        // offsetting the gas consumed by wrapping methods, calculated manually by checking callback_cost when deposit is 0
        uint callback_cost = (start_gas - gasleft() - MinCallbackGas) * tx.gasprice;
        payable(_job.provider).transfer(_job_cost + callback_cost);
        payable(_job.sender).transfer(_job.off_chain_deposit - _job_cost + _job.callback_deposit - callback_cost);
        emit JobFinished(_job_id, _job.provider, success, _input);
    }

    function _jobFinish(uint256 _job, address _provider, bytes calldata _outputs, bytes calldata _msg_sig) internal {
        address payable provider = payable(_provider);
        // Check provider as assigned provider

        Job memory job = jobs[_job];
        require(_provider == job.provider, "Sender is not the assigned provider for the job");
        // verify signature is one of the serverless enclave
        _verifySignerEnclave(_outputs, _msg_sig);
        // Unpack the output
        (
            bytes4 req_hash,
            bool job_success,
            bytes memory output,
            uint exec_time,
            uint error_code
        ) = abi.decode(_outputs, (bytes4, bool, bytes, uint, uint));

        require(req_hash == job.id, "Job request doesn't match with executed request"); // Maybe slashing can be done
        address payable sender = payable(job.sender);
        jobs[_job].active = false; //Need to update in storage
        uint job_cost = RATE * exec_time;

        if (!job_success) {
            provider.transfer(job_cost);
            sender.transfer(job.off_chain_deposit - job_cost + job.callback_deposit);
            emit JobFailed(_job, error_code, exec_time);
            return;
        }

        _callBackWithLimit(_job, job, output, job_cost);

    }

    function _registerProvider(address _provider) internal {
        // grant worker role
        grantRole(WORKER_ROLE, _provider);
        provider_list.push(_provider);
        providers[_provider] = Provider(provider_list.length, false);
    }

    function _deregisterProvider(address _sender) internal {
        // TODO: check provider has no active job assigned.
        require(providers[_sender].id != 0, "Provider not registered");
        delete providers[_sender];
    }

    function _activateProdvider(address _sender) internal {
        require(providers[_sender].id != 0, "Provider not registered");
        providers[_sender].active = true;
        active_provider_count++;
    }

    function _deactivateProdvider(address _sender) internal {
        require(providers[_sender].id != 0, "Provider not registered");
        providers[_sender].active = false;
        active_provider_count--;
    }

    function _closeExpiredJob(uint256 _job) internal {
        Job memory job = jobs[_job];
        require(block.number > job.block_number + JobBlockLimit, "Block limit for job hasn't reached yet");
        jobs[_job].active = false;
        // TODO: pay some compensation on top of reverting the deposit
        // TODO: slashing from providers account has to be done
        payable(job.sender).transfer(job.off_chain_deposit + job.callback_deposit);
    }

    function jobPlace(
        bytes32 _txhash,
        bytes calldata _inputs,
        uint256 _off_chain_deposit,
        uint256 _callback_deposit
    )
        external
        payable
    {
        return _jobPlace(_msgSender(), _txhash, _inputs, _off_chain_deposit, _callback_deposit);
    }

    function jobFinish(uint256 _job, bytes calldata _outputs, bytes calldata _msg_sig)
        external
        activeJob(_job)
        onlyRole(WORKER_ROLE)
    {
        return _jobFinish(_job, _msgSender(), _outputs, _msg_sig);
    }

    function registerProvider(address _provider) external onlyRole(DEFAULT_ADMIN_ROLE) {
        return _registerProvider(_provider);
    }

    function deregisterProvider() external onlyRole(WORKER_ROLE) {
        return _deregisterProvider(_msgSender());
    }

    function activateProvider() external onlyRole(WORKER_ROLE) {
        return _activateProdvider(_msgSender());
    }

    function deactivateProvider() external onlyRole(WORKER_ROLE) {
        return _deactivateProdvider(_msgSender());
    }

    function closeExpiredJob(uint256 _job) activeJob(_job) external {
        return _closeExpiredJob(_job);
    }

    function runtimeLimit(uint256 _job) external view returns (uint256 msecs) {
        return jobs[_job].off_chain_deposit / RATE;
    }

//-------------------------------- Jobs end --------------------------------//

}
