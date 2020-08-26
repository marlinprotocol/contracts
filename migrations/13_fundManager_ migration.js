let FundManager = artifacts.require("FundManager.sol");
// let LINProxy = artifacts.require("TokenProxy.sol");
// let appConfig = require("../app-config");

// module.exports = async function (deployer, network, accounts) {
//     let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];

//     deployer.deploy(FundManager, LINProxy.address, governanceProxy);
// }

module.exports = async function(deployer) {
    await deployer
    .deploy(FundManager)
    .then(function () {
      return deployer.deploy(FundManagerProxy, FundManager.address);
    });
}