var TokenProxy = artifacts.require("TokenProxy.sol");
var TokenLogic = artifacts.require("TokenLogic.sol");

var CapacityLogic = artifacts.require("CapacityLogic.sol");
var CapacityProxy = artifacts.require("CapacityProxy.sol");

contract('Capacity', function(accounts){
    var capacityInstance;
    var tokenInstance;
    var capacityAddress;
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

    it("deploy capacity contract", function(){
        return CapacityProxy.deployed({from : accounts[1]}).then(function (instance) {
            return instance;
        }).then(function(instance){
            return CapacityLogic.at(instance.address);
        }).then(function(instance){
            capacityInstance = instance;
            capacityAddress = instance.address;
            return;
        })
    })

    it("initialise both the contracts", function(){
        return tokenInstance.initialize("Marlin Protocol", "LIN", 18).then(function(){
            return;
        })
        .then(function(){
            return capacityInstance.initialize(tokenAddress);
        })
    })
})