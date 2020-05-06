pragma solidity ^0.6.1;

import "./token/ERC20.sol";
import "./token/ERC20Detailed.sol";
import "./token/ERC20Mintable.sol";
import "./token/ERC20Burnable.sol";

contract TokenLogic is ERC20, ERC20Detailed, ERC20Mintable, ERC20Burnable {

    bool private initialized;

    function initialize(string memory _name, string memory _symbol, uint8 _decimal) public override {
        require(!initialized, "Does the work of constructor");
        ERC20Detailed.initialize(_name, _symbol, _decimal);
        ERC20Mintable.initialize(msg.sender);
    }

}
