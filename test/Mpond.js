const { Contract } = require("ethers");
const { it } = require("ethers/wordlists");

const mPondProxy = artifacts.require("mPondProxy.sol");
const mPondLogic = artifacts.require("mPondLogic.sol");

var mPondInstance;

contract.only("MPond Contract", function(accounts){
    it("Deploy contracts", function(){
        return mPondProxy.new(mPondLogic.address, {from: accounts[1]});
    })
})