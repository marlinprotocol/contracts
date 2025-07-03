// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/* Contracts */
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {AccessControlEnumerableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {MarketV1} from "../enclaves/MarketV1.sol";

/* Interfaces */
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IKMSVerifiable} from "./interfaces/IKMSVerifiable.sol";

/* Libraries */
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Governance is
    Initializable, // initializer
    ContextUpgradeable,
    ERC165Upgradeable, // supportsInterface
    AccessControlEnumerableUpgradeable, // RBAC enumeration
    PausableUpgradeable,
    UUPSUpgradeable, // public upgrade
    IKMSVerifiable // KMS verifiable
{
    using SafeERC20 for IERC20;
    using Strings for uint256;

    /* Errors */
    error OnlyAdmin();
    error TokenNotSupported();
    error ProposalAlreadyExists();
    error ProposalAlreadySubmitted();
    error InvalidInputLength();
    error InvalidTitleLength();
    error InvalidDescriptionLength();
    error ProposalExpired();
    error ProposalAlreadyInQueue();
    error ProposalAlreadyExecuted();

    /* Events */
    event DepositThresholdSet(address token, uint256 amount);
    event OysterMarketSet(address oysterMarket);
    event ProposalDurationSet(uint256 duration);
    event MetadataConfigSet(MetadataConfig metadataConfig);

    /* Enums */
    enum VoteOutcome {
        Pending, // Proposal is submitted and waiting for the result submission
        Passed, // Proposal is executed and deposit is refunded
        Failed, // Proposal is not executed and deposit is refunded
        Vetoed // Proposal is not executed and deposit is slashed
    }

    /* Structs */
    struct ProposalInfo {
        address proposer;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string title;
        string description;
        uint256 proposedTimestamp; // timestamp when the proposal was created
    }

    struct ExecutionInfo {
        bool executed;
        uint256 deadlineTimestamp; // timestamp when the proposal is due
    }

    struct TokenLockInfo {
        address token;
        uint256 amount;
    }

    struct Proposal {
        ProposalInfo proposalInfo;
        VoteOutcome voteOutcome;
        TokenLockInfo tokenLockInfo;
        ExecutionInfo executionInfo;
    }

    /// @notice This does not include `initParams` as it should be submitted by the proposer
    struct MetadataConfig {
        bool debug;
        string family;
        string instance;
        uint256 memoryMB;
        string name;
        string region;
        string url;
        uint256 vcpu;
    }

    struct JobOpenConfig {
        uint256 rate;
        address provider;
    }

    uint256[500] private __gap0;

    MarketV1 public oysterMarket;
    IERC20 public usdc;
    uint256 public proposalDuration;

    /* Oyster Market */
    MetadataConfig private metadataConfig;
    JobOpenConfig private jobOpenConfig;

    /* Proposal */
    mapping(address token => uint256 amount) proposalDepositAmounts;
    mapping(bytes32 id => Proposal) proposals;
    mapping(bytes32 id => bool) executionQueue;


    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()));
        _;
    }

    modifier onlyGovernanceEnclave(bytes32 _proposalId) {
        // TODO: Verify the signature
        _;
    }

    //-------------------------------- Overrides start --------------------------------//

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC165Upgradeable, AccessControlEnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address /*account*/ ) internal view override onlyAdmin {}

    //-------------------------------- Overrides ends --------------------------------//

    //-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap1;

    function initialize(address _admin, address _marketV1) public initializer {
        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __Pausable_init_unchained();

        // TODO: set default admin
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        // TODO: set oyster market related setter
        setOysterMarket(_marketV1);
    }

    //-------------------------------- Initializer end --------------------------------//

    //-------------------------------- Admin start --------------------------------//

    // TODO: OysterMarketConfigSetter Role
    // TODO: MetadataConfigSetter Role

    function setDepositThreshold(address _token, uint256 _amount) external onlyAdmin {
        proposalDepositAmounts[_token] = _amount;

        emit DepositThresholdSet(_token, _amount);
    }

    // TODO: Access Control
    function setOysterMarket(address _oysterMarket) public onlyAdmin {
        oysterMarket = MarketV1(_oysterMarket);

        emit OysterMarketSet(address(_oysterMarket));
    }

    // TODO: Access Control
    // TODO: check what's needed
    function setRate(uint256 _rate) external onlyAdmin {
        rate = _rate;

        // TODO: event
    }

    // TODO: Access Control
    function setProposalDuration(uint256 _duration) external onlyAdmin {
        proposalDuration = _duration;

        emit ProposalDurationSet(_duration);
    }

    function pause() external whenNotPaused onlyAdmin {
        _pause();
    }

    function unpause() external whenPaused onlyAdmin {
        _unpause();
    }

    //-------------------------------- Admin end --------------------------------//

    //-------------------------------- Propose start --------------------------------//

    function propose(
        address _depositToken,
        string calldata _initParams,
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _calldatas,
        string calldata _title,
        string calldata _description
    ) external returns (bytes32 proposalId) {   
        // Input Validation
        require(_targets.length == _values.length, InvalidInputLength());
        require(_targets.length == _calldatas.length, InvalidInputLength());
        require(bytes(_title).length > 0, InvalidTitleLength());
        require(bytes(_description).length > 0, InvalidDescriptionLength());
        
        // Only Accept tokens with non-zero threshold
        uint256 tresholdAmount = proposalDepositAmounts[_depositToken];
        if (tresholdAmount == 0) {
            revert TokenNotSupported();
        }

        // Check if the proposal already exists
        bytes32 descriptionHash = getDescriptionHash(_title, _description);
        proposalId = getProposalId(_targets, _values, _calldatas, descriptionHash, block.timestamp);
        require(proposals[proposalId].proposalInfo.proposer == address(0), ProposalAlreadyExists());

        _depositTokenAndLock(proposalId, _depositToken, tresholdAmount);

        // Store the proposal information
        proposals[proposalId].proposalInfo = ProposalInfo({
            proposer: msg.sender,
            targets: _targets,
            values: _values,
            calldatas: _calldatas,
            title: _title,
            description: _description,
            proposedTimestamp: block.timestamp
        });

        // Store deadline
        proposals[proposalId].executionInfo = ExecutionInfo({
            executed: false,
            deadlineTimestamp: block.timestamp + proposalDuration
        });

        deployGovernanceEnclave(proposalId, _initParams);
    }

    function deployGovernanceEnclave(bytes32 _proposalId, string calldata _initParams) public {
        // TODO: get USDC fee from proposer
        // TODO: -> rate, provider, etc... must be set

        uint256 jobOpenBalance = getJobOpenBalance();
        usdc.safeTransferFrom(msg.sender, address(this), jobOpenBalance);

        jobOpenConfig.oysterMarket.jobOpen(
            formatMetadata(_initParams),
            jobOpenConfig.provider,
            jobOpenConfig.rate,
            jobOpenBalance
        );

        // TODO Queestion: How to set latest fee value?
    }

    //-------------------------------- Propose end --------------------------------//

    //-------------------------------- Result start --------------------------------//

    // TODO: accept signature
    function submitResult(bytes32 _proposalId, VoteOutcome _result) external onlyGovernanceEnclave(_proposalId) {
        if (block.timestamp > proposals[_proposalId].executionInfo.deadlineTimestamp) {
            revert ProposalExpired();
        }

        if (proposals[_proposalId].voteOutcome != VoteOutcome.Pending) {
            revert ProposalAlreadySubmitted();
        }
        
        proposals[_proposalId].voteOutcome = _result;

        if (_result == VoteOutcome.Passed) {
            _handleProposalPassed(_proposalId);
        } else if (_result == VoteOutcome.Failed) {
            _handleProposalFailed(_proposalId);
        } else if (_result == VoteOutcome.Vetoed) {
            _handleProposalVetoed(_proposalId);
        }
    }

    function _handleProposalPassed(bytes32 _proposalId) internal {
        // Executed only if the proposal has on-chain execution targets
        if(proposals[_proposalId].proposalInfo.targets.length > 0) {
            _queueExecution(_proposalId);
        }
        
        _unlockDepositAndRefund(_proposalId);
    }

    function _handleProposalFailed(bytes32 _proposalId) internal {
        _unlockDepositAndRefund(_proposalId);
    }

    function _handleProposalVetoed(bytes32 _proposalId) internal {
        _slashDeposit(_proposalId);
    }

    function _queueExecution(bytes32 _proposalId) internal {
        // Check if the proposal is already queued
        // This should never revert
        if (executionQueue[_proposalId] == true) {
            revert ProposalAlreadyInQueue();
        }

        // Check if the proposal is not executed yet
        // This should never revert
        if (proposals[_proposalId].executionInfo.executed == true) {
            revert ProposalAlreadySubmitted();
        }

        // Mark the proposal as queued for execution
        executionQueue[_proposalId] = true;
    }

    // TODO: check reentrancy
    function _execute(bytes32 _proposalId) internal {
        // TODO: revert if target is address(this)
        ProposalInfo storage proposalInfo = proposals[_proposalId].proposalInfo;
        address[] memory targets = proposalInfo.targets;
        uint256[] memory values = proposalInfo.values;
        bytes[] memory calldatas = proposalInfo.calldatas;

        // TODO: what if execution failed?
        // TODO: prevent address(this)?
        for (uint256 i = 0; i < targets.length; ++i) {
            (bool success, bytes memory returndata) = targets[i].call{value: values[i]}(calldatas[i]);
            Address.verifyCallResult(success, returndata, "Governance: proposal execution failed");
        }
    }

    //-------------------------------- Result end --------------------------------//

    //-------------------------------- Helpers start --------------------------------//

    function _depositTokenAndLock(bytes32 _proposalId, address _token, uint256 _amount) internal {
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        _lockDeposit(_proposalId, _token, _amount);
    }

    function _unlockDepositAndRefund(bytes32 _proposalId) internal {
        TokenLockInfo memory tokenLockInfo = proposals[_proposalId].tokenLockInfo;
        _deleteDepositLock(_proposalId);
        IERC20(tokenLockInfo.token).transfer(proposals[_proposalId].proposalInfo.proposer, tokenLockInfo.amount);
    }

    function _slashDeposit(bytes32 _proposalId) internal {
        // TokenLockInfo memory tokenLockInfo = proposals[_proposalId].tokenLockInfo;
        _deleteDepositLock(_proposalId);
        // TODO: Transfer to?
    }

    function _lockDeposit(bytes32 _proposalId, address _token, uint256 _amount) internal {
        proposals[_proposalId].tokenLockInfo = TokenLockInfo({token: _token, amount: _amount});
    }

    function _deleteDepositLock(bytes32 _proposalId) internal {
        delete proposals[_proposalId].tokenLockInfo;
    }

    function _boolToString(bool v) internal pure returns (string memory) {
        return v ? "true" : "false";
    }

    //-------------------------------- Helpers end --------------------------------//

    //-------------------------------- Getters start --------------------------------//

    function getProposalId(
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _calldatas,
        bytes32 _descriptionHash,
        uint256 timestamp
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _targets,
                _values,
                _calldatas,
                _descriptionHash,
                timestamp
            )
        );
    }

    function getDescriptionHash(
        string calldata _title,
        string calldata _description
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(_title, _description));
    }

    function setMetadataConfig(MetadataConfig memory _metadataConfig) external onlyAdmin {
        metadataConfig = _metadataConfig;

        emit MetadataConfigSet(_metadataConfig);
    }

    function getMetadataConfig() external view returns (MetadataConfig memory) {
        return metadataConfig;
    }

    function getJobOpenBalance() public view returns (uint256) {
        // TODO
    }

    function formatMetadata(string calldata _initParams)
        public
        view
        returns (string memory)
    {
        return string.concat(
            '{"debug":',        _boolToString(metadata.debug), ',',
            '"family":"',       metadata.family, '",',
            '"init_params":"',  _initParams, '",',
            '"instance":"',     metadata.instance, '",',
            '"memory":',        Strings.toString(metadata.memoryMB), ',',
            '"name":"',         metadata.name, '",',
            '"region":"',       metadata.region, '",',
            '"url":"',          metadata.url, '",',
            '"vcpu":',          Strings.toString(metadata.vcpu),
            '}'
        );
    }

    //-------------------------------- Getters end --------------------------------//

    //-------------------------------- KMS start --------------------------------//

    /// @notice Mapping of verified image IDs
    mapping(bytes32 => bool) public images;

    /// @notice Event emitted when an image is approved
    event ImageApproved(bytes32 imageId);

    /// @notice Event emitted when an image is revoked
    event ImageRevoked(bytes32 imageId);

    function _approveImages(bytes32[] memory _imageIds) internal {
        for (uint256 i = 0; i < _imageIds.length; i++) {
            images[_imageIds[i]] = true;
            emit ImageApproved(_imageIds[i]);
        }
    }

    // TODO: Access Control
    function approveImages(bytes32[] calldata _imageIds) external onlyAdmin {
        _approveImages(_imageIds);
    }

    // TODO: Access Control
    function revokeImages(bytes32[] calldata _imageIds) external onlyAdmin {
        for (uint256 i = 0; i < _imageIds.length; i++) {
            delete images[_imageIds[i]];
            emit ImageRevoked(_imageIds[i]);
        }
    }

    function oysterKMSVerify(bytes32 _imageId) external view override returns (bool) {
        return images[_imageId];
    }

    //-------------------------------- KMS end --------------------------------//

    uint256[500] private __gap2;
}
