const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const CompProxy = artifacts.require("CompProxy.sol");
const CompLogic = artifacts.require("CompLogic.sol");

const BridgeLogic = artifacts.require("BridgeLogic.sol");
const BridgeProxy = artifacts.require("BridgeProxy.sol");

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    let compAdmin = accounts[1];
    let admin = accounts[0];
    let governanceProxy = accounts[0];
    await deployer
      .deploy(CompLogic)
      .then(function () {
        return deployer.deploy(CompProxy, CompLogic.address);
      })
      .then(function () {
        return deployer.deploy(TokenLogic);
      })
      .then(function () {
        return deployer.deploy(TokenProxy, TokenLogic.address);
      })
      .then(function () {
        return deployer.deploy(BridgeLogic);
      })
      .then(function () {
        return deployer.deploy(BridgeProxy, BridgeLogic.address);
      });
    // .then(function () {
    //   return deployer.deploy(
    //     Bridge,
    //     Comp.address,
    //     TokenProxy.address,
    //     admin,
    //     governanceProxy
    //   );
    // })
  }
};
