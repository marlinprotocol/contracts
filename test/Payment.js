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
})