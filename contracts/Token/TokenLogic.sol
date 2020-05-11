pragma solidity >=0.4.21 <0.7.0;

import "./token/Initializable.sol";
import "./token/ERC20.sol";
import "./token/ERC20Detailed.sol";
import "./token/ERC20Mintable.sol";
import "./token/ERC20Burnable.sol";

contract TokenLogic is Initializable, ERC20, ERC20Detailed, ERC20Mintable, ERC20Burnable {
    function initialize(string memory _name, string memory _symbol, uint8 _decimal) public initializer{
        ERC20Detailed.initialize(_name, _symbol, _decimal);
        ERC20Mintable.initialize(msg.sender);
    }

}
