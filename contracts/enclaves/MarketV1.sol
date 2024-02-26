// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../lock/LockUpgradeable.sol";

contract MarketV1 is
    Initializable, // initializer
    ContextUpgradeable, // _msgSender, _msgData
    ERC165Upgradeable, // supportsInterface
    AccessControlUpgradeable, // RBAC
    AccessControlEnumerableUpgradeable, // RBAC enumeration
    ERC1967UpgradeUpgradeable, // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable, // public upgrade
    LockUpgradeable // time locks
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

    //-------------------------------- Overrides start --------------------------------//

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _grantRole(
        bytes32 role,
        address account
    ) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._grantRole(role, account);
    }

    function _revokeRole(
        bytes32 role,
        address account
    ) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0);
    }

    function _authorizeUpgrade(address /*account*/) internal view override onlyAdmin {}

    //-------------------------------- Overrides end --------------------------------//

    //-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap_1;

    function initialize(address _admin, IERC20 _token, bytes32[] memory _selectors, uint256[] memory _lockWaitTimes) public initializer {
        require(_selectors.length == _lockWaitTimes.length);

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __Lock_init_unchained(_selectors, _lockWaitTimes);

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);

        _updateToken(_token);
    }

    //-------------------------------- Initializer end --------------------------------//

    //-------------------------------- Providers start --------------------------------//

    struct Provider {
        string cp; // url of control plane
    }

    mapping(address => Provider) public providers;

    uint256[49] private __gap_2;

    event ProviderAdded(address indexed provider, string cp);
    event ProviderRemoved(address indexed provider);
    event ProviderUpdatedWithCp(address indexed provider, string newCp);

    function _providerAdd(address _provider, string memory _cp) internal {
        require(bytes(providers[_provider].cp).length == 0, "already exists");
        require(bytes(_cp).length != 0, "invalid");

        providers[_provider] = Provider(_cp);

        emit ProviderAdded(_provider, _cp);
    }

    function _providerRemove(address _provider) internal {
        require(bytes(providers[_provider].cp).length != 0, "not found");

        delete providers[_provider];

        emit ProviderRemoved(_provider);
    }

    function _providerUpdateWithCp(address _provider, string memory _cp) internal {
        require(bytes(providers[_provider].cp).length != 0, "not found");
        require(bytes(_cp).length != 0, "invalid");

        providers[_provider].cp = _cp;

        emit ProviderUpdatedWithCp(_provider, _cp);
    }

    function providerAdd(string memory _cp) external {
        return _providerAdd(_msgSender(), _cp);
    }

    function providerRemove() external {
        return _providerRemove(_msgSender());
    }

    function providerUpdateWithCp(string memory _cp) external {
        return _providerUpdateWithCp(_msgSender(), _cp);
    }

    //-------------------------------- Providers end --------------------------------//

    //-------------------------------- Jobs start --------------------------------//

    bytes32 public constant RATE_LOCK_SELECTOR = keccak256("RATE_LOCK");

    struct Job {
        string metadata;
        address owner;
        address provider;
        uint256 rate;
        uint256 balance;
        uint256 lastSettled;
    }

    mapping(bytes32 => Job) public jobs;
    uint256 public jobIndex;

    IERC20 public token;
    uint256 public constant EXTRA_DECIMALS = 12;

    uint256[47] private __gap_3;

    event TokenUpdated(IERC20 indexed oldToken, IERC20 indexed newToken);

    event JobOpened(
        bytes32 indexed job,
        string metadata,
        address indexed owner,
        address indexed provider,
        uint256 rate,
        uint256 balance,
        uint256 timestamp
    );
    event JobSettled(bytes32 indexed job, uint256 amount, uint256 timestamp);
    event JobClosed(bytes32 indexed job);
    event JobDeposited(bytes32 indexed job, address indexed from, uint256 amount);
    event JobWithdrew(bytes32 indexed job, address indexed to, uint256 amount);
    event JobReviseRateInitiated(bytes32 indexed job, uint256 newRate);
    event JobReviseRateCancelled(bytes32 indexed job);
    event JobReviseRateFinalized(bytes32 indexed job, uint256 newRate);
    event JobMetadataUpdated(bytes32 indexed job, string metadata);

    modifier onlyJobOwner(bytes32 _job) {
        require(jobs[_job].owner == _msgSender(), "only job owner");
        _;
    }

    function _updateToken(IERC20 _token) internal {
        emit TokenUpdated(token, _token);
        token = _token;
    }

    function updateToken(IERC20 _token) external onlyAdmin {
        _updateToken(_token);
    }

    function _deposit(address _from, uint256 _amount) internal {
        token.transferFrom(_from, address(this), _amount);
    }

    function _withdraw(address _to, uint256 _amount) internal {
        token.transfer(_to, _amount);
    }

    function _jobOpen(string memory _metadata, address _owner, address _provider, uint256 _rate, uint256 _balance) internal {
        _deposit(_owner, _balance);
        uint256 _jobIndex = jobIndex;
        jobIndex = _jobIndex + 1;
        bytes32 _job = bytes32(_jobIndex);
        jobs[_job] = Job(_metadata, _owner, _provider, _rate, _balance, block.timestamp);

        emit JobOpened(_job, _metadata, _owner, _provider, _rate, _balance, block.timestamp);
    }

    function _jobSettle(bytes32 _job) internal {
        address _provider = jobs[_job].provider;
        uint256 _rate = jobs[_job].rate;
        uint256 _balance = jobs[_job].balance;
        uint256 _lastSettled = jobs[_job].lastSettled;

        uint256 _usageDuration = block.timestamp - _lastSettled;
        uint256 _amount = (_rate * _usageDuration + 10 ** EXTRA_DECIMALS - 1) / 10 ** EXTRA_DECIMALS;

        if (_amount > _balance) {
            _amount = _balance;
            _balance = 0;
        } else {
            _balance -= _amount;
        }

        _withdraw(_provider, _amount);

        jobs[_job].balance = _balance;
        jobs[_job].lastSettled = block.timestamp;

        emit JobSettled(_job, _amount, block.timestamp);
    }

    function _jobClose(bytes32 _job) internal {
        _jobSettle(_job);
        uint256 _balance = jobs[_job].balance;
        if (_balance > 0) {
            address _owner = jobs[_job].owner;
            _withdraw(_owner, _balance);
        }

        delete jobs[_job];
        _revertLock(RATE_LOCK_SELECTOR, _job);

        emit JobClosed(_job);
    }

    function _jobDeposit(bytes32 _job, address _from, uint256 _amount) internal {
        require(jobs[_job].owner != address(0), "not found");

        _deposit(_from, _amount);
        jobs[_job].balance += _amount;

        emit JobDeposited(_job, _from, _amount);
    }

    function _jobWithdraw(bytes32 _job, address _to, uint256 _amount) internal {
        require(jobs[_job].owner != address(0), "not found");

        _jobSettle(_job);

        // leftover adjustment
        uint256 _leftover = (jobs[_job].rate * lockWaitTime[RATE_LOCK_SELECTOR] + 10 ** EXTRA_DECIMALS - 1) / 10 ** EXTRA_DECIMALS;
        require(jobs[_job].balance >= _leftover, "not enough balance");
        uint256 _maxAmount = jobs[_job].balance - _leftover;
        require(_amount <= _maxAmount, "not enough balance");

        jobs[_job].balance -= _amount;
        _withdraw(_to, _amount);

        emit JobWithdrew(_job, _to, _amount);
    }

    function _jobReviseRate(bytes32 _job, uint256 _newRate) internal {
        require(jobs[_job].owner != address(0), "not found");

        _jobSettle(_job);

        jobs[_job].rate = _newRate;

        emit JobReviseRateFinalized(_job, _newRate);
    }

    function _jobMetadataUpdate(bytes32 _job, string memory _metadata) internal {
        jobs[_job].metadata = _metadata;
        emit JobMetadataUpdated(_job, _metadata);
    }

    function jobOpen(string calldata _metadata, address _provider, uint256 _rate, uint256 _balance) external {
        return _jobOpen(_metadata, _msgSender(), _provider, _rate, _balance);
    }

    function jobSettle(bytes32 _job) external {
        return _jobSettle(_job);
    }

    function jobClose(bytes32 _job) external onlyJobOwner(_job) {
        // 0 rate jobs can be closed without notice
        if (jobs[_job].rate == 0) {
            return _jobClose(_job);
        }

        // non-0 rate jobs can be closed after proper notice
        uint256 _newRate = _unlock(RATE_LOCK_SELECTOR, _job);
        // 0 rate implies closing to the control plane
        require(_newRate == 0, "rate should be zero");

        return _jobClose(_job);
    }

    function jobDeposit(bytes32 _job, uint256 _amount) external {
        return _jobDeposit(_job, _msgSender(), _amount);
    }

    function jobWithdraw(bytes32 _job, uint256 _amount) external onlyJobOwner(_job) {
        return _jobWithdraw(_job, _msgSender(), _amount);
    }

    function jobReviseRateInitiate(bytes32 _job, uint256 _newRate) external onlyJobOwner(_job) {
        _lock(RATE_LOCK_SELECTOR, _job, _newRate);
        emit JobReviseRateInitiated(_job, _newRate);
    }

    function jobReviseRateCancel(bytes32 _job) external onlyJobOwner(_job) {
        require(_lockStatus(RATE_LOCK_SELECTOR, _job) != LockStatus.None, "no request");
        _revertLock(RATE_LOCK_SELECTOR, _job);
        emit JobReviseRateCancelled(_job);
    }

    function jobReviseRateFinalize(bytes32 _job) external onlyJobOwner(_job) {
        uint256 _newRate = _unlock(RATE_LOCK_SELECTOR, _job);
        return _jobReviseRate(_job, _newRate);
    }

    function jobMetadataUpdate(bytes32 _job, string calldata _metadata) external onlyJobOwner(_job) {
        return _jobMetadataUpdate(_job, _metadata);
    }

    //-------------------------------- Jobs end --------------------------------//
}
