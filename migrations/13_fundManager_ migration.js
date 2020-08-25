let FundManager = artifacts.require("FundManager.sol");
let LINProxy = artifacts.require("TokenProxy.sol");

module.exports = async function (deployer, network, accounts) {
    let governanceProxy = accounts[6];

    deployer.deploy(FundManger, LINProxy.address, governanceProxy);
}