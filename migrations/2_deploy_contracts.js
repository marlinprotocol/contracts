const Test = artifacts.require("../contracts/Test.sol");
const MarlinPaymentChannel = artifacts.require(
  "../contracts/MarlinPaymentChannel.sol"
);
const CryptoLib = artifacts.require("../contracts/CryptoLib.sol");
const Ops = artifacts.require("../contracts/Ops.sol");

module.exports = function(deployer) {
  // deployer.deploy(Test);
  deployer.deploy(CryptoLib);
  deployer.link(CryptoLib, MarlinPaymentChannel);
  deployer.deploy(Ops);
  deployer.link(Ops, MarlinPaymentChannel);
  deployer.deploy(MarlinPaymentChannel);
};
