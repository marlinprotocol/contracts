const fs = require('fs');

const Stake = require("../../../../build/contracts/StakeManager.json");
const StakeProxy = require("../../../../build/contracts/StakeManagerProxy.json");

const RewardDelegators = require("../../../../build/contracts/RewardDelegators.json");
const RewardDelegatorsProxy = require("../../../../build/contracts/RewardDelegatorsProxy.json");

const ClusterRegistry = require("../../../../build/contracts/ClusterRegistry.json");
const ClusterRegistryProxy = require("../../../../build/contracts/ClusterRegistryProxy.json");

const ClusterRewards = require("../../../../build/contracts/ClusterRewards.json");
const ClusterRewardsProxy = require("../../../../build/contracts/ClusterRewardsProxy.json");

const utils = require("../utils");

const config = require("../config/config.json");

const deployedAddressesPath = "./config/deployedAddresses.json";

const deployStakingManager = async (web3, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    if(deployedAddresses[network]['stakeManager'] != "") {
        return (new web3.eth.Contract(Stake.abi, deployedAddresses[network]['stakeManager']));
    }
    const stakeContract = await utils.contract.deployWithProxyAndAdmin(
        web3,
        Stake.abi, 
        Stake.bytecode, 
        StakeProxy.abi, 
        StakeProxy.bytecode, 
        config[network].staking.stakeManager.proxyAdmin,
        {
            from: config[network].staking.stakeManager.deployer,
            gas: 5000000
        }
    );
    await utils.common.updateEntry(deployedAddressesPath, network, "stakeManager", stakeContract.options.address);
    return stakeContract;
}

const initStakingManager = async (stakeContract, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    const tokensIds = [];
    const addresses = [];

    const stakeManagerConfig = config[network].staking.stakeManager;

    for(let i=0; i < stakeManagerConfig.enabledTokens.length; i++) {
        const token = stakeManagerConfig.enabledTokens[i];
        tokensIds.push(config[network].tokens[token].id);
        addresses.push(deployedAddresses[network][token]);
    }

    await stakeContract.methods.initialize(
        tokensIds,
        addresses,
        deployedAddresses[network]['mpond'], 
        deployedAddresses[network]['clusterRegistry'],
        deployedAddresses[network]['rewardDelegators'],
        stakeManagerConfig.admin
    ).send({
        from: stakeManagerConfig.deployer,
        gas: 500000
    });

    for(let lock in stakeManagerConfig.locks) {
        await stakeContract.methods.updateLockWaitTime(
            stakeManagerConfig.locks[lock].id, 
            stakeManagerConfig.locks[lock].delay
        ).send({
            from: stakeManagerConfig.admin,
            gas: 500000
        });
    }
}

const deployRewardDelegators = async (web3, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    if(deployedAddresses[network]['rewardDelegators'] != "") {
        return (new web3.eth.Contract(RewardDelegators.abi, deployedAddresses[network]['rewardDelegators']));
    }
    const rewardDelegatorsContract = await utils.contract.deployWithProxyAndAdmin(
        web3,
        RewardDelegators.abi, 
        RewardDelegators.bytecode, 
        RewardDelegatorsProxy.abi, 
        RewardDelegatorsProxy.bytecode, 
        config[network].staking.rewardDelegators.proxyAdmin,
        {
            from: config[network].staking.rewardDelegators.deployer,
            gas: 5000000
        }
    );
    await utils.common.updateEntry(deployedAddressesPath, network, "rewardDelegators", rewardDelegatorsContract.options.address);
    return rewardDelegatorsContract;
}

const initRewardDelegators = async (rewardDelegators, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    const rewardDelegatorsConfig = config[network].staking.rewardDelegators;
    const tokenIds = [];
    const rewardFactors = [];
    const rewardsConfig = rewardDelegatorsConfig.rewards;
    for(let rewardToken in rewardsConfig.factor) {
        if(rewardsConfig.factor[rewardToken] != 0) {
            tokenIds.push(config[network].tokens[rewardToken].id);
            rewardFactors.push(rewardsConfig.factor[rewardToken]);
        }
    }

    await rewardDelegators.methods.initialize(
        rewardDelegatorsConfig.undelegationWaitTime,
        deployedAddresses[network].stakeManager,
        deployedAddresses[network].clusterRewards,
        deployedAddresses[network].clusterRegistry,
        rewardDelegatorsConfig.admin, 
        rewardDelegatorsConfig.threshold.balance,
        deployedAddresses[network][rewardDelegatorsConfig.threshold.token],
        deployedAddresses[network].pond,
        tokenIds,
        rewardFactors
    ).send({
        from: rewardDelegatorsConfig.deployer,
        gas: 5000000
    });
}

