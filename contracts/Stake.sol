pragma solidity >=0.4.21 <0.7.0;
import "./Token.sol";

contract Stake{

    Token public token;
    mapping(address=>uint256) public staked;

    constructor(address _token) public{
        token = Token(_token);
    }

    event Staking(
        address Staker,
        uint256 Amount
    );

    function stake(uint256 _amount) public {
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient balance");
        token.approveContract(address(this), msg.sender, _amount);
        staked[msg.sender] += _amount;
    	token.transferFrom(msg.sender, address(this), _amount);
        emit Staking(msg.sender, _amount);
    }

}