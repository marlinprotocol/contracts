const TokenLogic = artifacts.require("TokenLogic.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");

module.exports = function (deployer, network, accounts) {
    if (network == "development") {
        await deployer.deploy(TokenLogic);
        return deployer.deploy(TokenProxy, TokenLogic.address, accounts[20]);
    }
};
