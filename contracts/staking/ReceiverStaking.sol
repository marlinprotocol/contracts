// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IReceiverStaking.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "./lib/ERC20SnapshotUpgradeable.sol";

contract ReceiverStaking is 
    IReceiverStaking,  // interface
    Initializable,
    ERC20SnapshotUpgradeable,
    AccessControlEnumerableUpgradeable,
    UUPSUpgradeable
{

    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor(uint256 _startTime, uint256 _epochLength) initializer {
        START_TIME = _startTime;
        EPOCH_LENGTH = _epochLength;
    }

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 immutable START_TIME;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    uint256 immutable EPOCH_LENGTH;

    IERC20Upgradeable public stakingToken;

    event StakingTokenUpdated(address indexed newStakingToken);

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()));
        _;
    }

    function initialize(address _stakingToken, address _admin) initializer public {
        stakingToken = IERC20Upgradeable(_stakingToken);
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function updateStakingToken(address _newStakingToken) external onlyAdmin {
        _updateStakingToken(_newStakingToken);
    }

    function _updateStakingToken(address _newStakingToken) internal {
        address _currentStakingToken = address(stakingToken);
        require(_newStakingToken != _currentStakingToken, "no change");
        stakingToken = IERC20Upgradeable(_newStakingToken);
        emit StakingTokenUpdated(_newStakingToken);
    }

    function deposit(uint256 amount) external {
        stakingToken.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        stakingToken.transfer(msg.sender, amount);
    }

    function getStakeInfo(address user, uint256 epoch) external view returns(uint256 userStake, uint256 totalStake, uint256 currentEpoch) {
        userStake = balanceOfAt(user, epoch);
        totalStake = totalSupplyAt(epoch);
        currentEpoch = _getCurrentSnapshotId();
    }

    function _getCurrentSnapshotId() internal view override returns (uint256) {
        return (block.timestamp - START_TIME)/EPOCH_LENGTH + 1;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        require(from == address(0) || to == address(0), "Staking Positions transfer not allowed");
        if(block.timestamp < START_TIME) return;
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
            Snapshots storage userSnapshots = _getAccountBalanceSnapshot(from);
            if(userSnapshots.values[userSnapshots.values.length - 1] > _updatedBalance) {
                // current balance is lowest in epoch
                userSnapshots.values[userSnapshots.values.length - 1] = _updatedBalance;
            }
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyAdmin {}
}