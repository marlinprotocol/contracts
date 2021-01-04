const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const MPondProxy = artifacts.require("MPondProxy.sol");
const MPondLogic = artifacts.require("MPondLogic.sol");
const BridgeLogic = artifacts.require("BridgeLogic.sol");
const BridgeProxy = artifacts.require("BridgeProxy.sol");
const web3Utils = require("web3-utils");
const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider || "http://127.0.0.1:8545");
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const z6 = "000000"
const z18 = z6+z6+z6

async function reverts(promise, message) {
    try {
        await promise;
        throw null;
    }
    catch (error) {
        assert(error, "Expected an error but did not get one");
        assert(error.message.startsWith(PREFIX + message), "Expected an error starting with '" + PREFIX + message + "' but got '" + error.message + "' instead");
    }
};

contract("Bridge", async (accounts) => {
  it("should initialize", async () => {
    let bridge = await BridgeLogic.at((await BridgeProxy.deployed()).address);
    let mpond = await MPondLogic.at((await MPondProxy.deployed()).address);
    let pond = await TokenLogic.at((await TokenProxy.deployed()).address);

    await bridge.initialize(
      mpond.address,
      pond.address,
      accounts[5],
      accounts[6],
      { from: accounts[2] },
    )

    assert.equal(
      await bridge.mpond(),
      mpond.address,
      "MPOND not initialized correctly",
    )
    assert.equal(
      await bridge.pond(),
      pond.address,
      "POND not initialized correctly",
    )
    assert.equal(
      await bridge.owner(),
      accounts[5],
      "Owner not initialized correctly",
    )
    assert.equal(
      await bridge.governanceProxy(),
      accounts[6],
      "Governance proxy not initialized correctly",
    )
  });
});

contract("Bridge", async (accounts) => {
    it("should convert pond to mpond", async () => {
        let bridge = await BridgeLogic.at((await BridgeProxy.deployed()).address);
        let mpond = await MPondLogic.at((await MPondProxy.deployed()).address);
        let pond = await TokenLogic.at((await TokenProxy.deployed()).address);

        await bridge.initialize(
            mpond.address,
            pond.address,
            accounts[5],
            accounts[6],
            { from: accounts[2] },
        );

        await mpond.initialize(
            accounts[0],
            bridge.address,
            bridge.address,
            { from: accounts[2] },
        );
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "7000"+z18,
            "Wrong MPOND balance of bridge after mpond init"
        )

        await pond.initialize(
            "POND",
            "POND",
            18,
            bridge.address,
            // { from: accounts[2] },
        );
        assert.equal(
            await pond.balanceOf(bridge.address),
            "1000"+z6+z18,
            "Wrong POND balance of bridge after pond init"
        )

        await pond.mint(accounts[1], "10"+z6+z18);
        await pond.approve(bridge.address, "10"+z6+z18, { from: accounts[1] });

        await bridge.getMpond("5"+z18, { from: accounts[1] });

        assert.equal(
            await pond.balanceOf(accounts[1]),
            "5"+z6+z18,
            "Wrong POND balance of user"
        )
        assert.equal(
            await mpond.balanceOf(accounts[1]),
            "5"+z18,
            "Wrong MPOND balance of user"
        )
        assert.equal(
            await pond.balanceOf(bridge.address),
            "1005"+z6+z18,
            "Wrong POND balance of bridge"
        )
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "6995"+z18,
            "Wrong MPOND balance of bridge"
        )
    });
});


