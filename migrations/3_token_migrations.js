const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");

module.exports = function (deployer, network, accounts) {
  if (network == "development") {
    deployer
      .deploy(TokenLogic)
      .then(function () {
        return deployer.deploy(TokenProxy, TokenLogic.address);
      })
      .then(function () {
        console.log("***********************************************");
        console.log(TokenLogic.address, "TokenLogic.address");
        console.log(TokenProxy.address, "TokenProxy.address");
        console.log("***********************************************");
      });
  }
};
