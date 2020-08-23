pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "../Token/TokenLogic.sol";
import "./Curve.sol";
import "./VoteDelegate.sol";

contract Mintable is Initializable, ERC20, Curve, VoteDelegate {
    address tokenToBurn;
    TokenLogic token;

    function initialize(address _tokenToBurn) public initializer {
        tokenToBurn = _tokenToBurn;
        token = TokenLogic(_tokenToBurn);
        _mint(msg.sender, 10**27);
    }

    function mint(uint256 amount) public returns (bool) {
        uint256 _burnAmount = curve(totalSupply(), amount);
        token.burnFrom(msg.sender, _burnAmount);
        _mint(msg.sender, amount);
        return true;
    }
}
