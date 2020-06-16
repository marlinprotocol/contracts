var Web3 = require("web3");
var web3 = new Web3(Web3.givenProvider || "http://127.0.0.1:8545");

var wallet = require("ethereumjs-wallet");
var EthereumTx = require("ethereumjs-tx").Transaction;

var web3Utils = require("web3-utils");

var async = require("async");

var TokenProxy = artifacts.require("TokenProxy.sol");
var TokenLogic = artifacts.require("TokenLogic.sol");

var PaymentLogic = artifacts.require("PaymentLogic.sol");
var PaymentProxy = artifacts.require("PaymentProxy.sol");

var privKeys = [
  "1f96171059f6253675f3151bf3d515ce01041c4707770f6865862752472630ad",
  "165e3176c07267c24bf09b798fe3dad64ef3959fc4bf0cccf020e77c5ef34b8a",
  "6805b0055021aebb84cc7e1ead4fd29dcfff482b293da5d77e0ac0cb74814a9e",
  "da438135e878247d062ba0b6bc39f7f50f7b9e336b8ee10fff4c506543cf7865",
];

var offlineAddresses = privKeys.map(function (key) {
  let walletConfig = wallet.fromPrivateKey(Buffer.from(key, "hex"));
  return "0x" + walletConfig.getAddress().toString("hex");
});

