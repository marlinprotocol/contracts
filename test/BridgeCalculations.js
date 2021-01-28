const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const mPondProxy = artifacts.require("MPondProxy.sol");
const mPondLogic = artifacts.require("MPondLogic.sol");
const BridgeLogic = artifacts.require("BridgeLogic.sol");
const BridgeProxy = artifacts.require("BridgeProxy.sol");
const web3Utils = require("web3-utils");
const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider || "http://127.0.0.1:8545");

contract.skip("BridgeCalculations", function (accounts) {
  var token;
  var mPond;
  var bridge;

  it("deploy contracts and instantiate", function () {
    return TokenLogic.new({from: accounts[1]})
      .then(function (logic) {
        return TokenProxy.new(logic.address, accounts[20], {from: accounts[1]}); // accounts[20] is the proxy admin
      })
      .then(function (instance) {
        return TokenLogic.at(instance.address);
      })
      .then(function (instance) {
        token = instance;
        return mPondProxy.new(mPondLogic.address, accounts[20], {
          from: accounts[1],
        }); // accounts[20] is the proxy admin
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
        }); // accounts[20] is the proxy admin
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
        return;
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
        // return token.mint(admin, new web3Utils.BN("1000000000"));
        // return;
      })
      .then(function () {
        let admin = accounts[0];
        return token.balanceOf(admin);
      })
      .then(function (balance) {
        assert.equal(
          balance == 0,
          true,
          "Token balance should be greater than 0"
        );
      })
      .then(function () {
        return token.balanceOf(bridge.address);
      })
      .then(function (bridgeBalance) {
        assert(
          bridgeBalance > 0,
          true,
          "Bridge balance should be not be zero for swaps"
        );
        return mPond.approve(bridge.address, new web3Utils.BN("1000"));
      });
  });

  it("Day 0 : 1100 amount - should fail", function () {
    return bridge
      .placeRequest(new web3Utils.BN("1100"))
      .then(function () {
        // if need
        throw new Error("This should fail");
      })
      .catch(function (ex) {
        if (!ex) {
          throw new Error("This should throw an exception");
        }
      });
  });

  it("Day 0 : 900 amount", function () {
    return bridge.placeRequest(new web3Utils.BN("900"));
  });
  it("Day 30: 50 amount", function () {
    return increaseTime(30 * 86400)
      .then(function () {
        return bridge.placeRequest(new web3Utils.BN("50"));
      })
      .then(async function () {
        let effectiveLiquidity = await bridge.effectiveLiquidity();
        let liquidityEpoch = await bridge.getLiquidityEpoch();
        assert(
          effectiveLiquidity == 0,
          true,
          "Effective liquidity should be 0 within 180 days"
        );
        assert(
          liquidityEpoch == 0,
          true,
          "liquidity epoch should be 0 within 180 days"
        );
        return;
      });
  });
  it("Day 180: check liquidity", function () {
    let effectiveLiquidity;
    let liquidityEpoch;
    return increaseTime(150 * 86400)
      .then(function () {
        return addBlocks(2, accounts);
      })
      .then(function () {
        return bridge.effectiveLiquidity();
      })
      .then(function (data) {
        effectiveLiquidity = data;
        return bridge.getLiquidityEpoch();
      })
      .then(function (data) {
        liquidityEpoch = data;
        // console.log({liquidityEpoch, effectiveLiquidity});
        assert.notEqual(
          effectiveLiquidity,
          0,
          "Effective liquidity should be 0 within 180 days"
        );
        assert.equal(
          liquidityEpoch,
          1,
          "liquidity epoch should be 1 after 180 days"
        );
        return;
      });
  });

  it("Day 180: call convert 950 - should fail", function () {
    return bridge
      .convert(new web3Utils.BN("0"), new web3Utils.BN("950"))
      .then(function () {
        // if needed
        throw new Error("This should fail");
      })
      .catch(function (ex) {
        if (!ex) {
          throw new Error("This should fail");
        }
      });
  });

  it("Day 180 change liquidity to 10%, effective liquidity 10%", function () {
    let effectiveLiquidity;
    let liquidityEpoch;
    return bridge
      .changeLiquidityBp(new web3Utils.BN("1000"))
      .then(function () {
        return bridge.effectiveLiquidity();
      })
      .then(function (data) {
        effectiveLiquidity = data;
        return bridge.getLiquidityEpoch();
      })
      .then(function (data) {
        liquidityEpoch = data;
        assert.equal(
          effectiveLiquidity,
          1000,
          "Effective liquidity should be 1000, after 180 days when admin has set"
        );
        assert.equal(
          liquidityEpoch,
          1,
          "liquidity epoch should be 1 after 180 days"
        );
      });
  });

  it("Day 180: convert 85 mPond to pond of epoch 0", function () {
    return mPond
      .addWhiteListAddress(bridge.address)
      .then(function () {
        return bridge.convert(new web3Utils.BN("0"), new web3Utils.BN("85"));
      })
      .then(function () {
        return mPond.balanceOf(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 915, "915 mPond should be left");
        return;
      });
  });

  it("Day 180: convert another 10 mPond to pond of epoch 0 - should fail", function () {
    return bridge
      .convert(new web3Utils.BN("0"), new web3Utils.BN("10"))
      .then(function () {
        // if needed
        throw new Error("This should fail");
      })
      .catch(function (ex) {
        if (!ex) {
          throw new Error("this should fail");
        }
      });
  });

  it("Day 180: change liquidity to 5% and withdraw another 10 mpond for epoch 0: should fail", function () {
    return bridge.changeLiquidityBp(new web3Utils.BN("500")).then(function () {
      return bridge
        .convert(new web3Utils.BN("0"), new web3Utils.BN("10"))
        .then(function () {
          // if need something
          throw new Error("This should fail");
        })
        .catch(function (ex) {
          if (!ex) {
            throw new Error("This should fail");
          }
        });
    });
  });

  it("Change liquidity back to 10%", function () {
    return bridge.changeLiquidityBp(new web3Utils.BN("1000"));
  });

  it("Day 180: convert 2 mPond to pond of epoch 0", function () {
    return bridge
      .convert(new web3Utils.BN("0"), new web3Utils.BN("2"))
      .then(function () {
        return mPond.balanceOf(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 913, "913 mPond should be left");
        return;
      });
  });

  it("Day 210: convert 10 mPond of epoch 0 at same 10% liquidity: should fail", function () {
    return increaseTime(30 * 86400)
      .then(function () {
        return addBlocks(2, accounts);
      })
      .then(function () {
        return bridge
          .convert(new web3Utils.BN("0"), new web3Utils.BN("10"))
          .then(function () {
            // if needed something
            throw new Error("This should fail");
          })
          .catch(function (ex) {
            // console.log(ex);
            if (!ex) {
              throw new Error("This should fail");
            }
          });
      });
  });

  it("Day 210: convert 10 mpond after increase the liquidity param to 20%", function () {
    return bridge
      .changeLiquidityBp(new web3Utils.BN("2000"))
      .then(function () {
        return bridge.convert(new web3Utils.BN("0"), new web3Utils.BN("10"));
      })
      .then(function () {
        return mPond.balanceOf(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 903, "Token balance should now be 903");
        return;
      });
  });

  it("Day 210: convert 100 mpond - should fail", function () {
    return bridge
      .convert(new web3Utils.BN("0"), new web3Utils.BN("100"))
      .then(function () {
        // if needed something
        throw new Error("This should fail");
      })
      .catch(function (ex) {
        if (!ex) {
          throw new Error("This should fail");
        }
      });
  });

  it("Day 210: convert 83 mpond", function () {
    return bridge
      .convert(new web3Utils.BN("0"), new web3Utils.BN("83"))
      .then(function () {
        return mPond.balanceOf(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 820, "balance should 810");
        return;
      });
    // return bridge.getConvertableAmount(accounts[0], new web3Utils.BN("0")).then(function(data){
    //     console.log(data);
    // })
  });
  it("Day 213: effective liquidity should be 20%", function () {
    return increaseTime(3 * 86400)
      .then(function () {
        return bridge.effectiveLiquidity();
      })
      .then(function (effectiveLiquidity) {
        assert.equal(
          effectiveLiquidity,
          2000,
          "effective liquidity should be 2000 basis points"
        );
      });
  });

  it("Day 360: effective liquidty should b3 40%", function () {
    return increaseTime(147 * 86400)
      .then(function () {
        return addBlocks(2, accounts);
      })
      .then(function () {
        return bridge.getLiquidityEpoch();
      })
      .then(function (liquidityEpoch) {
        // console.log({liquidityEpoch})
        return;
      })
      .then(function () {
        return bridge.effectiveLiquidity();
      })
      .then(function (effectiveLiquidity) {
        assert.equal(
          effectiveLiquidity,
          4000,
          "effective liquidity should be 4000 basis points"
        );
        return;
      });
  });

  it("Day 390: effective liquidty should be 30% after changing liquidity to 15%", function () {
    return increaseTime(30 * 86400)
      .then(function () {
        return addBlocks(2, accounts);
      })
      .then(function () {
        return bridge.changeLiquidityBp(new web3Utils.BN("1500"));
      })
      .then(function () {
        return bridge.effectiveLiquidity();
      })
      .then(function (effectiveLiquidity) {
        assert.equal(
          effectiveLiquidity,
          3000,
          "effective liquidity should be equal to 3000 basis points"
        );
        return;
      });
  });

  it("Check pond balance: A total of 180 mPond were converted in 390 days, the account should have 180*1000000 pond balance in the account", function () {
    return token.balanceOf(accounts[0]).then(function (balance) {
      assert.equal(balance, 180000000, "18e5 pond should be available");
    });
  });
});

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

async function addBlocks(count, accounts) {
  for (let index = 0; index < count; index++) {
    await increaseBlocks(accounts);
  }
  return;
}

async function increaseBlocks(accounts) {
  // this transactions is only to increase the few block
  return web3.eth.sendTransaction({
    from: accounts[1],
    to: accounts[2],
    value: 1,
  });
}
