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
import "../lock/Lock.sol";


contract MarketV1 is Lock {
//-------------------------------- Constructor start --------------------------------//

    constructor() {}

//-------------------------------- Constructor end --------------------------------//

//-------------------------------- Providers start --------------------------------//

    struct Provider {
        string cp;  // url of control plane
    }

    mapping(address => Provider) providers;

    event ProviderAdded(address provider, string cp);
    event ProviderRemoved(address provider);
    event ProviderUpdatedWithCp(address provider, string newCp);

    function _providerAdd(address _provider, string memory _cp) internal {
        providers[_provider] = Provider(_cp);

        emit ProviderAdded(_provider, _cp);
    }

    function _providerRemove(address _provider) internal {
        delete providers[_provider];

        emit ProviderRemoved(_provider);
    }

    function _providerUpdateWithCp(address _provider, string memory _cp) internal {
        providers[_provider].cp = _cp;

        emit ProviderUpdatedWithCp(_provider, _cp);
    }

    function providerAdd(string memory _cp) external {
        return _providerAdd(msg.sender, _cp);
    }

    function providerRemove() external {
        return _providerRemove(msg.sender);
    }

    function providerUpdateWithCp(string memory _cp) external {
        return _providerUpdateWithCp(msg.sender, _cp);
    }

//-------------------------------- Providers end --------------------------------//

//-------------------------------- Jobs start --------------------------------//

    bytes32 public constant RATE_LOCK_SELECTOR = keccak256("RATE_LOCK");

    struct Job {
        address owner;
        address provider;
        uint256 rate;
        uint256 balance;
        uint256 lastSettled;
    }

    mapping(uint256 => Job) public jobs;
    uint256 jobIndex;

    IERC20 token;

    event JobOpened(uint256 job, address owner, address provider, uint256 rate, uint256 timestamp);
    event JobSettled(uint256 job, uint256 amount);
    event JobClosed(uint256 job);
    event JobDeposited(uint256 job, address from, uint256 amount);
    event JobWithdrew(uint256 job, address to, uint256 amount);
    event JobRevisedRate(uint256 job, uint256 newRate);

    modifier onlyJobOwner(uint256 _job) {
        require(jobs[_job].owner == msg.sender, "only job owner");
        _;
    }

    function _deposit(address _from, uint256 _amount) internal {
        token.transferFrom(_from, address(this), _amount);
    }

    function _withdraw(address _to, uint256 _amount) internal {
        token.transfer(_to, _amount);
    }

    function _jobOpen(address _owner, address _provider, uint256 _rate, uint256 _balance) internal {
        _deposit(_owner, _balance);
        uint256 _jobIndex = jobIndex;
        jobIndex = _jobIndex + 1;
        jobs[_jobIndex] = Job(_owner, _provider, _rate, _balance, block.timestamp);

        emit JobOpened(_jobIndex, _owner, _provider, _rate, block.timestamp);
    }

    function _jobSettle(uint256 _job) internal {
        address _provider = jobs[_job].provider;
        uint256 _rate = jobs[_job].rate;
        uint256 _balance = jobs[_job].balance;
        uint256 _lastSettled = jobs[_job].lastSettled;

        uint256 _usageDuration = block.timestamp - _lastSettled;
        uint256 _amount = _rate * _usageDuration;

        if(_amount > _balance) {
            _amount = _balance;
            _balance = 0;
        } else {
            _balance -= _amount;
        }

        _withdraw(_provider, _amount);

        jobs[_job].balance = _balance;
        jobs[_job].lastSettled = _lastSettled;

        emit JobSettled(_job, _amount);
    }

    function _jobClose(uint256 _job) internal {
        _jobSettle(_job);
        uint256 _balance = jobs[_job].balance;
        if(_balance > 0) {
            address _owner = jobs[_job].owner;
            _withdraw(_owner, _balance);
        }

        delete jobs[_job];

        emit JobClosed(_job);
    }

    function _jobDeposit(uint256 _job, address _from, uint256 _amount) internal {
        _deposit(_from, _amount);
        jobs[_job].balance += _amount;

        emit JobDeposited(_job, _from, _amount);
    }

    function _jobWithdraw(uint256 _job, address _to, uint256 _amount) internal {
        _jobSettle(_job);

        jobs[_job].balance -= _amount;
        _withdraw(_to, _amount);

        emit JobWithdrew(_job, _to, _amount);
    }

    function _jobReviseRate(uint256 _job, uint256 _newRate) internal {
        _jobSettle(_job);

        jobs[_job].rate = _newRate;

        emit JobRevisedRate(_job, _newRate);
    }

    function jobOpen(address _provider, uint256 _rate, uint256 _balance) external {
        return _jobOpen(msg.sender, _provider, _rate, _balance);
    }

    function jobSettle(uint256 _job) external {
        return _jobSettle(_job);
    }

    function jobClose(uint256 _job) external onlyJobOwner(_job) {
        // 0 rate jobs can be closed without notice
        if(jobs[_job].rate == 0) {
            return _jobClose(_job);
        }

        // non-0 rate jobs can be closed after proper notice
        uint256 _newRate = _unlock(RATE_LOCK_SELECTOR, bytes32(_job));
        // 0 rate implies closing ot the control plane
        require(_newRate == 0);

        return _jobClose(_job);
    }

    function jobDeposit(uint256 _job, uint256 _amount) external {
        return _jobDeposit(_job, msg.sender, _amount);
    }

    function jobWithdraw(uint256 _job, uint256 _amount) external onlyJobOwner(_job) {
        return _jobWithdraw(_job, msg.sender, _amount);
    }

    function jobReviseRateInitiate(uint256 _job, uint256 _newRate) external onlyJobOwner(_job) {
        _lock(RATE_LOCK_SELECTOR, bytes32(_job), _newRate);
    }

    function jobReviseRateCancel(uint256 _job) external onlyJobOwner(_job) {
        _revertLock(RATE_LOCK_SELECTOR, bytes32(_job));
    }

    function jobReviseRateFinalize(uint256 _job) external onlyJobOwner(_job) {
        uint256 _newRate = _unlock(RATE_LOCK_SELECTOR, bytes32(_job));
        return _jobReviseRate(_job, _newRate);
    }

//-------------------------------- Jobs end --------------------------------//

}

