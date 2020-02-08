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

    function approveContract(address _contract, address _spender, uint256 _amount) public{
        _approve(_spender, _contract, _amount);
        //     function _approve(address owner, address spender, uint256 value) internal {
        // require(owner != address(0), "ERC20: approve from the zero address");
        // require(spender != address(0), "ERC20: approve to the zero address");

        // _allowances[owner][spender] = value;
        emit Approval(_spender, _contract, _amount);
    }
}
