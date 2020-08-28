// Iniitalize
// Token

const GovernorAlpha = artifacts.require("GovernorAlpha.sol");
const Timelock = artifacts.require("Timelock.sol");
const Comp = artifacts.require("Comp.sol");

const TokenProxy = artifacts.require("TokenProxy.sol");
const TokenLogic = artifacts.require("TokenLogic.sol");

var tokenInstance;
var govInstance;
var govInstance2;

contract("Fund Manager", function (accounts) {
  it("deploy and initialise the contracts", function () {
    return TokenProxy.deployed({from: accounts[1]})
      .then(function () {
        return TokenLogic.at(TokenProxy.address);
      })
      .then(function (instance) {
        tokenInstance = instance;
        return GovernorAlpha.deployed();
      })
      .then(function (instance) {
        govInstance = instance;
        return;
      });
  });

  it("check gov variables", function () {
    return govInstance
      .comp()
      .then(function (compAddress) {
        console.log("govAddress", govInstance.address);
        console.log("compAddress", compAddress);
        return govInstance.timelock();
      })
      .then(function (timelockAddress) {
        console.log("timelockAddress", timelockAddress);
        return;
      });
  });
});
