pragma solidity ^0.6.1;
import "../vendor/openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../vendor/openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "../vendor/openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "../vendor/openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract Token is ERC20, ERC20Detailed, ERC20Mintable, ERC20Burnable {
    constructor (string memory _name, string memory _symbol, uint8 _decimal)
        public
        ERC20Detailed(_name, _symbol, _decimal)
    {
        // solhint-disable-previous-line no-empty-blocks
    }

}
