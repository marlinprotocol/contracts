var TokenProxy = artifacts.require("TokenProxy.sol");
var TokenLogic = artifacts.require("TokenLogic.sol");

var LGTLogic = artifacts.require("LGTLogic.sol");
var LGTProxy = artifacts.require("LGTProxy.sol");
const web3Utils = require("web3-utils");

contract.skip("LGT", function (accounts) {
  var lgtInstance;
  var tokenInstance;
  var lgtAddress;
  var tokenAddress;

  it("deploy all contracts", function () {
    return TokenProxy.deployed({from: accounts[1]})
      .then(function (instance) {
        return TokenLogic.at(instance.address);
      })
      .then(function (instance) {
        tokenInstance = instance;
        tokenAddress = instance.address;
        return LGTProxy.deployed({from: accounts[1]});
      })
      .then(function (instance) {
        return LGTLogic.at(instance.address);
      })
      .then(function (instance) {
        lgtInstance = instance;
        lgtAddress = instance.address;
        return;
      });
  });

  it("initialise all contracts", function () {
    return tokenInstance
      .initialize("Marlin Protocol", "LIN", 18)
      .then(function () {
        return lgtInstance.initialize(
          "Marlin Governance Tokens",
          "LGT",
          18,
          tokenAddress
        );
      });
  });

  it("check LIN supply from LGT contract", function () {
    return tokenInstance
      .mint(accounts[0], 0x1)
      .then(function () {
        return tokenInstance.totalSupply();
      })
      .then(function (totalSupply) {
        assert.equal(
          totalSupply,
          0x1,
          "total supply should be equal to minted"
        );
      });
  });

  it("Mint LGT by burning LIN", function () {
    // 20 billion LIN tokens
    var amountToTest = new web3Utils.BN("19000000000000000000000000000");
    var lgtToMint = new web3Utils.BN("1559100000000000000000000");
    return tokenInstance
      .approve(lgtAddress, amountToTest, {from: accounts[2]})
      .then(function () {
        return tokenInstance.mint(accounts[2], amountToTest);
      })
      .then(function () {
        return mintLGT(lgtInstance, tokenInstance, accounts[2], lgtToMint);
      });
  });
});

async function mintLGT(instance, tokenInstance, account, lgtToMint) {
  let linBalance = await tokenInstance.balanceOf(account, {from: account});
  let tempBG = new web3Utils.BN("100000000");
  for (let index = 0; ; index++) {
    try {
      await instance.mint(lgtToMint, {from: account});
      let _temp = await tokenInstance.balanceOf(account, {from: account});
      let diff = linBalance.sub(_temp);
      linBalance = _temp;
      console.log(_temp.toString(), "LIN remaining account-2");
      console.log(diff.mul(tempBG).div(lgtToMint).toString(), "Ratio * 1e8");
    } catch (ex) {
      break;
      // console.log(ex);
    }
  }
  return true;
}
