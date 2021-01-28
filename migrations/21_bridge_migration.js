const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const mPondProxy = artifacts.require("MPondProxy.sol");
const mPondLogic = artifacts.require("MPondLogic.sol");

const BridgeLogic = artifacts.require("BridgeLogic.sol");
const BridgeProxy = artifacts.require("BridgeProxy.sol");

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    let mPondAdmin = accounts[1];
    let admin = accounts[0];
    let governanceProxy = accounts[0];
    await deployer
      .deploy(mPondLogic)
      .then(function () {
        return deployer.deploy(mPondProxy, mPondLogic.address, accounts[20]); //accounts[20] is the proxy admin
      })
      .then(function () {
        return deployer.deploy(TokenLogic);
      })
      .then(function () {
        return deployer.deploy(TokenProxy, TokenLogic.address, accounts[20]); //accounts[20] is the proxy admin
      })
      .then(function () {
        return deployer.deploy(BridgeLogic);
      })
      .then(function () {
        return deployer.deploy(BridgeProxy, BridgeLogic.address, accounts[20]); //accounts[20] is the proxy admin
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
