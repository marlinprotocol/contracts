pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

contract MockToken is StandardToken {
    string public constant name = "Mock Marlin Token";
    string public constant symbol = "MLIN";
    uint8 public constant decimals = 18;

    uint256 constant INITIAL_SUPPLY = 100000000 * (10 ** uint256(decimals));

    constructor() public {
        totalSupply_ = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
        emit Transfer(address(0), msg.sender, INITIAL_SUPPLY);
    }
}
