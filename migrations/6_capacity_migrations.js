const Logic = artifacts.require("CapacityLogic.sol")
const Proxy = artifacts.require("CapacityProxy.sol")

module.exports = function(deployer) {
    deployer.deploy(Logic)
    .then(function(){
        return deployer.deploy(Proxy, Logic.address);
    }).then(function(){
        console.log("***********************************************")
        console.log(Logic.address, "CapacityLogic.address")
        console.log(Proxy.address, "CapacityProxy.address")
        console.log("***********************************************")
    })
};