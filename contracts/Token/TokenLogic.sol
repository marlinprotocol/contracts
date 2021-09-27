pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";

contract TokenLogic is
    Initializable,
    ERC20Upgradeable,
    ERC20CappedUpgradeable,
    ERC20BurnableUpgradeable,
    ERC20PresetMinterPauserUpgradeable
{
    function initialize(
        string memory _name,
        string memory _symbol,
        address _bridge
    ) public initializer {
        __ERC20PresetMinterPauser_init(_name, _symbol);
        __ERC20Capped_init(10000000000e18);
        ERC20PresetMinterPauserUpgradeable.mint(_bridge, 1000000000e18);
    }
    
    function _mint(address account, uint256 amount) internal virtual override(ERC20Upgradeable, ERC20CappedUpgradeable) {
        super._mint(account, amount);
    }
    
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override(ERC20Upgradeable, ERC20PresetMinterPauserUpgradeable) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