contract("Payment", function (accounts) {
  var paymentInstance;
  var tokenInstance;
  var paymentAddress;
  var tokenAddress;

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

  it("deploy payment contract", function () {
    return PaymentProxy.deployed({from: accounts[1]})
      .then(function (instance) {
        return instance;
      })
      .then(function (instance) {
        return PaymentLogic.at(instance.address);
      })
      .then(function (instance) {
        paymentInstance = instance;
        paymentAddress = instance.address;
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
        return paymentInstance.initialize(tokenAddress);
      });
  });

  it("Adding Escrow by user", function () {
    return tokenInstance
      .isMinter(accounts[0])
      .then(function (isMinter) {
        assert.equal(isMinter, true, "Owner is a minter");
        return tokenInstance.mint(accounts[0], 100000);
      })
      .then(function (minted) {
        // console.log("1 MINTEd", minted.logs[0].event);
        assert.equal(
          minted.logs[0].event,
          "Transfer",
          "Tokens not minted in owner"
        );
        return tokenInstance.totalSupply();
      })
      .then(function (total) {
        assert.equal(total, 1000, "wrong Total supply after minting in owner");
        return tokenInstance.balanceOf(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 1000, "Wrong balance of owner");
        return paymentInstance.deposit(100, {from: accounts[0]});
      })
      .catch(function (res) {
        console.log("Not enough allowance");
        console.log("\\--------/");
        return tokenInstance.approve(paymentAddress, 100);
      })
      .then(function (approve) {
        assert.equal(approve.logs[0].args.owner, accounts[0], "Wrong owner");
        assert.equal(
          approve.logs[0].args.spender,
          paymentAddress,
          "Wrong Spender"
        );
        assert.equal(approve.logs[0].args.value, 100, "Wrong value");
        return tokenInstance.allowance(accounts[0], paymentAddress);
      })
      .then(function (res) {
        assert.equal(res, 100, "No equal");
        return paymentInstance.deposit(100, {from: accounts[0]});
      })
      .then(function (res) {
        assert.equal(res.logs[0].event, "Deposit", "Incorrect event");
        return tokenInstance.balanceOf(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 0x1863c, "Wrong balance of owner");
        return tokenInstance.balanceOf(paymentAddress);
      })
      .then(function (balance) {
        assert.equal(balance, 100, "Wrong balance in payment contract");
        return paymentInstance.lockedBalances(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 100, "Wrong Locked Balance");
      });
  });

  var hash;
  it("Testing unlock and sealUnlockRequest", function () {
    return paymentInstance
      .unlock(50)
      .then(function (unlocked) {
        assert.equal(
          unlocked.logs[0].event,
          "UnlockRequested",
          "Wrong Request"
        );
        hash = unlocked.logs[0].args.id;
        return paymentInstance.unlockRequests(hash);
      })
      .then(function (res) {
        assert.equal(res.sender, accounts[0], "Wrong result");
        assert.equal(res.amount.toNumber(), 50, "Wrong value result");
        return paymentInstance.sealUnlockRequest(hash);
      })
      .then(function (sealUnlock) {
        assert.equal(sealUnlock.logs[0].args.id, hash, "Wrong ID");
        assert.equal(
          sealUnlock.logs[0].event,
          "UnlockRequestSealed",
          "Wrong request"
        );
        return paymentInstance.lockedBalances(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 100, "Wrong Locked Balance");
      });
  });

  it("Testing Withdrawal", function () {
    return tokenInstance
      .balanceOf(accounts[0])
      .then(function (amount) {
        assert.equal(amount, 900, "Wrong balance in owner");
        return tokenInstance.balanceOf(paymentAddress);
      })
      .then(function (amount) {
        assert.equal(amount, 100, "Wrong balance in payment contract");
        return paymentInstance.lockedBalances(accounts[0]);
      })
      .then(function (balance) {
        assert.equal(balance, 100, "Wrong Locked Balance");
        return paymentInstance.withdraw(50);
      })
      .then(function (withdraw) {
        assert.equal(withdraw.logs[0].event, "Withdraw", "Wrong event");
        assert.equal(withdraw.logs[0].args.sender, accounts[0], "Wrong caller");
        assert.equal(withdraw.logs[0].args.amount, 50, "Incorrect amount");
        assert.equal(withdraw.logs[0].args.withdrawn, true, "Not Withdrawn");
      })
      .catch(function (res) {
        console.log(
          "ERROR IN WITHDRAW FUNCTION BECAUSE THE UNLOCK REQUEST IN NOT SEALED. Comment out lined 62-65 to make withdraw function work right now."
        );
        return tokenInstance.balanceOf(accounts[0]);
      })
      .then(function (amount) {
        assert.notEqual(amount, 950, "Wrong balance in owner"); // beacause withdrawal function didn't completed
        assert.equal(amount, 0x1863c, "Wrong balance in owner"); // beacause withdrawal function didn't completed
        return tokenInstance.balanceOf(paymentAddress);
      })
      .then(function (amount) {
        console.log("RUN");
        assert.notEqual(amount, 50, "Wrong balance in payment contract"); // beacause withdrawal function didn't completed
        assert.equal(amount, 100, "Wrong balance in payment contract"); // beacause withdrawal function didn't completed
        return;
      })
      .then(function () {
        return tokenInstance.transfer(offlineAddresses[0], 1000);
      })
      .then(function () {
        return tokenInstance.transfer(offlineAddresses[1], 1000);
      })
      .then(function () {
        return tokenInstance.transfer(offlineAddresses[2], 1000);
      })
      .then(function () {
        return tokenInstance.transfer(offlineAddresses[3], 1000);
      });
  });

  it("populate offline keys", function () {
    let toExecute = offlineAddresses.map(function (address) {
      return function (callback) {
        web3.eth.sendTransaction(
          {from: accounts[0], to: address, value: 1000000000000000000},
          function (err, data) {
            if (err) {
              callback(err, null);
            } else {
              callback(null, data);
            }
          }
        );
      };
    });

    async.series(toExecute, function (err, data) {
      if (err) {
        throw new Error("Failed populating offline keys");
      } else {
        return;
      }
    });
  });

  it("checking token balance of  offline addresses", function () {
    return tokenInstance
      .balanceOf(offlineAddresses[0])
      .then(function (balance) {
        assert.notEqual(
          balance,
          0,
          "balance should be non zero for offline address"
        );
      });
  });

  it("offline address increaseAllowance", function () {
    return increaseAllowance(privKeys[0], tokenAddress, paymentAddress)
      .then(function (response) {
        console.log(response);
        return increaseAllowance(privKeys[1], tokenAddress, paymentAddress);
      })
      .then(function (response) {
        console.log(response);
        return increaseAllowance(privKeys[2], tokenAddress, paymentAddress);
      })
      .then(function (response) {
        return increaseAllowance(privKeys[3], tokenAddress, paymentAddress);
      })
      .then(function (response) {
        console.log(response);
      });
  });

  it("lock token for offline addresses in the contract", function () {
    return depostForLock(privKeys[0], paymentAddress)
      .then(function (response) {
        console.log(response);
        return depostForLock(privKeys[1], paymentAddress);
      })
      .then(function (response) {
        console.log(response);
        return depostForLock(privKeys[2], paymentAddress);
      })
      .then(function (response) {
        return depostForLock(privKeys[3], paymentAddress);
      })
      .then(function (response) {
        console.log(response);
      });
  });

  it.skip("Testing payForWitness", function () {
    return paymentInstance
      .lockedBalances(offlineAddresses[1])
      .then(async function (amount) {
        assert.notEqual(
          amount,
          0,
          "offline address should have non-zero balance"
        );

        var witnessBytes =
          offlineAddresses[0].replace("0x", "") +
          "aaaabbbbccccdddd" +
          "0000000000000011" +
          "9999888877776666";
        var msg = Buffer.from(witnessBytes, "hex");

        var h = web3.utils.keccak256(msg);
        var data = await web3.eth.accounts.sign(h, privKeys[1]);

        var {v, r, s} = data;

        var witnessBytes_receiverSig =
          witnessBytes +
          v.replace("0x", "") +
          r.replace("0x", "") +
          s.replace("0x", "");

        // uncomment to print the generate test vector
        // console.log(witnessBytes_receiverSig)
        return paymentInstance.payForWitness
          .call("0x" + witnessBytes_receiverSig)
          .then(function (data) {
            console.log(data);
            assert(data, "true", "Payments to witness should be successful");
          });
      });
  });

  it("PayForWitness Test vector", function () {
    var balanceBeforePayment;
    var balanceAfterPayment;
    var witnessBytes =
      "0x" +
      "a8c276cf935d9ade207ba69ba262a56b5f2a9174aaaabbbbccccdddd000000000000001199998888777766661becfc1aa42c3d1105ad40eb82c62d02fd6f39f0e9287a745c6df15137728b3c940d00b1b60bfab7a5838c8fc5aba1bdca70c5b56c4e3547ca1e57f59f33fb474c";
    return paymentInstance.unlockedBalances
      .call(offlineAddresses[0])
      .then(function (data) {
        balanceBeforePayment = data;
        return;
      })
      .then(function () {
        return paymentInstance.payForWitness.call(witnessBytes);
      })
      .then(function (data) {
        assert.equal(data, true, "Payment should be possible (check via call)");
        return;
      })
      .then(function () {
        return paymentInstance.payForWitness(witnessBytes);
      })
      .then(function () {
        return paymentInstance.unlockedBalances.call(offlineAddresses[0]);
      })
      .then(function (data) {
        balanceAfterPayment = data;
        console.log(balanceBeforePayment, balanceAfterPayment);
        assert.equal(
          balanceAfterPayment > balanceBeforePayment,
          true,
          "Balance should be more"
        );
      });
  });
});

