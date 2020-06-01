const Logic = artifacts.require("StakeLogic.sol")
const Proxy = artifacts.require("StakeProxy.sol")

module.exports = function(deployer) {
    deployer.deploy(Logic)
    .then(function(){
        return deployer.deploy(Proxy, Logic.address);
    })
};