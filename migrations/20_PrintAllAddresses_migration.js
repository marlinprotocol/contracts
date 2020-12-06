let ClusterDefault = artifacts.require("ClusterDefault.sol");
let Receiver = artifacts.require("Receiver.sol");
let Producer = artifacts.require("Producer.sol");
let ClusterRegistry = artifacts.require("ClusterRegistry.sol");
let LuckManager = artifacts.require("LuckManager.sol");
let Pot = artifacts.require("Pot.sol");
let FundManager = artifacts.require("FundManager.sol");
let Verifier_Producer = artifacts.require("VerifierProducer.sol");
let Verifier_Receiver = artifacts.require("VerifierReceiver.sol");

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    console.log("********************************************************");
    console.log("Default Cluster Address   :", ClusterDefault.address);
    // console.log("Receiver Registry Address :", Receiver.address);
    console.log("Producer Registry Address :", Producer.address);
    console.log("Cluster Registry Address  :", ClusterRegistry.address);
    console.log("Luck Manager Address      :", LuckManager.address);
    console.log("Pot Address               :", Pot.address);
    console.log("Fund Manager Address      :", FundManager.address);
    console.log("Verifier Producer Address :", Verifier_Producer.address);
    // console.log("Verifier Receiver Address :", Verifier_Receiver.address);
    console.log("********************************************************");
  }
};
