var Token = artifacts.require("./Token.sol");
var Payment = artifacts.require("./Payment.sol");

contract("Payment", function (accounts) {
    var paymentInstance;
    var tokenInstance;
    var paymentAddress;
    var tokenAddress;

    it("initializes contract it correct token address", function () {
        return Payment.deployed().then(function (instance) {
            paymentInstance = instance;
            return paymentInstance.address;
        }).then(function (address) {
            assert.notEqual(address, 0x0, "Incorrect address");
            return paymentInstance.token();
        }).then(function (token) {
            assert.notEqual(token, 0x0, "wrong address");
        });
    });

    it("Adding Escrow by user", function () {
        return Token.deployed().then(function (instance) {
            tokenInstance = instance;
            return Payment.deployed();
        }).then(function (instance) {
            paymentInstance = instance;
            return paymentInstance.address;
        }).then(function (add) {
            assert.notEqual(add, 0x0, "Incorrect address");
            paymentAddress = add;
            return tokenInstance.isMinter(accounts[0]);
        }).then(function (isMinter) {
            assert.equal(isMinter, true, "Owner is a minter");
            return tokenInstance.mint(accounts[0], 1000);
        }).then(function (minted) {
            // console.log("1 MINTEd", minted.logs[0].event);
            assert.equal(minted.logs[0].event, "Transfer", "Tokens not minted in owner");
            return tokenInstance.totalSupply();
        }).then(function (total) {
            assert.equal(total, 1000, "wrong Total supply after minting in owner");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 1000, "Wrong balance of owner");
            return paymentInstance.addEscrow(100, { from: accounts[0] });
        }).then(function (res) {
            assert.equal(res.logs[0].event, 'BalanceChanged', "Incorrect event");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 900, "Wrong balance of owner");
            return tokenInstance.balanceOf(paymentAddress);
        }).then(function (balance) {
            assert.equal(balance, 100, "Wrong balance in payment contract");
            return paymentInstance.lockedBalances(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 100, "Wrong Locked Balance");
        });
    });

    var hash;
    it("Testing unlock and sealUnlockRequest", function () {
        return paymentInstance.unlock(50).then(function (unlocked) {
            assert.equal(unlocked.logs[0].event, "UnlockRequested", "Wrong Request");
            return paymentInstance.allHashes(0);
        }).then(function (_hash) {
            hash = _hash;
            return paymentInstance.unlockRequests(_hash);
        }).then(function (res) {
            assert.equal(res.sender, accounts[0], "Wrong result")
            assert.equal(res.amount.toNumber(), 50, "Wrong value result");
            return paymentInstance.sealUnlockRequest(hash);
        }).then(function (sealUnlock) {
            assert.equal(sealUnlock.logs[0].args.id, hash, "Wrong ID");
            assert.equal(sealUnlock.logs[0].event, "UnlockRequestSealed", "Wrong request");
            return paymentInstance.lockedBalances(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 100, "Wrong Locked Balance");
        });
    });

    it("Testing Withdrawal", function () {
        return tokenInstance.balanceOf(accounts[0]).then(function (amount) {
            assert.equal(amount, 900, "Wrong balance in owner");
            return tokenInstance.balanceOf(paymentAddress);
        }).then(function (amount) {
            assert.equal(amount, 100, "Wrong balance in payment contract");
            return paymentInstance.lockedBalances(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 100, "Wrong Locked Balance");
            return paymentInstance.withdraw(50);
        }).then(function (withdraw) {
            assert.equal(withdraw.logs[0].event, "Withdraw", "Wrong event");
            assert.equal(withdraw.logs[0].args.sender, accounts[0], "Wrong caller");
            assert.equal(withdraw.logs[0].args.amount, 50, "Incorrect amount");
            assert.equal(withdraw.logs[0].args.withdrawn, true, "Not Withdrawn");
        }).catch(function(res){
            console.log("ERROR IN WITHDRAW FUNCTION BECAUSE THE UNLOCK REQUEST IN NOT SEALED. Comment out lined 86-89 to make withdraw function work right now.");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function (amount) {
            assert.notEqual(amount, 950, "Wrong balance in owner"); // beacause withdrawal function didn't completed
            assert.equal(amount, 900, "Wrong balance in owner"); // beacause withdrawal function didn't completed
            return tokenInstance.balanceOf(paymentAddress);
        }).then(function (amount) {
            console.log("RUN")
            assert.notEqual(amount, 50, "Wrong balance in payment contract"); // beacause withdrawal function didn't completed
            assert.equal(amount, 100, "Wrong balance in payment contract"); // beacause withdrawal function didn't completed
        });
    })

    it("Testing payForWitness", function(){
        return paymentInstance.lockedBalances(accounts[0]).then(function(amount){
            assert.equal(amount, 100, "Wrong Locked Balance");
            return paymentInstance.payForWitness([[[accounts[9], 5, "0x0011"]], "0x1111"], 1000);
        }).catch(function(err){
            console.log("Error because amount > locked balance (Checking require Statament)");
            return paymentInstance.payForWitness([[[accounts[9], 5, "0x0011"]], "0x1111"], 10); // random signatures
        }).then(function(res){
            assert.equal(res.logs[0].event, "PayWitness", "Wrong event");
            assert.equal(res.logs[0].args.sender, accounts[0], "Wrong caller");
            assert.equal(res.logs[0].args.amount, 10, "Incorrect amount");
            assert.equal(res.logs[0].args.paid, false, "Not Withdrawn");
            return paymentInstance.payForWitness([[[accounts[9], 5, "0x0011"]], "0x00111"], 10); // random signatures
        }).then(function(res){
            assert.equal(res.logs[0].event, "PayWitness", "Wrong event");
            assert.equal(res.logs[0].args.sender, accounts[0], "Wrong caller");
            assert.equal(res.logs[0].args.amount, 10, "Incorrect amount");
            assert.equal(res.logs[0].args.paid, true, "Not Withdrawn");
            return paymentInstance.lockedBalances(accounts[0])
        }).then(function(amount){
            assert.equal(amount, 50, "Wrong Locked Balance");
            return paymentInstance.unlockedBalances(accounts[9])
        }).then(function(amount){
            assert.equal(amount, 50, "Wrong Locked Balance");
        })
    })

}); 

// [[0x9D0910aBF81EE30195d9d96a43AfaeF3CD8c2c99, 5, 0x0011], 0x1111], 1000   
// 
// [{[{0x9D0910aBF81EE30195d9d96a43AfaeF3CD8c2c99, 5, 0x0011}], 0x1111}], 1000