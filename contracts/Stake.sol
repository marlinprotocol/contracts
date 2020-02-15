// this contract will hold all tokens

pragma solidity ^0.6.1;
import "./Token.sol";
import "../vendor/openzeppelin/contracts/math/SafeMath.sol";

contract Stake {
    using SafeMath for uint256;
    Token public token;

    constructor(address _token) public {
        token = Token(_token);
    }

    mapping(address => uint256) public lockedBalances;
    mapping(address => uint256) public unlockedBalances;

    event Deposit(address sender);
    event Withdraw(address sender, uint256 amount, bool withdrawn);

    function deposit(uint256 _amount) public returns (uint256) {
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient balance");
        require(
            token.allowance(msg.sender, address(this)) >= _amount,
            "The contract is not allowed to spend on the user's behalf"
        );
        lockedBalances[msg.sender] = lockedBalances[msg.sender].add(_amount);
        token.transferFrom(msg.sender, address(this), _amount);
        emit Deposit(msg.sender);
        return _amount;
    }

    function withdraw(uint256 _amount) public returns (uint256) {
        require(
            _amount <= unlockedBalances[msg.sender],
            "Amount greater than the unlocked amount"
        );
        unlockedBalances[msg.sender] = unlockedBalances[msg.sender].sub(
            _amount
        );
        token.transfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount, true);
        return _amount;
    }
}