const GovernorAlpha = artifacts.require("GovernorAlpha.sol");
const Timelock = artifacts.require("Timelock.sol");
// const MPond = artifacts.require("MPond.sol");
const MPondProxy = artifacts.require("MPondProxy.sol");
const MPondLogic = artifacts.require("MPondLogic.sol");
const web3Utils = require("web3-utils");
const ethJsUtil = require("ethereumjs-util");
const Web3 = require("web3");

module.exports = async function (deployer, network, accounts) {
  // only for testing, change when the networks change
  if (network == "development") {
    const web3 = new Web3("http://127.0.0.1:8545/");

    let guardianAddress = accounts[5];
    let MPondAdmin = accounts[4];
    let bridge = accounts[11];
    let transactionCount = await web3.eth.getTransactionCount(guardianAddress);
    var futureAddress = ethJsUtil.bufferToHex(
      ethJsUtil.generateAddress(guardianAddress, transactionCount)
    );
    console.log("pre-generated governor alpha address", futureAddress);
    let timelockAdmin = futureAddress;

    let delay = new web3Utils.BN("259200");
    // only for testing
    await deployer
      .deploy(Timelock, timelockAdmin, delay)
      .then(function () {
        return deployer.deploy(MPondLogic);
      })
      .then(function (MPondLogic) {
        return deployer.deploy(MPondProxy, MPondLogic.address, accounts[0]);
      })
      // .then(function () {
      //   return deployer.deploy(MPond, MPondAdmin, bridge);
      // })
      .then(function () {
        return deployer.deploy(
          GovernorAlpha,
          Timelock.address,
          MPondProxy.address,
          guardianAddress,
          {from: guardianAddress}
        );
      })
      .then(function () {
        console.log("*****************************************");
        console.log("Timelock.address", Timelock.address);
        console.log("MPondProxy.address", MPondProxy.address);
        console.log("GovernorAlpha.address", GovernorAlpha.address);
        console.log("MPondAdmin", MPondAdmin);
        console.log("guardianAddress", guardianAddress);
        console.log("timelockAdmin", timelockAdmin);
        console.log("delay", delay);
        console.log("*****************************************");
        return;
      });
  }
};
