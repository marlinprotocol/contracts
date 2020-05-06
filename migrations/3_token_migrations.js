const TokenLogic = artifacts.require("TokenLogic.sol")
const TokenProxy = artifacts.require("TokenProxy.sol")

module.exports = function(deployer) {
    deployer.deploy(TokenLogic)
    .then(function(){
        return deployer.deploy(TokenProxy, TokenLogic.address);
    })
};