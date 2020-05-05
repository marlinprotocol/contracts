const ProxyC = artifacts.require("Proxy.sol")
const Logic = artifacts.require("Logic.sol")
const Logic2 = artifacts.require("Logic2.sol")

const initValue = 50;

var LogicContract;
var LogicContract2;
var ProxyContract;

contract("Capacity", function (accounts) {
    it("Deploy Logic Contract", function(){
        return Logic.deployed().then(function(instance){
            LogicContract = instance;
            return instance;
        })
    })
    it("Deploy Logic2 Contract", function(){
        return Logic2.deployed().then(function(instance){
            LogicContract2 = instance;
            return instance;
        })
    })
    it("Deploy Proxy Contract", function(){
        return ProxyC.deployed(LogicContract.address).then(function(instance){
            ProxyContract = instance;
            return ProxyContract.address
        })
    })
    it("Init value via proxy contract", function(){
        let tempProxy = Object.assign({}, LogicContract);
        tempProxy.address = ProxyContract.address;
        return tempProxy.initialize(initValue);
    })
    it("Check value via proxy and logic contract", async function(){
        let tempProxy = Object.assign({}, LogicContract);
        tempProxy.address = ProxyContract.address;

        let value_via_proxy = await tempProxy.get.call();
        let value_via_logic = await LogicContract.get.call();

        console.log(tempProxy.address, "fetch value via proxy",value_via_proxy.toNumber());
        console.log(LogicContract.address,"fetch value via logic" ,value_via_logic.toNumber());
    })
    it("update logic contract address in proxy", function(){
        return ProxyContract.updateLogic(LogicContract2.address);
    })
    it("Check value via proxy and logic contract after updating the logic", async function(){
        let tempProxy = Object.assign({}, LogicContract);
        tempProxy.address = ProxyContract.address;

        let value_via_proxy = await tempProxy.get.call();
        let value_via_logic = await LogicContract.get.call();

        console.log(tempProxy.address, "fetch value via proxy",value_via_proxy.toNumber());
        console.log(LogicContract.address,"fetch value via logic" ,value_via_logic.toNumber());
    })
})