function increaseAllowance(key, tokenAddress, paymentAddress) {
  return new Promise((resolve, reject) => {
    let walletConfig = wallet.fromPrivateKey(Buffer.from(key, "hex"));
    let address = "0x" + walletConfig.getAddress().toString("hex");
    const tokenContract = new web3.eth.Contract(
      artifacts.require("TokenLogic.sol").abi,
      tokenAddress
    );

    const txData = tokenContract.methods
      .increaseAllowance(paymentAddress, 500)
      .encodeABI();

    web3.eth.getTransactionCount(address, function (err, nonce) {
      console.log("nonce offline address increaseAllowance", address, nonce);
      const gasPrice = 20000000000;
      const txParams = {
        nonce: web3Utils.numberToHex(nonce),
        gasPrice: web3Utils.numberToHex(gasPrice),
        gasLimit: web3Utils.numberToHex(500000),
        to: tokenAddress,
        data: txData,
        value: "0x00",
      };

      const privateKey = Buffer.from(key, "hex");
      const tx = new EthereumTx(txParams);
      tx.sign(privateKey);
      const serializedTx = "0x" + tx.serialize().toString("hex");
      web3.eth.sendSignedTransaction(serializedTx, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  });
}

function depostForLock(key, paymentAddress) {
  return new Promise((resolve, reject) => {
    let walletConfig = wallet.fromPrivateKey(Buffer.from(key, "hex"));
    let offlineAddress = "0x" + walletConfig.getAddress().toString("hex");

    const paymentContract = new web3.eth.Contract(
      artifacts.require("StakeLogic.sol").abi,
      paymentAddress
    );
    const txData = paymentContract.methods.deposit(500).encodeABI();

    web3.eth.getTransactionCount(offlineAddress, function (err, nonce) {
      console.log("lock token deposit contract", offlineAddress, nonce);
      const gasPrice = 20000000000;
      const txParams = {
        nonce: web3Utils.numberToHex(nonce),
        gasPrice: web3Utils.numberToHex(gasPrice),
        gasLimit: web3Utils.numberToHex(5000000),
        to: paymentAddress,
        data: txData,
      };

      const privateKey = Buffer.from(key, "hex");
      const tx = new EthereumTx(txParams);
      tx.sign(privateKey);
      const serializedTx = "0x" + tx.serialize().toString("hex");

      web3.eth.sendSignedTransaction(serializedTx, function (err, txHash) {
        if (err) {
          reject(err);
        } else {
          resolve(txHash);
        }
      });
    });
  });
}
