const ClusterDefault = artifacts.require("ClusterDefault.sol");
const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const LINProxy = artifacts.require("TokenProxy.sol");
const Pot = artifacts.require("Pot.sol");

module.exports = async function (deployer, network, accounts) {
    let admin = accounts[1];
    let relayer = accounts[7];
    
    deployer.deploy(ClusterDefault)
        .then((clusterDefaultContract) => {
            clusterDefaultContract.joinCluster({from: relayer});
            clusterDefaultContract.isRelayer(relayer).then(console.log);
        }).then(() => {
            deployer.deploy(ClusterRegistry, ClusterDefault.address, 2, 10, LINProxy.address, Pot.address)
        });
}