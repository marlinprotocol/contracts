const Token = artifacts.require("./Token.sol");
const Payment = artifacts.require("./Payment.sol");
const Stake = artifacts.require("./Stake.sol");

module.exports = function(deployer) {
  deployer.deploy(Token, "Merlin Protocol", "MER", 18).then(function(){
    return deployer.deploy(Stake, Token.address);
  }).then(function(){
      return deployer.deploy(Payment, Stake.address);
  });
};