contract("Bridge", async (accounts) => {
    it("should convert mpond to pond as per table", async () => {
        let bridge = await BridgeLogic.at((await BridgeProxy.deployed()).address);
        let mpond = await MPondLogic.at((await MPondProxy.deployed()).address);
        let pond = await TokenLogic.at((await TokenProxy.deployed()).address);

        await bridge.initialize(
            mpond.address,
            pond.address,
            accounts[5],
            accounts[6],
            { from: accounts[2] },
        );

        await mpond.initialize(
            accounts[0],
            bridge.address,
            bridge.address,
            { from: accounts[2] },
        );
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "7000"+z18,
            "Wrong MPOND balance of bridge after mpond init"
        )

        await pond.initialize(
            "POND",
            "POND",
            18,
            bridge.address,
            // { from: accounts[2] },
        );
        assert.equal(
            await pond.balanceOf(bridge.address),
            "1000"+z6+z18,
            "Wrong POND balance of bridge after pond init"
        );

        await bridge.changeLiquidityBp(0, { from: accounts[5] });

        // Day -1

        await mpond.transfer(accounts[1], "1000"+z18, { from: accounts[0] })
        await mpond.approve(bridge.address, "1000"+z18, { from: accounts[1] })

        // Day 0

        await expectRevert(
            bridge.placeRequest("1100"+z18, { from: accounts[1] }),
            "Request should be placed with amount greater than 0 and less than remainingAmount"
        )

        await bridge.placeRequest("900"+z18, { from: accounts[1] })

        // Day 30
        await increaseTime(30*86400);

        await bridge.placeRequest("50"+z18, { from: accounts[1] })

        // Day 31
        await increaseTime(1*86400);

        await expectRevert(
            bridge.placeRequest("100"+z18, { from: accounts[1] }),
            "Request should be placed with amount greater than 0 and less than remainingAmount"
        )

        // Day 180
        await increaseTime(149*86400);

        await expectRevert(
            bridge.convert(0, "950"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )
        await expectRevert(
            bridge.convert(0, "1"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        await bridge.changeLiquidityBp(1000, { from: accounts[5] });

        await bridge.convert(0, "85"+z18, { from: accounts[1] })

        assert.equal(
            await mpond.balanceOf(accounts[1]),
            "915"+z18,
            "Wrong MPOND balance of user after day 180"
        );
        assert.equal(
            await pond.balanceOf(accounts[1]),
            "85"+z6+z18,
            "Wrong POND balance of user after day 180"
        );
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "7085"+z18,
            "Wrong MPOND balance of bridge after day 180"
        );
        assert.equal(
            await pond.balanceOf(bridge.address),
            "915"+z6+z18,
            "Wrong POND balance of bridge after day 180"
        );

        await expectRevert(
            bridge.convert(0, "10"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        await bridge.changeLiquidityBp(500, { from: accounts[5] });
        await expectRevert(
            bridge.convert(0, "2"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        await bridge.changeLiquidityBp(1000, { from: accounts[5] });

        await bridge.convert(0, "2"+z18, { from: accounts[1] })

        assert.equal(
            await mpond.balanceOf(accounts[1]),
            "913"+z18,
            "Wrong MPOND balance of user after day 180"
        );
        assert.equal(
            await pond.balanceOf(accounts[1]),
            "87"+z6+z18,
            "Wrong POND balance of user after day 180"
        );
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "7087"+z18,
            "Wrong MPOND balance of bridge after day 180"
        );
        assert.equal(
            await pond.balanceOf(bridge.address),
            "913"+z6+z18,
            "Wrong POND balance of bridge after day 180"
        );

        // Day 210
        await increaseTime(30*86400);

        await expectRevert(
            bridge.convert(0, "10"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )
        await expectRevert(
            bridge.convert(30, "10"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        await bridge.changeLiquidityBp(2000, { from: accounts[5] });

        await bridge.convert(30, "10"+z18, { from: accounts[1] })

        assert.equal(
            await mpond.balanceOf(accounts[1]),
            "903"+z18,
            "Wrong MPOND balance of user after day 180"
        );
        assert.equal(
            await pond.balanceOf(accounts[1]),
            "97"+z6+z18,
            "Wrong POND balance of user after day 180"
        );
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "7097"+z18,
            "Wrong MPOND balance of bridge after day 180"
        );
        assert.equal(
            await pond.balanceOf(bridge.address),
            "903"+z6+z18,
            "Wrong POND balance of bridge after day 180"
        );

        await expectRevert(
            bridge.convert(30, "1"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )
        await expectRevert(
            bridge.convert(0, "100"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        await bridge.convert(0, "93"+z18, { from: accounts[1] })

        assert.equal(
            await mpond.balanceOf(accounts[1]),
            "810"+z18,
            "Wrong MPOND balance of user after day 180"
        );
        assert.equal(
            await pond.balanceOf(accounts[1]),
            "190"+z6+z18,
            "Wrong POND balance of user after day 180"
        );
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "7190"+z18,
            "Wrong MPOND balance of bridge after day 180"
        );
        assert.equal(
            await pond.balanceOf(bridge.address),
            "810"+z6+z18,
            "Wrong POND balance of bridge after day 180"
        );

        await expectRevert(
            bridge.convert(0, "1"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        // Day 360
        await increaseTime(150*86400);

        await expectRevert(
            bridge.convert(0, "200"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        await bridge.changeLiquidityBp(1000, { from: accounts[5] });

        await expectRevert(
            bridge.convert(0, "1"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )

        await bridge.changeLiquidityBp(2000, { from: accounts[5] });

        await bridge.convert(0, "180"+z18, { from: accounts[1] })

        assert.equal(
            await mpond.balanceOf(accounts[1]),
            "630"+z18,
            "Wrong MPOND balance of user after day 180"
        );
        assert.equal(
            await pond.balanceOf(accounts[1]),
            "370"+z6+z18,
            "Wrong POND balance of user after day 180"
        );
        assert.equal(
            await mpond.balanceOf(bridge.address),
            "7370"+z18,
            "Wrong MPOND balance of bridge after day 180"
        );
        assert.equal(
            await pond.balanceOf(bridge.address),
            "630"+z6+z18,
            "Wrong POND balance of bridge after day 180"
        );

        await expectRevert(
            bridge.convert(0, "1"+z18, { from: accounts[1] }),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        )
   });
});

async function increaseTime(time) {
    return new Promise ((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: 0,
        }, (err, res) => {
            if(err) {
                reject(err)
            } else {
                web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    params: [],
                    id: 0
                }, (err, res) => {
                    if(err) {
                        reject(err)
                    } else {
                        resolve()
                    }
                });
            }
        })
    });
}
