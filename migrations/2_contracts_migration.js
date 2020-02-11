const Token = artifacts.require("./Token.sol");
const Payment = artifacts.require("./Payment.sol");
const Stake = artifacts.require("./Stake.sol");

module.exports = function(deployer) {
  deployer.deploy(Token, "Marlin Protocol", "LIN", 18).then(function(){
    return deployer.deploy(Payment, Token.address);
  }).then(function(){
    return deployer.deploy(Stake, Token.address);
  });
};
