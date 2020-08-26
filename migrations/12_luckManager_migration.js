const LuckManager = artifacts.require("LuckManager.sol");
const LuckManagerProxy = artifacts.require("LuckManagerProxy.sol");
// const Pot = artifacts.require("Pot.sol");
// const appConfig = require("../app-config");

// module.exports = async function (deployer, network, accounts) {
//     let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
//     let roles = [];
//     let params = [];
//     for(let role in appConfig.roleParams) {
//         let roleData = appConfig.roleParams[role];
//         roles.push(roleData.roleId);
//         let roleParams = [roleData.luckTrailingEpochs, roleData.targetClaims, roleData.averaginingEpochs, roleData.startingEpoch, roleData.varianceTolerance, roleData.changeSteps];
//         params.push(roleParams);
//     }

//     deployer.deploy(LuckManager, governanceProxy, Pot.address, roles, params);
// }

module.exports = async function(deployer) {
    await deployer
    .deploy(LuckManager)
    .then(function () {
      return deployer.deploy(LuckManagerProxy, LuckManager.address);
    });
}
