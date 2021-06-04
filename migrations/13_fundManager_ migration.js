let FundManager = artifacts.require("FundManager.sol");
let FundManagerProxy = artifacts.require("FundManagerProxy.sol");

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    await deployer.deploy(FundManager).then(function () {
      return deployer.deploy(
        FundManagerProxy,
        FundManager.address,
        accounts[20]
      ); // assume that accounts-20 is the proxy owner
    });
  }
};
