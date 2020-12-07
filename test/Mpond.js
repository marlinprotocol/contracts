const MPondProxy = artifacts.require("MPondProxy.sol");
const MPondLogic = artifacts.require("MPondLogic.sol");
const web3Utils = require("web3-utils");

var MPondInstance;

contract("MPond Contract", function (accounts) {
  it("Deploy contracts", function () {
    return MPondProxy.new(MPondLogic.address, accounts[50], {from: accounts[1]}) //assuming that accounts[50] is proxy admin
      .then(function (instance) {
        return MPondLogic.at(instance.address);
      })
      .then(function (instance) {
        MPondInstance = instance;
        return MPondInstance.initialize(
          accounts[4],
          accounts[11],
          accounts[12]
        ); //accounts[12] is assumed to temp x-chain bridge address
      });
  });

  it("Transfer from random account should fail", function () {
    return MPondInstance.transfer(accounts[32], new web3Utils.BN("3e23"), {
      from: accounts[4],
    }) // accounts[32] is assumed to be random
      .then(function () {
        return MPondInstance.transfer(accounts[31], new web3Utils.BN("3e23"), {
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
    return MPondInstance.transfer(accounts[12], new web3Utils.BN("3e231"), {
      from: accounts[4],
    }).then(function () {
      return MPondInstance.transfer(accounts[32], new web3Utils.BN("3e23"), {
        from: accounts[12],
      }); // accounts[12] is assumed to be x-chain bridge
    });
  });
});
