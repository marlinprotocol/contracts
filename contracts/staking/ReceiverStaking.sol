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

    /// @inheritdoc IReceiverStaking
    function getEpochInfo(uint256 epoch) external override view returns(uint256 totalStake, uint256 currentEpoch) {
        totalStake = totalSupplyAt(epoch);
        currentEpoch = _getCurrentSnapshotId();
    }


    function balanceOfAt(address account, uint256 snapshotId) public view override returns (uint256) {
        return ERC20SnapshotUpgradeable.balanceOfAt(account, snapshotId);
    }

    function balanceOfSignerAt(address signer, uint256 snapshotId) public view returns (uint256) {
        address account = signerToStaker[signer];
        return ERC20SnapshotUpgradeable.balanceOfAt(account, snapshotId);
    }

    function _getCurrentSnapshotId() internal view override returns (uint256) {
        return (block.timestamp - START_TIME)/EPOCH_LENGTH + 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        require(from == address(0) || to == address(0), "Staking Positions transfer not allowed");
        if(block.timestamp < START_TIME) return;
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from, 
        address to, 
        uint256
    ) internal override {
        if(to == address(0)) {
            // burn
            uint256 _updatedBalance = balanceOf(from);
            Snapshots storage userSnapshots = _accountBalanceSnapshots[from];
            if(userSnapshots.values[userSnapshots.values.length - 1] > _updatedBalance) {
                // current balance is lowest in epoch
                userSnapshots.values[userSnapshots.values.length - 1] = _updatedBalance;
            }
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {}
}