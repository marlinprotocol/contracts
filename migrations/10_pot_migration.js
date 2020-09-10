// const Web3 = require("web3");
// const LINProxy = artifacts.require("TokenProxy.sol");
const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");
// const appConfig = require("../app-config.js");

// const web3 = new Web3("http://127.0.0.1:8545/");

// module.exports = async function (deployer, network, accounts) {
//     let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
//     let firstEpochStartBlock;
//     let EthBlocksPerEpoch = appConfig.EthBlockPerEpoch;
//     await web3.eth.getBlockNumber((err, blockNo) => {
//         firstEpochStartBlock = blockNo + appConfig.potFirstEpochStartBlockDelay;
//     });
//     let roles = [];
//     let distribution = [];
//     for(let role in appConfig.roleParams) {
//         let currentRole = appConfig.roleParams[role];
//         roles.push(currentRole.roleId);
//         distribution.push(currentRole.allocation);
//     }

//     await deployer.deploy(Pot, governanceProxy, LINProxy.address, firstEpochStartBlock, EthBlocksPerEpoch, roles, distribution);
// }

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    await deployer.deploy(Pot).then(function () {
      return deployer.deploy(PotProxy, Pot.address);
    });
  }
};
