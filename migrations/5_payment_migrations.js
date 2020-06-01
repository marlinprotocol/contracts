const Logic = artifacts.require("PaymentLogic.sol")
const Proxy = artifacts.require("PaymentProxy.sol")

module.exports = function(deployer) {
    deployer.deploy(Logic)
    .then(function(){
        return deployer.deploy(Proxy, Logic.address);
    }).then(function(){
        console.log("***********************************************")
        console.log(Logic.address, "PaymentLogic.address")
        console.log(Proxy.address, "PaymentProxy.address")
        console.log("***********************************************")
    })
};