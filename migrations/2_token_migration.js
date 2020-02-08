const Token = artifacts.require("./Token.sol");
const Payment = artifacts.require("./Payment.sol");

module.exports = function(deployer) {
  deployer.deploy(Token, "Merlin Protocol", "MER", 18).then(function(){
    return deployer.deploy(Payment, Token.address); 
  });
};
