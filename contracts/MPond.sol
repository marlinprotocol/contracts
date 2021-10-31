pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MPondLogic is
    Initializable,
    ContextUpgradeable,
    IERC20Upgradeable,
    IERC20MetadataUpgradeable,
    ERC20Upgradeable,
    IERC20PermitUpgradeable,
    EIP712Upgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    ERC1967UpgradeUpgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{

    address public dropBridge;
    mapping(address => bool) public isWhiteListed;
    bool public enableAllTranfers;


    function initialize(
        string memory _name,
        string memory _symbol,
        address account,
        address bridge,
        address dropBridgeAddress
    ) public initializer {
        require(
            account != bridge,
            "Bridge and account should not be the same address"
        );
        
        __Context_init_unchained();
        __EIP712_init_unchained(_name, "1");
        __ERC20Permit_init_unchained(_name);
        __ERC20_init_unchained(_name, _symbol);
        __ERC20Votes_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();
        __Ownable_init_unchained();
        
        super._mint(bridge, 7000e18);
        super._mint(account, 3000e18);

        
        isWhiteListed[bridge] = true;
        isWhiteListed[account] = true;
        dropBridge = dropBridgeAddress;
    }

    function addWhiteListAddress(address _address)
        external
        onlyOwner
        returns (bool)
    {
        isWhiteListed[_address] = true;
        return true;
    }

    function removeWhiteListAddress(address _address)
        external
        onlyOwner
        returns (bool)
    {
        isWhiteListed[_address] = false;
        return true;
    }

    function enableAllTransfers()
        external
        onlyOwner
        returns (bool)
    {
        enableAllTranfers = true;
        return true;
    }

    function disableAllTransfers()
        external
        onlyOwner
        returns (bool)
    {
        enableAllTranfers = false;
        return true;
    }

    function changeDropBridge(address _updatedBridge)
        external
       onlyOwner
    {
        dropBridge = _updatedBridge;
    }

    function isWhiteListedTransfer(address _address1, address _address2)
        public
        view
        returns (bool)
    {
        if (
            enableAllTranfers ||
            isWhiteListed[_address1] ||
            isWhiteListed[_address2]
        ) {
            return true;
        } else if (_address1 == dropBridge) {
            return true;
        }
        return false;
    }

    function transfer(address dst, uint256 amount) public override(IERC20Upgradeable, ERC20Upgradeable) returns (bool) {
        require(
            isWhiteListedTransfer(msg.sender, dst),
            "Atleast one of the address (src or dst) should be whitelisted or all transfers must be enabled via enableAllTransfers()"
        );
        return super.transfer(dst, amount);
    }

    function transferFrom(
        address src,
        address dst,
        uint256 amount
    ) public override(IERC20Upgradeable, ERC20Upgradeable) returns (bool) {
        require(
            isWhiteListedTransfer(src, dst),
            "Atleast one of the address (src or dst) should be whitelisted or all transfers must be enabled via enableAllTransfers()"
        );
        return super.transferFrom(src, dst, amount);
    }
    
    function _mint(address account, uint256 amount) internal virtual override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._mint(account, amount);
    }
    
    function _burn(address account, uint256 amount) internal virtual override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._burn(account, amount);
    }
    
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
        ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._afterTokenTransfer(from, to, amount);        
    }
    
    function bridgeSupply() public pure returns (uint256) {
        return 7000e18;
    }
    
    function getChainId() internal view returns (uint256) {
        return block.chainid;
    }
    
    function _authorizeUpgrade(address account) internal override onlyOwner{}
}
