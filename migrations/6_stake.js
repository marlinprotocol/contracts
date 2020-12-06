const Stake = artifacts.require("StakeManager.sol");
const StakeProxy = artifacts.require("StakeManagerProxy.sol");

const RewardDelegators = artifacts.require("RewardDelegators.sol");
const RewardDelegatorsProxy = artifacts.require("RewardDelegatorsProxy.sol");

const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");

const ClusterRewards = artifacts.require("ClusterRewards.sol");
const ClusterRewardsProxy = artifacts.require("ClusterRewardsProxy.sol");

module.exports = async function (deployer, network, accounts) {
    const proxyAdmin = accounts[20];

    await deployer.deploy(Stake);
    await deployer.deploy(StakeProxy, Stake.address, proxyAdmin);

    await deployer.deploy(ClusterRegistry);
    await deployer.deploy(ClusterRegistryProxy, ClusterRegistry.address, proxyAdmin);

    await deployer.deploy(RewardDelegators);
    await deployer.deploy(RewardDelegatorsProxy, RewardDelegators.address, proxyAdmin);

    await deployer.deploy(ClusterRewards);
    await deployer.deploy(ClusterRewardsProxy, ClusterRewards.address, proxyAdmin);
    return;
}