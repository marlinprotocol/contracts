// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CommonChainExecutors.sol";
import "./CommonChainGateways.sol";

contract CommonChainJobs is
    Initializable, // initializer
    ContextUpgradeable, // _msgSender, _msgData
    ERC165Upgradeable, // supportsInterface
    AccessControlEnumerableUpgradeable, // RBAC enumeration
    UUPSUpgradeable // public upgrade
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

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

    function __CommonChainJobs_init(
        address _admin,
        IERC20 _token,
        CommonChainGateways _gateways,
        CommonChainExecutors _executors,
        uint256 _executionBufferTime,
        uint256 _noOfNodesToSelect
    ) public initializer {
        __Context_init();
        __ERC165_init();
        __AccessControlEnumerable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        token = _token;
        gateways = _gateways;
        executors = _executors;
        executionBufferTime = _executionBufferTime;
        noOfNodesToSelect = _noOfNodesToSelect;
    }

    //-------------------------------- Initializer end --------------------------------//

    IERC20 public token;
    CommonChainGateways public gateways;
    CommonChainExecutors public executors;
    uint256 public executionBufferTime;
    uint256 public noOfNodesToSelect;

    function setGatewaysContract(CommonChainGateways _gateways) external onlyAdmin {
        gateways = _gateways;
    }

    function setExecutorsContract(CommonChainExecutors _executors) external onlyAdmin {
        executors = _executors;
    }

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

    event JobRelayed(
        uint256 indexed jobId,
        uint256 reqChainId,
        bytes32 codehash,
        bytes codeInputs,
        uint256 deadline,
        address jobOwner,
        address gatewayOperator
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
        require(gateways.isChainSupported(_reqChainId), "UNSUPPORTED_CHAIN");

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

        gateways.allowOnlyVerified(signer);

        selectedExecutors[_jobId] = executors.selectExecutors(noOfNodesToSelect);

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

        emit JobRelayed(_jobId, _reqChainId, _codehash, _codeInputs, _deadline, _jobOwner, _msgSender());
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

        executors.allowOnlyVerified(signer);

        require(isJobExecutor(_jobId, signer), "NOT_SELECTED_EXECUTOR");

        executors.updateOnSubmitOutput(signer);

        emit JobResponded(_jobId, _output, _totalTime, _errorCode, ++jobs[_jobId].outputCount);

        // cleanup job after 3rd output submitted

        // on reward distribution, 1st output executor node gets max reward
        // reward ratio - 2:1:0
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

    event SlashedOnExecutionTimeout(
        uint256 jobId,
        address[] executors
    );

    event GatewayReassigned(
        uint256 jobId,
        address indexed prevGatewayOperator,
        address indexed newGatewayOperator
    );

    function slashOnExecutionTimeout(
        uint256 _jobId
    ) external {
        // check for time
        require(
            block.timestamp > jobs[_jobId].execStartTime + jobs[_jobId].deadline + executionBufferTime,
            "DEADLINE_NOT_OVER"
        );

        delete jobs[_jobId];

        // slash Execution node

        uint256 len = selectedExecutors[_jobId].length;
        for (uint256 index = 0; index < len; index++) {
            executors.updateOnExecutionTimeoutSlash(selectedExecutors[_jobId][index]);
        }

        emit SlashedOnExecutionTimeout(_jobId, selectedExecutors[_jobId]);

        delete selectedExecutors[_jobId];
    }

    function reassignGatewayRelay(
        address _gatewayOperatorOld,
        uint256 _jobId,
        bytes memory _signature
    ) external {
        // signature check
        bytes32 digest = keccak256(abi.encode(_jobId, _gatewayOperatorOld));
        address signer = digest.recover(_signature);

        gateways.allowOnlyVerified(signer);

        emit GatewayReassigned(_jobId, _gatewayOperatorOld, _msgSender());

        // slash old gateway
    }

    //-------------------------------- Timeout end --------------------------------//
}
