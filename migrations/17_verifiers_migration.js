// let Receiver = artifacts.require("Receiver.sol");
// let Producer = artifacts.require("Producer.sol");
// let ClusterRegistry = artifacts.require("ClusterRegistry.sol");
// let LuckManager = artifacts.require("LuckManager.sol");
// let Pot = artifacts.require("Pot.sol");
// let FundManager = artifacts.require("FundManager.sol");
let Verifier_Producer = artifacts.require("VerifierProducer.sol");
let Verifier_ProducerProxy = artifacts.require("Verifier_ProducerProxy.sol");
let Verifier_Receiver = artifacts.require("VerifierReceiver.sol");
let Verifier_ReceiverProxy = artifacts.require("Verifier_ProducerProxy.sol");
// let appConfig = require("../app-config");

// module.exports = async function (deployer, network, accounts) {
//     let receiverRole = appConfig.roleParams.receiver.roleId;
//     let producerRole = appConfig.roleParams.producer.roleId;

//     await deployer.deploy(Verifier_Producer, Producer.address, ClusterRegistry.address, LuckManager.address, Pot.address, FundManager.address, producerRole);
//     // deployer.deploy(Verifier_Receiver, Receiver.address, ClusterRegistry.address, LuckManager.address, Pot.address, FundManager.address, receiverRole);
// };

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    await deployer.deploy(Verifier_Producer).then(function () {
      return deployer.deploy(
        Verifier_ProducerProxy,
        Verifier_Producer.address,
        accounts[20]
      ); // assume that accounts-20 is the proxy owner
    });
    await deployer.deploy(Verifier_Receiver).then(function () {
      return deployer.deploy(
        Verifier_ReceiverProxy,
        Verifier_Receiver.address,
        accounts[20]
      ); // assume that accounts-20 is the proxy owner
    });
  }
};
