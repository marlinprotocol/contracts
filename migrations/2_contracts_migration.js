const Token = artifacts.require("./Token.sol");
const Payment = artifacts.require("./Payment.sol");
const Stake = artifacts.require("./Stake.sol");

var tokenAddress;

module.exports = function(deployer) {
  deployer.deploy(Token, "Marlin Protocol", "LIN", 18).then(function(){
    tokenAddress = Token.address
    return deployer.deploy(Stake, Token.address);
  }).then(function(){
      return deployer.deploy(Payment, tokenAddress);
  });
};
