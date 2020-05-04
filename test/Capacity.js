const ProxyC = artifacts.require("Proxy.sol")
const Logic = artifacts.require("Logic.sol")

const initValue = 50;

var LogicContract;
var ProxyWithABI;
var ProxyContract;
contract("Capacity", function (accounts) {
    it('Deploy Logic Contract', function(){
        return Logic.deployed().then(function(instance){
            LogicContract = instance;
        })
    })
    it('Deploy Proxy Contract', function(){
        return ProxyC.deployed(LogicContract.address).then(function(instance){
            ProxyContract = instance;
            ProxyWithABI = Object.assign({}, LogicContract);
            ProxyWithABI.address = ProxyContract.address
        }).then(function(){
            assert.equal(ProxyWithABI.address, ProxyContract.address, "Proxy Contract is has ABIs required")
            console.log(ProxyWithABI);
            return ProxyWithABI.initialize(initValue)
        })
    })
    it('Proxy Delegation Test', async function(){
        let value = await ProxyWithABI.x.call();
        // assert.equal(value.toNumber(), initValue, "State in logic accessible via proxy");
        let value2 = await LogicContract.x.call();
        console.log(ProxyWithABI.address, LogicContract.address);
        console.log(value.toNumber(), value2.toNumber());
        // assert.notEqual(value2.toNumber(), initValue, "Logic Contract should not have this state");
    
    })
})