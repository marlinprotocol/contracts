var Token = artifacts.require("./Token.sol");
var Payment = artifacts.require("./Payment.sol");
var Stake = artifacts.require("./Stake.sol");

contract("Payment", function (accounts) {
    var paymentInstance;
    var tokenInstance;
    var paymentAddress;
    var stakeAddress;
    var stakeInstance;
    var tokenAddress;

    it("initializes Stake contract with correct token address and payment contract with correct Stake Address", function () {
        return Token.deployed().then(function (instance) {
            tokenInstance = instance;
            return Stake.deployed()
        }).then(function (instance) {
            stakeInstance = instance;
            return stakeInstance.address;
        }).then(function (address) {
            console.log(address);
            stakeAddress = address;
            assert.notEqual(address, 0x0, "Incorrect address");
            return stakeInstance.token();
        }).then(function (address) {
            console.log(address);
            tokenAddress = address;
            assert.notEqual(address, 0x0, "Incorrect address");
            return Payment.deployed();
        }).then(function (instance) {
            paymentInstance = instance;
            return paymentInstance.address;
        }).then(function (address) {
            console.log(address);
            paymentAddress = address;
            assert.notEqual(address, 0x0, "Incorrect address");
            return paymentInstance.stake();
        }).then(function (stake) {
            assert.equal(stake, stakeAddress, "wrong address");
        });
    });

    it("minting tokens for test", function () {
        return tokenInstance.mint(accounts[0], 1000).then(function (amount) {
            assert.equal(amount.logs[0].event, "Transfer", "Tokens not minted in owner");
        })
    })

    it("Adding Escrow by user ", function () {
        return paymentInstance.addEscrow(100, { from: accounts[0] }).then(function (res) {
            assert.equal(res.logs[0].event, 'BalanceChanged', "Incorrect event");
            return tokenInstance.balanceOf(accounts[0]);
        }).catch(function (res) {
            console.log("Error in stake.setLockedBalance because the payment contract is currently not a valid contract. A valid contract is a contract which is allowed to use function of stake contract to transfer funds.")
            return stakeInstance.addContract(paymentAddress);
        }).then(function (cont) {
            assert.equal(cont.logs[0].event, "ContractAdded", "No contract Added");
            assert.equal(cont.logs[0].args.Contract, paymentAddress, "Wrong Contract Added")
            return paymentInstance.addEscrow(100, { from: accounts[0] });
        }).then(function (res) {
            assert.equal(res.logs[0].event, 'BalanceChanged', "Incorrect event");
            return stakeInstance.checkBalance(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 900, "Incorrect balance of user after escrow");
            return stakeInstance.checkBalance(stakeAddress);
        }).then(function (balance) {
            assert.equal(balance, 100, "Incorrect balance of stake contract after escrow");
            return stakeInstance.checkBalance(paymentAddress);
        }).then(function (balance) {
            assert.equal(balance, 0, "Incorrect balance of payment contract after escrow");
            return stakeInstance.getLockedBalance(accounts[0]);
        }).then(function (locked) {
            assert.equal(locked, 100, "Wrong locked balance");
        })
    });

    var hash;
    it("Testing unlock and sealUnlockRequest", function () {
        return paymentInstance.unlock(50).then(function (unlocked) {
            assert.equal(unlocked.logs[0].event, "UnlockRequested", "Wrong Request");
            return paymentInstance.allHashes(0);
        }).then(function (_hash) {
            hash = _hash;
            return stakeInstance.getUnlockRequests(_hash);
        }).then(function (res) {
            assert.equal(res.sender, accounts[0], "Wrong result")
            assert.equal(res.amount.toNumber(), 50, "Wrong value result");
            return paymentInstance.sealUnlockRequest(hash);
        }).then(function (sealUnlock) {
            assert.equal(sealUnlock.logs[0].args.id, hash, "Wrong ID");
            assert.equal(sealUnlock.logs[0].args.changed, false, "Wrong ID");
            assert.equal(sealUnlock.logs[0].event, "UnlockRequestSealed", "Wrong request");
            return stakeInstance.getLockedBalance(accounts[0]);
        }).then(function (balance) {
            console.log("unlockRequest is not sealed because the timestamp condition is not satisfied and thus returns false")
            assert.equal(balance, 100, "Wrong Locked Balance");
        });
    });

    it("Testing Withdrawal", function () {
        return stakeInstance.checkBalance(accounts[0]).then(function (amount) {
            assert.equal(amount, 900, "Wrong balance in owner");
            return stakeInstance.checkBalance(paymentAddress);
        }).then(function (amount) {
            assert.equal(amount, 0, "Wrong balance in payment contract");
            return stakeInstance.checkBalance(stakeAddress);
        }).then(function (amount) {
            assert.equal(amount, 100, "Wrong balance in stake contract");
            return stakeInstance.getLockedBalance(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 100, "Wrong Locked Balance");
            return paymentInstance.withdraw(50);
        }).then(function (withdraw) {
            assert.equal(withdraw.logs[0].event, "Withdraw", "Wrong event");
            assert.equal(withdraw.logs[0].args.sender, accounts[0], "Wrong caller");
            assert.equal(withdraw.logs[0].args.amount, 50, "Incorrect amount");
            assert.equal(withdraw.logs[0].args.withdrawn, true, "Not Withdrawn");
        }).catch(function (res) {
            console.log("ERROR IN WITHDRAW FUNCTION BECAUSE THE UNLOCK REQUEST IN NOT SEALED. Comment out lined 71-74 to make withdraw function work right now.");
            return stakeInstance.checkBalance(accounts[0]);
        }).then(function (amount) {
            assert.notEqual(amount, 950, "Wrong balance in owner"); // beacause withdrawal function didn't completed
            assert.equal(amount, 900, "Wrong balance in owner"); // beacause withdrawal function didn't completed
            return stakeInstance.checkBalance(stakeAddress);
        }).then(function (amount) {
            console.log("RUN")
            assert.notEqual(amount, 50, "Wrong balance in payment contract"); // beacause withdrawal function didn't completed
            assert.equal(amount, 100, "Wrong balance in payment contract"); // beacause withdrawal function didn't completed
        });
    })

    it("Testing payForWitness", function () {
        return stakeInstance.getLockedBalance(accounts[0]).then(function (amount) {
            assert.equal(amount, 100, "Wrong Locked Balance");
            return paymentInstance.payForWitness([[[accounts[9], 5, "0x0011"]], "0x1111"], 1000);
        }).catch(function (err) {
            console.log("Error because amount > locked balance (Checking require Statament)");
            return paymentInstance.payForWitness([[[accounts[9], 5, "0x0011"]], "0x1111"], 10); // random signatures
        }).then(function (res) {
            assert.equal(res.logs[0].event, "PayWitness", "Wrong event");
            assert.equal(res.logs[0].args.sender, accounts[0], "Wrong caller");
            assert.equal(res.logs[0].args.amount, 10, "Incorrect amount");
            assert.equal(res.logs[0].args.paid, false, "Not Withdrawn");
            return paymentInstance.payForWitness([[[accounts[9], 5, "0x0011"]], "0x00111"], 10); // random signatures
        }).then(function (res) {
            assert.equal(res.logs[0].event, "PayWitness", "Wrong event");
            assert.equal(res.logs[0].args.sender, accounts[0], "Wrong caller");
            assert.equal(res.logs[0].args.amount, 10, "Incorrect amount");
            assert.equal(res.logs[0].args.paid, true, "Not Withdrawn");
            return stakeInstance.getLockedBalance(accounts[0])
        }).then(function (amount) {
            assert.equal(amount, 50, "Wrong Locked Balance");
            return stakeInstance.getUnlockedBalance(accounts[9])
        }).then(function (amount) {
            assert.equal(amount, 50, "Wrong Locked Balance");
        })
    })

});

// [[0x9D0910aBF81EE30195d9d96a43AfaeF3CD8c2c99, 5, 0x0011], 0x1111], 1000   
// 
// [{[{0x9D0910aBF81EE30195d9d96a43AfaeF3CD8c2c99, 5, 0x0011}], 0x1111}], 1000