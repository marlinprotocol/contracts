pragma solidity >=0.4.21 <0.7.0;

import "../vendor/openzeppelin/Initializable.sol";
import "../vendor/openzeppelin/ERC20.sol";
import "../vendor/openzeppelin/ERC20Detailed.sol";
import "../vendor/openzeppelin/ERC20Mintable.sol";
import "../vendor/openzeppelin/ERC20Burnable.sol";

contract TokenLogic is Initializable, ERC20, ERC20Detailed, ERC20Mintable, ERC20Burnable {
    function initialize(string memory _name, string memory _symbol, uint8 _decimal) public initializer{
        ERC20Detailed.initialize(_name, _symbol, _decimal);
        ERC20Mintable.initialize(msg.sender);
    }

}
