const HelloWorld = artifacts.require('HelloWorld')

module.exports = function (deployer, network, accounts) {
    const owner = accounts[0]
    deployer.deploy(HelloWorld, { from: owner });
}
