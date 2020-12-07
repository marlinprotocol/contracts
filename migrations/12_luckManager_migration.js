const LuckManager = artifacts.require("LuckManager.sol");
const LuckManagerProxy = artifacts.require("LuckManagerProxy.sol");

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    await deployer.deploy(LuckManager).then(function () {
      return deployer.deploy(
        LuckManagerProxy,
        LuckManager.address,
        accounts[20]
      ); //assume that accounts-20 is the proxy-owner
    });
  }
};
