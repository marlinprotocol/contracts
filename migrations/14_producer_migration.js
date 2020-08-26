let Producer = artifacts.require("Producer.sol");

module.exports = async function (deployer, network, accounts) {
    deployer.deploy(Producer);
}