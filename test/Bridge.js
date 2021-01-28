const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const mPondProxy = artifacts.require("MPondProxy.sol");
const mPondLogic = artifacts.require("MPondLogic.sol");
const BridgeLogic = artifacts.require("BridgeLogic.sol");
const BridgeProxy = artifacts.require("BridgeProxy.sol");
const web3Utils = require("web3-utils");
const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider || "http://127.0.0.1:8545");

contract.skip("Bridge", function (accounts) {
  var token;
  var mPond;
  var bridge;

  it("deploy contracts and instantiate", function () {
    return TokenLogic.new({from: accounts[1]})
      .then(function (logic) {
        return TokenProxy.new(logic.address, accounts[20], {from: accounts[1]}); //accounts[20] is the proxy admin
      })
      .then(function (instance) {
        return TokenLogic.at(instance.address);
      })
      .then(function (instance) {
        token = instance;
        return mPondProxy.new(mPondLogic.address, accounts[20], {
          from: accounts[1],
        }); //accounts[20] is the proxy admin
      })
      .then(function (proxyContract) {
        let mPondAdmin = accounts[0];
        return mPondLogic.at(proxyContract.address);
      })
      .then(function (instance) {
        mPond = instance;
        let admin = accounts[0];
        let governanceProxy = accounts[0];
        // return Bridge.new(mPond.address, token.address, admin, governanceProxy);
        return BridgeProxy.new(BridgeLogic.address, accounts[20], {
          from: accounts[1],
        }); //accounts[20] is the proxy admin
      })
      .then(function (proxyContract) {
        return BridgeLogic.at(proxyContract.address);
      })
      .then(function (instance) {
        bridge = instance;
        return token.initialize("Marlin Protocol", "POND", 18, bridge.address);
      })
      .then(function () {
        return token.name();
      })
      .then(function (name) {
        console.table({name});
        return mPond.initialize(accounts[4], accounts[11], accounts[12]); // accounts[12] is assumed to temp x-chain bridge address
      })
      .then(function () {
        return mPond.name();
      })
      .then(function (name) {
        console.table({name});
        return bridge.initialize(
          mPond.address,
          token.address,
          accounts[0],
          accounts[0]
        );
      })
      .then(function () {
        return bridge.pondPerMpond();
      })
      .then(function (pondPerMpond) {
        console.table({pondPerMpond});
        return mPond.changeDropBridge(bridge.address);
      });
  });

  it("check balances", function () {
    let admin = accounts[0];
    return mPond
      .transfer(accounts[0], new web3Utils.BN("1000"), {from: accounts[4]})
      .then(function () {
        return mPond.balanceOf(admin);
      })
      .then(function (balance) {
        console.log({balance});
        assert.equal(
          balance > 0,
          true,
          "mPond balance should be greater than 0"
        );
        return token.mint(admin, new web3Utils.BN("1000000000"));
        // return;
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
    return mPond
      .approve(bridge.address, new web3Utils.BN("1000"))
      .then(function () {
        return mPond.transfer(accounts[0], new web3Utils.BN("1000"), {
          from: accounts[4],
        });
      })
      .then(function () {
        return token.approve(bridge.address, new web3Utils.BN("10000000"));
      })
      .then(function () {
        return bridge.addLiquidity(
          new web3Utils.BN("1000"),
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
        return mPond.addWhiteListAddress(accounts[0]);
      });
  });
  it("pond to mPond conversion (i.e get mpond)", function () {
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
        return mPond.balanceOf(testingAccount);
      })
      .then(function (balance) {
        assert(
          balance > 0,
          true,
          "mpond balance should be available in testing account"
        );
      });
  });

  it.skip("mPond to pond conversion (i.e get pond) (old one)", function () {
    let testingAccount = accounts[8];
    return mPond
      .transfer(testingAccount, new web3Utils.BN("100"))
      .then(function () {
        return mPond.approve(bridge.address, new web3Utils.BN("100"), {
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
        return increaseTime(180 * 86400);
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

  it("Check mPond to conversion and locks", function () {
    let testingAccount = accounts[8];
    return mPond
      .transfer(testingAccount, new web3Utils.BN("1000"))
      .then(function () {
        return mPond.approve(bridge.address, new web3Utils.BN("1000"), {
          from: testingAccount,
        });
      })
      .then(function () {
        return increaseTime(0.5 * 86400);
      })
      .then(function () {
        return addBlocks(2, accounts);
      })
      .then(function (epoch) {
        return bridge.placeRequest(500, {from: testingAccount});
      })
      .then(function () {
        // above will create request on 0th epoch.
        return bridge.requests(testingAccount, 0);
      })
      .then(function (request) {
        console.log({request});
        return bridge.effectiveLiquidity();
      })
      .then(function (liquidityBp) {
        console.log(`effective liquidity at ${liquidityBp} at start`);
        return increaseTime(191.5 * 86400);
      })
      .then(function () {
        return addBlocks(2, accounts);
      })
      .then(function () {
        return bridge.getConvertableAmount(testingAccount, 0);
      })
      .then(function (convertableAmount) {
        console.log({convertableAmount});
        return;
      })
      .then(function () {
        return bridge.effectiveLiquidity();
      })
      .then(function (liquidityBp) {
        console.log(`effective liquidity at ${liquidityBp} at end`);
        return mPond.addWhiteListAddress(testingAccount);
      })
      .then(function () {
        return bridge.convert(0, 2, {from: testingAccount});
      })
      .then(function () {
        return token.balanceOf(testingAccount);
      })
      .then(function (balance) {
        console.log(`Balance obtained via mPond conversion ${balance}`);
        assert(balance > 0, true, "Balance should be non-zero");
        return bridge.getClaimedAmount(testingAccount, 0);
      })
      .then(function (claimedAmount) {
        console.log({claimedAmount});
        return bridge.getConvertableAmount(testingAccount, 0);
      })
      .then(function (convertableAmount) {
        console.log({convertableAmount});
        //check convertable amount afet 500 days
        return increaseTime(500 * 86400);
      })
      .then(function () {
        return addBlocks(2, accounts);
      })
      .then(function () {
        return bridge.getConvertableAmount(testingAccount, 0);
      })
      .then(function (convertableAmount) {
        console.log({convertableAmount});
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
