var Token = artifacts.require("./Token.sol");

contract("Token", function (accounts) {
    var tokenInstance;

    it("initializes with token", function () {
        return Token.deployed().then(function (instance) {
            tokenInstance = instance;
            return tokenInstance.name();
        }).then(function (name) {
            assert.equal(name, "Merlin Protocol", "Incorrect name");
            return tokenInstance.decimals();
        }).then(function (decimal) {
            assert.equal(decimal, 18, "Incorrect decimal");
            return tokenInstance.symbol();
        }).then(function (symbol) {
            assert.equal(symbol, "MER", "Incorrect symbol");
        });
    });

    it("Checking if deployer is minter and any other account is not a minter and then add new minter", function () {
        return Token.deployed().then(function (instance) {
            tokenInstance = instance;
            return tokenInstance.isMinter(accounts[0]);
        }).then(function (isMinter) {
            assert.equal(isMinter, true, "Owner is a minter");
            return tokenInstance.isMinter(accounts[1]);
        }).then(function (isMinter) {
            assert.equal(isMinter, false, "No other minter");
            return tokenInstance.addMinter(accounts[1]);
        }).then(function (added) {
            // console.log(added.logs);
            assert.equal(added.logs[0].event, "MinterAdded", "Minter not Added");
            return tokenInstance.isMinter(accounts[1]);
        }).then(function (isMinter) {
            assert.equal(isMinter, true, "No other minter");
            return tokenInstance.renounceMinter({ from: accounts[1] });
        }).then(function (revoked) {
            assert.equal(revoked.logs[0].event, "MinterRemoved", "Minter Not removes");
            return tokenInstance.isMinter(accounts[1]);
        }).then(function (isMinter) {
            assert.equal(isMinter, false, "No other minter");
        })
    });

    it("Minting 100 initial tokens in owner's account and 100 more in other account and check for total supply and balances then burn tokens from both accounts and check balances again", function () {
        return Token.deployed().then(function (instance) {
            tokenInstance = instance;
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
            return tokenInstance.mint(accounts[1], 100);
        }).then(function (minted) {
            assert.equal(minted.logs[0].event, "Transfer", "Tokens not minted in other");
            // console.log("2 MINTEd", minted.receipt.logs);
            // assert.equal(minted, true, "Tokens not minted");
            return tokenInstance.totalSupply();
        }).then(function (total) {
            assert.equal(total, 1100, "Wrong Total supply after minting in other");
            return tokenInstance.balanceOf(accounts[1]);
        }).then(function (balance) {
            assert.equal(balance, 100, "Wrong balance of other");
            return tokenInstance.burn(50)
        }).then(function (burned) {
            assert.equal(burned.logs[0].event, "Transfer", "Token not burned from owner");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function (balance) {
            // console.log("1 MINTEd", minted.logs[0].event);
            assert.equal(balance, 950, "Wrong balance of Owner");
            return tokenInstance.totalSupply();
        }).then(function (total) {
            assert.equal(total, 1050, "Wrong Total supply after burning from owner");
        });
    });


    it("checking approve, decreaseAllowance, increaseAllowance, burnFrom functions", function () {
        return Token.deployed().then(function (instance) {
            tokenInstance = instance;
            return tokenInstance.approve(accounts[1], 450);
        }).then(function (approve) {
            assert.equal(approve.logs[0].event, "Approval", "Not approved");
            return tokenInstance.allowance(accounts[0], accounts[1]);
        }).then(function (allow) {
            assert.equal(allow, 450, "Incorrect allowance in first approve");
            return tokenInstance.decreaseAllowance(accounts[1], 50);
        }).then(function (approve) {
            assert.equal(approve.logs[0].event, "Approval", "Allowance not decreased");
            return tokenInstance.allowance(accounts[0], accounts[1]);
        }).then(function (allow) {
            assert.equal(allow, 400, "Incorrect allowance after decrease");
            return tokenInstance.increaseAllowance(accounts[1], 50);
        }).then(function (approve) {
            assert.equal(approve.logs[0].event, "Approval", "Allowance not increased");
            return tokenInstance.allowance(accounts[0], accounts[1]);
        }).then(function (allow) {
            assert.equal(allow, 450, "Incorrect allowance after increase");
            return tokenInstance.burnFrom(accounts[0], 50, {from: accounts[1]});
        }).then(function(burned){
            assert.equal(burned.logs[0].event, "Transfer", "Error while transferring");
            assert.equal(burned.logs[1].event, "Approval", "Error while approving");
            return tokenInstance.allowance(accounts[0], accounts[1]);
        }).then(function (allow) {
            assert.equal(allow, 400, "Incorrect allowance after burning");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function (balance) {
            assert.equal(balance, 900, "Wrong balance of Owner after burning from");
            return tokenInstance.totalSupply();
        }).then(function (total) {
            assert.equal(total, 1000, "Wrong Total supply after burning from owner by other");
        });
    });

      it("transfer and transferFrom", function() {
        return Token.deployed().then(function(instance) {
          tokenInstance = instance;
          return tokenInstance.transfer(accounts[2], 200)
        }).then(function(send) {
            assert.equal(send.logs[0].event, "Transfer", "Error while transfer");
            return tokenInstance.balanceOf(accounts[2]);
        }).then(function(balance){
            assert.equal(balance, 200, "Wrong balance of receiver after transfer");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function(balance){
            assert.equal(balance, 700, "Wrong balance of sender after transfer");
            return tokenInstance.transferFrom(accounts[0], accounts[2], 200, {from: accounts[1]});
        }).then(function(transfer) {
            assert.equal(transfer.logs[0].event, "Transfer", "Error while transferFrom");
            assert.equal(transfer.logs[1].event, "Approval", "Error while approving");
            return tokenInstance.balanceOf(accounts[2]);
        }).then(function(balance){
            assert.equal(balance, 400, "Wrong balance of receiver after transferFrom");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function(balance){
            assert.equal(balance, 500, "Wrong balance of sender after transferFrom");
            return tokenInstance.allowance(accounts[0], accounts[1]);
        }).then(function (allow) {
            assert.equal(allow, 200, "Incorrect allowance after transferFrom");
        });
      });

});
