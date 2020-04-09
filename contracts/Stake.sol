// this contract will hold all tokens

pragma solidity ^0.6.1;

import "./Token.sol";
import "./vendor/openzeppelin/contracts/math/SafeMath.sol";

contract Stake {
    using SafeMath for uint256;
    Token public token;

    constructor(address _token) public {
        token = Token(_token);
    }

    mapping(address => uint256) public lockedBalances;
    mapping(address => uint256) public unlockedBalances;

    event Deposit(address sender, uint256 amount);
    // We don't need bool withdrawn
    event Withdraw(address sender, uint256 amount, bool withdrawn);
    event Lock(address sender, uint256 amount);
    event Unlock(address sender, uint256 amount);

    function deposit(uint256 _amount) public returns (uint256) {
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient balance");
        require(
            token.allowance(msg.sender, address(this)) >= _amount,
            "The contract is not allowed to spend on the user's behalf"
        );
        lockedBalances[msg.sender] = lockedBalances[msg.sender].add(_amount);
        token.transferFrom(msg.sender, address(this), _amount);
        emit Deposit(msg.sender, _amount);
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

    function lockBalance(uint256 _amount) private returns (bool) {
        require(
            _amount <= unlockedBalances[msg.sender],
            "Amount greater than the unlocked amount"
        );
        unlockedBalances[msg.sender] = unlockedBalances[msg.sender].sub(
            _amount
        );
        lockedBalances[msg.sender] = lockedBalances[msg.sender].add(_amount);
        emit Lock(msg.sender, _amount);
        return true;
    }
    
    function unlockBalance(uint256 _amount) private returns (bool) {
        require(
            _amount <= unlockedBalances[msg.sender],
            "Amount greater than the unlocked amount"
        );
        lockedBalances[msg.sender] = lockedBalances[msg.sender].sub(
            _amount
        );
        unlockedBalances[msg.sender] = unlockedBalances[msg.sender].add(_amount);
        emit Unlock(msg.sender, _amount);
        return true;
    }

    function slashStake(address _duplicateStakeAddress, address _submitterWithdrawAddress, uint256 _amountToBeSlashed, uint256 _percentTransfer) internal returns (bool) {
        require(lockedBalances[_duplicateStakeAddress] >= _amountToBeSlashed, "Amount to be slashed must be less than available balance");
        // lockedBalances[_duplicateStakeAddress] = lockedBalances[_duplicateStakeAddress].add(_amountToBeSlashed);
        lockedBalances[_duplicateStakeAddress] = lockedBalances[_duplicateStakeAddress].sub(_amountToBeSlashed);
        unlockedBalances[_submitterWithdrawAddress] = unlockedBalances[_submitterWithdrawAddress].add(_amountToBeSlashed.mul(_percentTransfer).div(100));
        return true;
    }
}
