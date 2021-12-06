// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IInbox.sol";


contract L2Gateway is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable  // public upgrade
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "only admin");
        _;
    }

//-------------------------------- Overrides start --------------------------------//

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _setupRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._setupRole(role, account);
    }

    function grantRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function renounceRole(bytes32 role, address account) public virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super.renounceRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function _authorizeUpgrade(address /*account*/) onlyAdmin internal view override {}

//-------------------------------- Overrides end --------------------------------//

//-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap1;

    function initialize(
        address _tokenL2,
        address _gatewayL1
    ) public initializer {
        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        tokenL2 = IERC20(_tokenL2);
        gatewayL1 = _gatewayL1;
    }

//-------------------------------- Initializer end --------------------------------//

//-------------------------------- Gateway start --------------------------------//

    IERC20 public tokenL2;
    address public gatewayL1;

    uint256[48] private __gap2;

    uint160 constant diff = uint160(0x1111000000000000000000000000000000001111);

    modifier onlyGatewayL1() {
        unchecked {
            require(
                address(uint160(_msgSender()) - diff) == gatewayL1,
                "only gateway L1"
            );
        }
        _;
    }

    event Transfer(address indexed to, uint256 amount);

    function transferL2(
        address _to,
        uint256 _amount
    ) external onlyGatewayL1 {
        tokenL2.transfer(_to, _amount);
        emit Transfer(_to, _amount);
    }

    function withdraw() onlyAdmin public {
        uint256 _balance = tokenL2.balanceOf(address(this));
        tokenL2.transfer(_msgSender(), _balance);
        payable(_msgSender()).transfer(address(this).balance);
    }

//-------------------------------- Gateway end --------------------------------//
}