const deployClusterRegistry = async (web3, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    if(deployedAddresses[network]['clusterRegistry'] != "") {
        return (new web3.eth.Contract(ClusterRewards.abi, deployedAddresses[network]['clusterRegistry']));
    }
    const clusterRegistryContract = await utils.contract.deployWithProxyAndAdmin(
        web3,
        ClusterRegistry.abi, 
        ClusterRegistry.bytecode, 
        ClusterRegistryProxy.abi, 
        ClusterRegistryProxy.bytecode, 
        config[network].staking.clusterRegistry.proxyAdmin,
        {
            from: config[network].staking.clusterRegistry.deployer,
            gas: 3000000
        }
    );
    await utils.common.updateEntry(deployedAddressesPath, network, "clusterRegistry", clusterRegistryContract.options.address);
    return clusterRegistryContract;
}

const initClusterRegistry = async (clusterRegistry, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    const lockIds = [];
    const delays = [];
    const locks = config[network].staking.clusterRegistry.locks;
    for(let lock in locks) {
        if(locks[lock].delay != 0) {
            lockIds.push(locks[lock].id);
            delays.push(locks[lock].delay);
        }
    }
    await clusterRegistry.methods.initialize(
        lockIds,
        delays,
        config[network].staking.clusterRegistry.admin
    ).send({
        from: config[network].staking.rewardDelegators.deployer,
        gas: 500000
    });
}

const deployClusterRewards = async (web3, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    if(deployedAddresses[network].clusterRewards != "") {
        return (new web3.eth.Contract(ClusterRewards.abi, deployedAddresses[network].clusterRewards));
    }
    const clusterRewardsContract = await utils.contract.deployWithProxyAndAdmin(
        web3,
        ClusterRewards.abi, 
        ClusterRewards.bytecode, 
        ClusterRewardsProxy.abi, 
        ClusterRewardsProxy.bytecode, 
        config[network].staking.clusterRewards.proxyAdmin,
        {
            from: config[network].staking.clusterRewards.deployer,
            gas: 5000000
        }
    );
    await utils.common.updateEntry(deployedAddressesPath, network, "clusterRewards", clusterRewardsContract.options.address);
    return clusterRewardsContract;
}

const initClusterRewards = async (clusterRewards, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    const networkIds = [];
    const rewardWeights = [];
    const clusterRewardsConfig = config[network].staking.clusterRewards;
    for(let rewardNetwork in clusterRewardsConfig.rewards.weights) {
        networkIds.push(clusterRewardsConfig.rewards.weights[rewardNetwork].id);
        rewardWeights.push(clusterRewardsConfig.rewards.weights[rewardNetwork].weight);
    }
    await clusterRewards.methods.initialize(
        clusterRewardsConfig.admin,
        deployedAddresses[network].rewardDelegators,
        networkIds,
        rewardWeights,
        clusterRewardsConfig.rewards.amountPerEpoch,
        deployedAddresses[network].pond, 
        clusterRewardsConfig.rewards.denomination,
        clusterRewardsConfig.feeder,
        clusterRewardsConfig.rewards.minDelay
    ).send({
        from: clusterRewardsConfig.deployer,
        gas: 500000
    });
}

module.exports = {
    deploy: {
        stakingManager: deployStakingManager,
        rewardDelegators: deployRewardDelegators,
        clusterRegistry: deployClusterRegistry,
        clusterRewards: deployClusterRewards
    },
    init: {
        stakingManager: initStakingManager,
        rewardDelegators: initRewardDelegators,
        clusterRegistry: initClusterRegistry,
        clusterRewards: initClusterRewards
    }
}