pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Pond is
    Initializable,
    ContextUpgradeable,
    IAccessControlUpgradeable,
    IAccessControlEnumerableUpgradeable,
    IERC165Upgradeable,
    IERC20Upgradeable,
    IERC20MetadataUpgradeable,
    ERC20Upgradeable,
    ERC20CappedUpgradeable,
    ERC20BurnableUpgradeable,
    ERC20PresetMinterPauserUpgradeable,
    ERC1967UpgradeUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    function initialize(
        string memory _name,
        string memory _symbol,
        address _bridge
    ) public initializer {

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC20_init_unchained(_name, _symbol);
        __ERC20Capped_init_unchained(10000000000e18);
        __ERC20Burnable_init_unchained();
        __Pausable_init_unchained();
        __ERC20Pausable_init_unchained();
        __ERC20PresetMinterPauser_init_unchained(_name, _symbol);
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __Ownable_init_unchained();

        ERC20PresetMinterPauserUpgradeable.mint(_bridge, 1000000000e18);

    }

    function _mint(address account, uint256 amount) internal virtual override(ERC20Upgradeable, ERC20CappedUpgradeable) {
        super._mint(account, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override(ERC20Upgradeable, ERC20PresetMinterPauserUpgradeable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address account) internal override onlyOwner{}
}
