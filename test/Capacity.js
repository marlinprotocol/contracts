var Web3 = require("web3");
var web3 = new Web3(Web3.givenProvider || "http://127.0.0.1:8545");

var TokenProxy = artifacts.require("TokenProxy.sol");
var TokenLogic = artifacts.require("TokenLogic.sol");

var CapacityLogic = artifacts.require("CapacityLogic.sol");
var CapacityProxy = artifacts.require("CapacityProxy.sol");

contract("Capacity", function (accounts) {
  var capacityInstance;
  var tokenInstance;
  var capacityAddress;
  var tokenAddress;
  var attestationBytes1;
  var attestationBytes2;

  it("deploy token contract", function () {
    return TokenProxy.deployed({from: accounts[1]})
      .then(function (instance) {
        return instance;
      })
      .then(function (instance) {
        return TokenLogic.at(instance.address);
      })
      .then(function (instance) {
        tokenInstance = instance;
        tokenAddress = instance.address;
        return;
      });
  });
  it("deploy capacity contract", function () {
    return CapacityProxy.deployed({from: accounts[1]})
      .then(function (instance) {
        return instance;
      })
      .then(function (instance) {
        return CapacityLogic.at(instance.address);
      })
      .then(function (instance) {
        capacityInstance = instance;
        capacityAddress = instance.address;
        return;
      });
  });

  it("initialise both the contracts", function () {
    return tokenInstance
      .initialize("Marlin Protocol", "LIN", 18)
      .then(function () {
        return;
      })
      .then(function () {
        return capacityInstance.initialize(tokenAddress);
      })
      .then(function () {
        return tokenInstance.mint(accounts[0], 0x5555555555);
      });
  });

  it("generate attestation bytes1", async function () {
    address = web3.utils.toChecksumAddress(accounts[10]);
    var attestationHexBytes =
      "1111111122223333333344444444555555556666666666666666666666666666666666666666666666666666666666666666";
    var msg = Buffer.from(attestationHexBytes, "hex");

    var h = web3.utils.keccak256(msg);
    let data = await web3.eth.sign(h, address);
    var r = `0x${data.slice(2, 66)}`;
    var s = `0x${data.slice(66, 130)}`;
    var v = data.slice(130, 132) == "00" ? 27 : 28;

    return capacityInstance.testEcrecover
      .call("0x" + attestationHexBytes, v, r, s)
      .then(function (data) {
        let version = v == 27 ? "1b" : "1c";
        attestationBytes1 =
          "0x" +
          attestationHexBytes +
          version +
          r.split("x")[1] +
          s.split("x")[1];
        assert.equal(data, address, "EC recover should return same address");
      });
  });

  it("generate attestation bytes2", async function () {
    address = web3.utils.toChecksumAddress(accounts[10]);
    var attestationHexBytes =
      "2111111122223333333344444444555555556666666666666666666666666666666666666666666666666666666666666666";
    var msg = Buffer.from(attestationHexBytes, "hex");

    var h = web3.utils.keccak256(msg);
    let data = await web3.eth.sign(h, address);
    var r = `0x${data.slice(2, 66)}`;
    var s = `0x${data.slice(66, 130)}`;
    var v = data.slice(130, 132) == "00" ? 27 : 28;

    return capacityInstance.testEcrecover
      .call("0x" + attestationHexBytes, v, r, s)
      .then(function (data) {
        let version = v == 27 ? "1b" : "1c";
        attestationBytes2 =
          "0x" +
          attestationHexBytes +
          version +
          r.split("x")[1] +
          s.split("x")[1];
        assert.equal(data, address, "EC recover should return same address");
      });
  });

  it("check overlapping stake", function () {
    return tokenInstance
      .transfer(accounts[10], 0x5555555555)
      .then(function () {
        return tokenInstance.increaseAllowance(capacityAddress, 0x5555555555, {
          from: accounts[10],
        });
      })
      .then(function () {
        return capacityInstance.deposit(0x5555555555 - 6000, {
          from: accounts[10],
        });
      })
      .then(function () {
        return tokenInstance.balanceOf(accounts[10]);
      })
      .then(function (balance) {
        assert.equal(balance, 6000, "6000 should be remaining");
        return;
      })
      .then(function () {
        return capacityInstance.reportOverlappingProducerStakes(
          attestationBytes1,
          attestationBytes2,
          accounts[12]
        );
      })
      .then(function () {
        return capacityInstance.withdrawAll({from: accounts[12]});
      })
      .then(function () {
        return tokenInstance.balanceOf(accounts[12]);
      })
      .then(function (balance) {
        console.log(balance);
        assert.notEqual(balance, 0, "Some amount should be withdrawn");
      });
  });
});
