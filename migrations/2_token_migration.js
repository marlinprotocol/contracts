const Token = artifacts.require("Token");

module.exports = function(deployer) {
  deployer.deploy(Token, "Merlin Protocol", "MER", 18);
};
