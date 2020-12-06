const ClusterDefault = artifacts.require("ClusterDefault.sol");
const ClusterDefaultProxy = artifacts.require("ClusterDefaultProxy.sol");
const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");
// const LINProxy = artifacts.require("TokenProxy.sol");
// const Pot = artifacts.require("Pot.sol");
// const appConfig = require("../app-config");

// module.exports = async function (deployer, network, accounts) {
//     let admin = accounts[1];
//     let relayer = accounts[7];

//     await deployer.deploy(ClusterDefault)
//         .then((clusterDefaultContract) => {
//             clusterDefaultContract.joinCluster({from: relayer});
//             clusterDefaultContract.isRelayer(relayer).then(console.log);
//         }).then(async () => {
//             await deployer.deploy(ClusterRegistry, ClusterDefault.address, appConfig.clusterExitWaitEpochs, appConfig.clusterMinStake, LINProxy.address, Pot.address)
//         });
// }

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    await deployer.deploy(ClusterDefault).then(function () {
      return deployer.deploy(ClusterDefaultProxy, ClusterDefault.address);
    });
    await deployer.deploy(ClusterRegistry).then(function () {
      return deployer.deploy(ClusterRegistryProxy, ClusterRegistry.address);
    });
  }
};
