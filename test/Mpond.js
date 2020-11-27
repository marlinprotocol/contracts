const mPondProxy = artifacts.require("mPondProxy.sol");
const mPondLogic = artifacts.require("mPondLogic.sol");
const web3Utils = require("web3-utils");

var mPondInstance;

contract("MPond Contract", function (accounts) {
  it("Deploy contracts", function () {
    return mPondProxy
      .new(mPondLogic.address, accounts[50], {from: accounts[1]}) //assuming that accounts[50] is proxy admin
      .then(function (instance) {
        return mPondLogic.at(instance.address);
      })
      .then(function (instance) {
        mPondInstance = instance;
        return mPondInstance.initialize(
          accounts[4],
          accounts[11],
          accounts[12]
        ); //accounts[12] is assumed to temp x-chain bridge address
      });
  });

  it("Transfer from random account should fail", function () {
    return mPondInstance
      .transfer(accounts[32], new web3Utils.BN("3e23"), {from: accounts[4]}) // accounts[32] is assumed to be random
      .then(function () {
        return mPondInstance.transfer(accounts[31], new web3Utils.BN("3e23"), {
          from: accounts[32],
        });
      })
      .catch(function (ex) {
        if (!ex) {
          throw new Error("This should throw an exception");
        }
      });
  });

  it("Transfer from x-chain bridge should work", function () {
    return mPondInstance
      .transfer(accounts[12], new web3Utils.BN("3e231"), {from: accounts[4]})
      .then(function () {
        return mPondInstance.transfer(accounts[32], new web3Utils.BN("3e23"), {
          from: accounts[12],
        }); // accounts[12] is assumed to be x-chain bridge
      });
  });
});
