const AddressRegistry = artifacts.require("AddressRegistry.sol");
const StakeRegistry = artifacts.require("StakeRegistry.sol");
const ValidatorRegistry = artifacts.require("ValidatorRegistry.sol");
const Distribution = artifacts.require("Distribution.sol");
const mPondProxy = artifacts.require("mPondProxy.sol");
const mPondLogic = artifacts.require("mPondLogic.sol");

module.exports = async function (deployer, network, accounts) {
  if (network == "development") {
    let offlineSigner = accounts[0];
    let governanceProxy = accounts[0];

    return deployer
      .deploy(ValidatorRegistry)
      .then(function () {
        return deployer.deploy(AddressRegistry, offlineSigner);
      })
      .then(function () {
        return deployer.deploy(
          StakeRegistry,
          ValidatorRegistry.address,
          governanceProxy
        );
      })
      .then(function () {
        return deployer.deploy(mPondLogic);
      })
      .then(function () {
        return deployer.deploy(mPondProxy, mPondLogic.address);
      })
      .then(function () {
        return deployer.deploy(
          Distribution,
          ValidatorRegistry.address,
          StakeRegistry.address,
          AddressRegistry.address,
          mPondProxy.address
        );
      })
      .then(function () {
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("Distribution.address", Distribution.address);
        console.log("ValidatorRegistry.address", ValidatorRegistry.address);
        console.log("StakeRegistry.address", StakeRegistry.address);
        console.log("AddressRegistry.address", AddressRegistry.address);
        console.log("mPondLogic.address", mPondLogic.address);
        console.log("mPondProxy.address", mPondProxy.address);
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        return;
      });
  }
};
