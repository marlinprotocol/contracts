const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const Comp = artifacts.require("Comp.sol");
const Bridge = artifacts.require("Bridge.sol");

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    let compAdmin = accounts[1];
    let admin = accounts[0];
    let governanceProxy = accounts[0];
    await deployer
      .deploy(Comp, compAdmin)
      .then(function () {
        return deployer.deploy(TokenLogic);
      })
      .then(function () {
        return deployer.deploy(TokenProxy, TokenLogic.address);
      })
      .then(function () {
        return deployer.deploy(
          Bridge,
          Comp.address,
          TokenProxy.address,
          admin,
          governanceProxy
        );
      })
      .then(function () {
        console.log("***********************************************");
        console.log(TokenLogic.address, "TokenLogic.address");
        console.log(TokenProxy.address, "TokenProxy.address");
        console.log(Comp.address, "Comp.address");
        console.log(Bridge.address, "Bridge.address");
        console.log(admin, "Bridge.admin");
        console.log("***********************************************");
      });
  }
};
