const Logic = artifacts.require("Logic.sol")
const ProxyC = artifacts.require("Proxy.sol")

const Logic2 = artifacts.require("Logic2.sol")

module.exports = function(deployer) {
    deployer.deploy(Logic)
    .then(function(){
        return deployer.deploy(ProxyC, Logic.address);
    }).then(function(){
        return deployer.deploy(Logic2);
    });
};