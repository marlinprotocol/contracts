// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./lib/ERC20SnapshotUpgradeable.sol";


contract ReceiverStaking is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable, // RBAC enumerable
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade
    ERC20Upgradeable,  // ERC20
    ERC20SnapshotUpgradeable  // snapshots
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap_0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor(uint256 _startTime, uint256 _epochLength, address _stakingToken) initializer {
        START_TIME = _startTime;
        EPOCH_LENGTH = _epochLength;
        STAKING_TOKEN = IERC20Upgradeable(_stakingToken);
    }

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()));
        _;
    }

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
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "cannot be adminless");
    }

    function _authorizeUpgrade(address /*account*/) internal view override onlyAdmin {}

//-------------------------------- Overrides end --------------------------------//

//-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap_1;

    function initialize(address _admin, string calldata _name, string calldata _symbol) initializer public {
        // initialize parents
        __Context_init_unchained();
        __ERC20Snapshot_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __ERC20_init_unchained(_name, _symbol);
        __ERC20Snapshot_init_unchained();

        // set sender as admin
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    }

//-------------------------------- Initializer end --------------------------------//

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable START_TIME;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 public immutable EPOCH_LENGTH;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC20Upgradeable public immutable STAKING_TOKEN;

    event BalanceUpdate(address indexed _address, uint256 indexed epoch, uint256 balance);

    function deposit(uint256 _amount) external {
        address _sender = _msgSender();
        STAKING_TOKEN.transferFrom(_sender, address(this), _amount);
        _mint(_sender, _amount);
    }

    function withdraw(uint256 _amount) external {
        address _sender = _msgSender();
        _burn(_sender, _amount);
        STAKING_TOKEN.transfer(_sender, _amount);
    }

    function getStakeInfo(address _user, uint256 _epoch) external view returns(uint256 _userStake, uint256 _totalStake, uint256 _currentEpoch) {
        _userStake = balanceOfAt(_user, _epoch);
        _totalStake = totalSupplyAt(_epoch);
        _currentEpoch = _getCurrentSnapshotId();
    }

    function _getCurrentSnapshotId() internal view override returns (uint256) {
        if(block.timestamp < START_TIME) return 0;
        return (block.timestamp - START_TIME)/EPOCH_LENGTH + 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20Upgradeable, ERC20SnapshotUpgradeable) {
        require(from == address(0) || to == address(0), "Staking Positions transfer not allowed");
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256
    ) internal virtual override {
        if(to == address(0)) {
            // burn
            uint256 _updatedBalance = balanceOf(from);
            Snapshots storage userSnapshots = _accountBalanceSnapshots[from];
            if(userSnapshots.values[userSnapshots.values.length - 1] > _updatedBalance) {
                // current balance is lowest in epoch
                userSnapshots.values[userSnapshots.values.length - 1] = _updatedBalance;
                emit BalanceUpdate(from, _getCurrentSnapshotId(), _updatedBalance);
            }
        }
    }
}
