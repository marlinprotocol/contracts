pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Mintable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Burnable.sol";


contract TokenLogic is
    Initializable,
    ERC20,
    ERC20Detailed,
    ERC20Mintable,
    ERC20Burnable
{
    function initialize(
        string memory _name,
        string memory _symbol,
        uint8 _decimal
    ) public initializer {
        ERC20Detailed.initialize(_name, _symbol, _decimal);
        ERC20Mintable.initialize(msg.sender);
    }
}
