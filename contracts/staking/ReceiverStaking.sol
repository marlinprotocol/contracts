// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "./lib/ERC20SnapshotUpgradeable.sol";
import "./interfaces/IReceiverStaking.sol";

contract ReceiverStaking is 
    Initializable,  // initializer
    ERC20SnapshotUpgradeable,  // epoch snapshots
    AccessControlEnumerableUpgradeable, // RBAC enumerable
    UUPSUpgradeable,  // public upgrade
    IReceiverStaking  // interface
{

    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor(uint256 _startTime, uint256 _epochLength, address _stakingToken) initializer {
        START_TIME = _startTime;
        EPOCH_LENGTH = _epochLength;
        STAKING_TOKEN = IERC20Upgradeable(_stakingToken);
    }

    /// @inheritdoc IReceiverStaking
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public override immutable START_TIME;

    /// @inheritdoc IReceiverStaking
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public override immutable EPOCH_LENGTH;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20Upgradeable public immutable STAKING_TOKEN;

    mapping(address => address) public signerToStaker;
    mapping(address => address) public stakerToSigner;

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()));
        _;
    }

    function initialize(address _admin) initializer public {

        __Context_init_unchained();
        __ERC20Snapshot_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function deposit(uint256 amount, address _signer) external {
        _deposit(msg.sender, amount);
        setSigner(_signer);
    }

    function deposit(address stakeFor, uint256 amount) external {
        _deposit(stakeFor, amount);
    }

    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount);
    }

    function _deposit(address stakeFor, uint256 amount) internal {
        require(amount != 0, "0 deposit");
        STAKING_TOKEN.transferFrom(msg.sender, address(this), amount);
        _mint(stakeFor, amount);
    }

    function withdraw(uint256 amount) external {
        address sender = msg.sender;
        _burn(sender, amount);
        STAKING_TOKEN.transfer(sender, amount);
    }

    function setSigner(address _signer) public {
        require(stakerToSigner[msg.sender] == address(0), "staker has a signer");
        require(signerToStaker[_signer] == address(0), "signer already mapped");
        stakerToSigner[msg.sender] = _signer;
        signerToStaker[_signer] = msg.sender;
        emit SignerUpdated(msg.sender, _signer);
    }

    function updateSigner(address _signer) external {
        address _prevSigner = stakerToSigner[msg.sender];
        require(_prevSigner != address(0), "signer doesnt exist");
        require(signerToStaker[_signer] == address(0), "signer already mapped");
        stakerToSigner[msg.sender] = _signer;
        signerToStaker[_signer] = msg.sender;
        delete signerToStaker[_prevSigner];
        emit SignerUpdated(msg.sender, _signer);
    }

    function removeSigner() external {
        address _signer = stakerToSigner[msg.sender];
        require(_signer != address(0), "signer doesn't exist");
        delete stakerToSigner[msg.sender];
        delete signerToStaker[_signer];
        emit SignerUpdated(msg.sender, address(0));
    }

    /// @inheritdoc IReceiverStaking
    function getEpochInfo(uint256 epoch) external override view returns(uint256 totalStake, uint256 currentEpoch) {
        totalStake = totalSupplyAt(epoch);
        currentEpoch = _getCurrentSnapshotId();
    }


    function balanceOfAt(address account, uint256 snapshotId) public view override returns (uint256) {
        return ERC20SnapshotUpgradeable.balanceOfAt(account, snapshotId);
    }

    function balanceOfSignerAt(address signer, uint256 snapshotId) public view returns (uint256 balance, address account) {
        account = signerToStaker[signer];
        balance = ERC20SnapshotUpgradeable.balanceOfAt(account, snapshotId);
    }

    function _getCurrentSnapshotId() internal view override returns (uint256) {
        if(block.timestamp < START_TIME) return 0;
        return (block.timestamp - START_TIME)/EPOCH_LENGTH + 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(from == address(0) || to == address(0), "Staking Positions transfer not allowed");
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address _from,
        address _to,
        uint256
    ) internal virtual override {
        if(_to == address(0)) {
            // burn
            uint256 _updatedBalance = balanceOf(_from);
            Snapshots storage userSnapshots = _accountBalanceSnapshots[_from];
            if(
                userSnapshots.values.length > 0 &&
                userSnapshots.values[userSnapshots.values.length - 1] > _updatedBalance
            ) {
                uint256 _dropInMin = userSnapshots.values[userSnapshots.values.length - 1] - _updatedBalance;
                uint256 _currentSnapshotId = _getCurrentSnapshotId();
                uint256 _previousSnapshotId = _currentSnapshotId - 1;
                // Lowest balance in epoch
                if(
                    userSnapshots.values.length == 1 ||
                    userSnapshots.ids[userSnapshots.values.length - 2] != _previousSnapshotId
                ) {
                    // Last epoch didn't have a snapshot for user
                    userSnapshots.ids[userSnapshots.ids.length - 1] = _previousSnapshotId;
                    userSnapshots.ids.push(_currentSnapshotId);
                    userSnapshots.values.push(_updatedBalance);
                }
                if(
                    _totalSupplySnapshots.values.length == 1 ||
                    _totalSupplySnapshots.ids[_totalSupplySnapshots.values.length - 2] != _previousSnapshotId
                ) {
                    // Previous epoch didn't have a snapshot
                    _totalSupplySnapshots.ids[_totalSupplySnapshots.values.length - 1] = _previousSnapshotId;
                    _totalSupplySnapshots.ids.push(_currentSnapshotId);
                    _totalSupplySnapshots.values.push(
                        _totalSupplySnapshots.values[_totalSupplySnapshots.values.length - 1]
                    );
                }
                _totalSupplySnapshots.values[_totalSupplySnapshots.values.length - 1] -= _dropInMin;
                userSnapshots.values[userSnapshots.values.length - 1] = _updatedBalance;
                emit BalanceUpdate(_from, _currentSnapshotId, _updatedBalance);
            }
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {}
}