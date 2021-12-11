const Web3 = require('web3');
const config = require("./config/config.json");

const staking = require("./init/staking");
const tokens = require("./init/tokens");
const interact = require("./interact");
const utils = require("./utils");

const deploy = async (network) => {
    const web3 = new Web3(config[network].url);

    await utils.common.loadAccounts(web3, network);

    const POND = await tokens.deploy.pond(web3, network);
    console.log("POND deployed", POND.options.address);
    // await tokens.init.pond(POND, network);
    console.log("POND initialized");
    const MPOND = await tokens.deploy.mpond(web3, network);
    console.log("MPOND deployed");
    // await tokens.init.mpond(MPOND, network);
    console.log("MPOND initialized");

    const StakeManager = await staking.deploy.stakingManager(web3, network);
    console.log("stake manager deployed");
    const RewardDelegators = await staking.deploy.rewardDelegators(web3, network);
    console.log("reward delegators deployed");
    const ClusterRegistry = await staking.deploy.clusterRegistry(web3, network);
    console.log("cluster registry deployed");
    const ClusterRewards = await staking.deploy.clusterRewards(web3, network);
    console.log("cluster rewards deployed");

    await staking.init.stakingManager(StakeManager, network);
    console.log("staking manager initialized");
    await staking.init.clusterRegistry(ClusterRegistry, network);
    console.log("cluster registry initialized");
    await staking.init.rewardDelegators(RewardDelegators, network);
    console.log("reward delegators initialized");
    await staking.init.clusterRewards(ClusterRewards, network);
    console.log("cluster rewards initialized");

    await interact.mpond.whitelist(MPOND, network, StakeManager.options.address);
    console.log("stakemanager whitelisted in mpond");
    // const balance = await interact.pond.balanceOf(POND, config[network].tokens.pond.holder)
    // console.log(web3.utils.fromWei(balance+""))
    // await interact.pond.fundAccount(POND, network, ClusterRewards.options.address, web3.utils.toWei("1000000"));

    const addresses = {
        POND: POND.options.address,
        MPOND: MPOND.options.address,
        StakeManager: StakeManager.options.address,
        RewardDelegators: RewardDelegators.options.address,
        ClusterRegistry: ClusterRegistry.options.address,
        ClusterRewards: ClusterRewards.options.address
    };

    console.table(addresses);
}

deploy("rinkeby");