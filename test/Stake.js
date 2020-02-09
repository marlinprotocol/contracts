var Token = artifacts.require("./Token.sol");
var Stake = artifacts.require("./Stake.sol");

contract("Stake", function (accounts) {
    var stakeInstance;
    var tokenInstance;
    var stakeAddress;
    var tokenAddress;

    it("initializes contract it correct token address", function () {
        return Stake.deployed().then(function (instance) {
            stakeInstance = instance;
            return stakeInstance.address;
        }).then(function (address) {
            stakeAddress = address;
            assert.notEqual(address, 0x0, "Incorrect address");
            return stakeInstance.token();
        }).then(function (token) {
            assert.notEqual(token, 0x0, "wrong address");
        });
    });

    it("Testing Stake function", function(){
        return Token.deployed().then(function (instance) {
            tokenInstance = instance;
            return tokenInstance.mint(accounts[0], 1000);
        }).then(function (minted) {
            assert.equal(minted.logs[0].event, "Transfer", "Tokens not minted in owner");
            return stakeInstance.stake(500);
        }).then(function(staked){
            assert.equal(staked.logs[0].event, "Staking", "Wrong Event");
            assert.equal(staked.logs[0].args.Staker, accounts[0], "The address didn't stake")
            assert.equal(staked.logs[0].args.Amount, 500, "Wrong amount");
            return tokenInstance.balanceOf(accounts[0]);
        }).then(function(balance){
            assert.equal(balance, 500, "Wrong balance");
            return tokenInstance.balanceOf(stakeAddress);
        }).then(function(balance){
            assert.equal(balance, 500, "Wrong balance");
        });
            
    })

}); 