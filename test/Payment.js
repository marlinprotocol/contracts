var TokenProxy = artifacts.require("TokenProxy.sol");
var TokenLogic = artifacts.require("TokenLogic.sol");

var PaymentLogic = artifacts.require("PaymentLogic.sol");
var PaymentProxy = artifacts.require("PaymentProxy.sol");

contract("Payment", function (accounts) {
    var paymentInstance;
    var tokenInstance;
    var paymentAddress;
    var tokenAddress;

    it("deploy token contract", function(){
        return TokenProxy.deployed({from : accounts[1]}).then(function (instance) {
            return instance;
        }).then(function(instance){
            return TokenLogic.at(instance.address);
        }).then(function(instance){
            tokenInstance = instance;
            tokenAddress = instance.address;
            return;
        })
    })

    it("deploy payment contract", function(){
        return PaymentProxy.deployed({from : accounts[1]}).then(function (instance) {
            return instance;
        }).then(function(instance){
            return PaymentLogic.at(instance.address);
        }).then(function(instance){
            paymentInstance = instance;
            paymentAddress = instance.address;
            return;
        })
    })

    it("initialise both the contracts", function(){
        return tokenInstance.initialize("Marlin Protocol", "LIN", 18).then(function(){
            return;
        })
        .then(function(){
            return paymentInstance.initialize(tokenAddress);
        })
    })

    it("Adding Escrow by user", function () {
        return tokenInstance.isMinter(accounts[0]).then(function (isMinter) {
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
            return paymentInstance.deposit(100, { from: accounts[0] });
        }).catch(function(res){
            console.log("Not enough allowance");
            console.log("\\--------/")
            return tokenInstance.approve(paymentAddress, 100)
        }).then(function(approve){
            assert.equal(approve.logs[0].args.owner, accounts[0], "Wrong owner");
            assert.equal(approve.logs[0].args.spender, paymentAddress, "Wrong Spender");
            assert.equal(approve.logs[0].args.value, 100, "Wrong value");
            return tokenInstance.allowance(accounts[0], paymentAddress);
        }).then(function(res){
            assert.equal(res, 100, "No equal");
            return paymentInstance.deposit(100, { from: accounts[0] });
        }).then(function (res) {
            assert.equal(res.logs[0].event, 'Deposit', "Incorrect event");
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
            hash = unlocked.logs[0].args.id;
            return paymentInstance.unlockRequests(hash);
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
            console.log("ERROR IN WITHDRAW FUNCTION BECAUSE THE UNLOCK REQUEST IN NOT SEALED. Comment out lined 62-65 to make withdraw function work right now.");
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

})