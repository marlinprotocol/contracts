const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const Comp = artifacts.require("Comp.sol");
const Bridge = artifacts.require("Bridge.sol");
const web3Utils = require("web3-utils");
const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider || "http://127.0.0.1:8545");

contract("Bridge", function (accounts) {
  var token;
  var comp;
  var bridge;

  it("deploy contracts and instantiate", function () {
    return TokenLogic.new({from: accounts[1]})
      .then(function (logic) {
        return TokenProxy.new(logic.address, {from: accounts[1]});
      })
      .then(function (instance) {
        return TokenLogic.at(instance.address);
      })
      .then(function (instance) {
        token = instance;
        return;
      })
      .then(function () {
        let compAdmin = accounts[0];
        return Comp.new(compAdmin);
      })
      .then(function (instance) {
        comp = instance;
        let admin = accounts[0];
        return Bridge.new(comp.address, token.address, admin);
      })
      .then(function (instance) {
        bridge = instance;
        return token.initialize("Marlin Protocol", "POND", 18);
      })
      .then(function () {
        return token.name();
      })
      .then(function (name) {
        console.table({name});
        return;
      });
  });

  it("check balances", function () {
    let admin = accounts[0];
    return comp
      .balanceOf(admin)
      .then(function (balance) {
        assert.equal(
          balance > 0,
          true,
          "Comp balance should be greater than 0"
        );
        return token.mint(admin, new web3Utils.BN("1000000000"));
      })
      .then(function () {
        let admin = accounts[0];
        return token.balanceOf(admin);
      })
      .then(function (balance) {
        assert.equal(
          balance > 0,
          true,
          "Token balance should be greater than 0"
        );
      });
  });

  it("bridge add liquidity", function () {
    var admin = accounts[0];
    return comp
      .approve(bridge.address, new web3Utils.BN("10"))
      .then(function () {
        token.approve(bridge.address, new web3Utils.BN("10000000"));
      })
      .then(function () {
        return bridge.addLiquidity(
          new web3Utils.BN("10"),
          new web3Utils.BN("10000000")
        );
      })
      .then(function () {
        return bridge.getLiquidity();
      })
      .then(function (liquidity) {
        assert(
          liquidity[0] > 0,
          true,
          "mpond liquidity should be greated than 0"
        );
        assert(
          liquidity[1] > 0,
          true,
          "pond liquidity should be greated than 0"
        );
      });
  });
  it("receive mpond for pond (i.e get mpond)", function () {
    let testingAccount = accounts[9];
    return token
      .mint(testingAccount, new web3Utils.BN("1000000"))
      .then(function () {
        return token.approve(bridge.address, new web3Utils.BN("1000000"), {
          from: testingAccount,
        });
      })
      .then(function () {
        return bridge.getMpond(new web3Utils.BN("1"), {from: testingAccount});
      })
      .then(function () {
        return comp.balanceOf(testingAccount);
      })
      .then(function (balance) {
        assert(
          balance > 0,
          true,
          "mpond balance should be available in testing account"
        );
      });
  });

  it("receive pond for mpond (i.e get pond)", function () {
    let testingAccount = accounts[8];
    return comp
      .transfer(testingAccount, new web3Utils.BN("1"))
      .then(function () {
        return comp.approve(bridge.address, new web3Utils.BN("1"), {
          from: testingAccount,
        });
      })
      .then(function () {
        return bridge.getPond(new web3Utils.BN("1000000"), {
          from: testingAccount,
        });
      })
      .then(function (transaction) {
        // console.log(JSON.stringify(transaction, null, 4));
        return increaseTime(86400);
      })
      .then(function () {
        return addBlocks(1, accounts);
      })
      .then(function () {
        return bridge.getClaim(testingAccount, new web3Utils.BN("1"));
      })
      .then(function (claim) {
        // console.log(claim);
        // claimNumber 1 default in params
        return bridge.getPondWithClaimNumber(new web3Utils.BN("1"), {
          from: testingAccount,
        });
        // return;
      })
      .then(function (data) {
        // console.log(data);
        return token.balanceOf(testingAccount);
      })
      .then(function (balance) {
        assert.equal(balance, 1000000, "1000000 pond should be released");
        return;
      });
  });
});

function induceDelay(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

async function increaseTime(time) {
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time],
      id: 0,
    },
    () => {}
  );
}

async function increaseBlocks(accounts) {
  // this transactions is only to increase the few block
  return web3.eth.sendTransaction({
    from: accounts[1],
    to: accounts[2],
    value: 1,
  });
}

async function addBlocks(count, accounts) {
  for (let index = 0; index < count; index++) {
    await increaseBlocks(accounts);
  }
  return;
}
