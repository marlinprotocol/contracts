// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20SnapshotUpgradeable.sol";

contract ReceiverStaking is 
    Initializable,
    ERC20SnapshotUpgradeable,
    UUPSUpgradeable
{

    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    IERC20Upgradeable immutable STAKING_TOKEN;
    uint256 immutable START_TIME;
    uint256 immutable EPOCH_LENGTH;
    
    constructor(uint256 _startTime, uint256 _epochLength) initializer {
        START_TIME = _startTime;
        EPOCH_LENGTH = _epochLength;
    }

    function initialize(address _stakingToken) initializer public {
        STAKING_TOKEN = IERC20Upgradeable(_stakingToken);
    }

    function deposit(uint256 amount) external {
        STAKING_TOKEN.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        STAKING_TOKEN.transfer(msg.sender, amount);
    }

    function _getCurrentSnapshotId() internal view virtual returns (uint256) {
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
        uint256 amount
    ) internal virtual override {
        if(to == address(0)) {
            // burn
            uint256 _updatedBalance = balanceOf(from);
            if(balanceOfAt(from, _getCurrentSnapshotId()) > _updatedBalance) {
                // current balance is lowest in epoch
                _updateSnapshot(_accountBalanceSnapshots[from], _updatedBalance);
            }
        }
    }
}