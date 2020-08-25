const GovernorAlpha = artifacts.require("GovernorAlpha.sol");
const Timelock = artifacts.require("Timelock.sol");
const Comp = artifacts.require("Comp.sol");
const web3Utils = require("web3-utils");
const ethJsUtil = require("ethereumjs-util");
const Web3 = require("web3");

const web3 = new Web3("http://127.0.0.1:8545/");

module.exports = async function (deployer, network, accounts) {
  // only for testing, change when the networks change
  let guardianAddress = accounts[5];
  let transactionCount = await web3.eth.getTransactionCount(
    guardianAddress
  );
  var futureAddress = ethJsUtil.bufferToHex(
    ethJsUtil.generateAddress(guardianAddress, transactionCount)
  );
  console.log("pre-generated governor alpha address", futureAddress);
  let timelockAdmin = futureAddress;
  let compAdmin = accounts[4];

  let delay = new web3Utils.BN("259200");
  // only for testing
  await deployer
    .deploy(Timelock, timelockAdmin, delay)
    .then(function () {
      return deployer.deploy(Comp, compAdmin);
    })
    .then(function () {

      return deployer.deploy(
        GovernorAlpha,
        Timelock.address,
        Comp.address,
        guardianAddress,
        {from: guardianAddress}
      );
    })
    .then(function () {
      console.log("*****************************************");
      console.log("Timelock.address", Timelock.address);
      console.log("Comp.address", Comp.address);
      console.log("GovernorAlpha.address", GovernorAlpha.address);
      console.log("compAdmin", compAdmin);
      console.log("guardianAddress", guardianAddress);
      console.log("timelockAdmin", timelockAdmin);
      console.log("delay", delay);
      console.log("*****************************************");
      return;
    });
};