const config = require("./config.json");
import { BigNumber } from "ethers";
import { ethers, network, upgrades }  from "hardhat";
import Web3 from "web3";

import { ClusterRegistry, RewardDelegators, StakeManager } from "../../typechain";

const web3 = new Web3(`https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`);

const processTransferedStash = async (data: any, stashData: any) => {
    const staker = data._staker;
    const tokenIds = data._tokenIds;
    const amounts = data._allAmounts;
    const delegatedClusters = data._delegatedClusters;

    if(!stashData[staker]) {
        stashData[staker] = {};
    }

    for(let sid = 0; sid < delegatedClusters.length; sid++) {
        const stashAmounts = amounts.slice(sid*tokenIds.length, (sid+1)*tokenIds.length);
        if(!stashData[staker][delegatedClusters[sid]]) {
            stashData[staker][delegatedClusters[sid]] = {};
        }
        for(let tid = 0; tid < tokenIds.length; tid++) {
            if(!stashData[staker][delegatedClusters[sid]][tokenIds[tid]]) {
                stashData[staker][delegatedClusters[sid]][tokenIds[tid]] = BigNumber.from(0);
            }
            stashData[staker][delegatedClusters[sid]][tokenIds[tid]] = 
                stashData[staker][delegatedClusters[sid]][tokenIds[tid]].add(BigNumber.from(stashAmounts[tid]));
        }
    }
    return stashData;
}

const getTransferedStashes = async (stakeManager: any, startBlock: number, endBlock: number) => {
    const logs = await stakeManager.queryFilter(stakeManager.filters.StashDeposit(), startBlock, endBlock);
    const txHashesUsed: any = {};
    let stashData: any = {};
    for(let i=0; i < logs.length; i++) {
        const event = logs[i];
        if(txHashesUsed[event.transactionHash]) {
            continue;
        }
        const tx = await web3.eth.getTransaction(event.transactionHash);
        try {
            const data = await stakeManager.interface.decodeFunctionData("transferL2", tx.input);
            txHashesUsed[event.transactionHash] = true;
            stashData = await processTransferedStash(data, stashData);
        } catch(err) {
            console.info(`tx with hash ${event.transactionHash} skipped as it is not transferL2`);
            txHashesUsed[event.transactionHash] = true;
            continue;
        }
    }
    return stashData;
}

const getAmountsDelegatedToGateway = async (stashData: any) => {
    const stakedToGateway: any = {};
    for(let staker in stashData) {
        const stakes = stashData[staker];
        for(let cluster in stakes) {
            if(!stakedToGateway[cluster]) {
                stakedToGateway[cluster] = {};
            }
            const stakedToCluster = stakes[cluster];
            for(let token in stakedToCluster) {
                if(!stakedToGateway[cluster][token]) {
                    stakedToGateway[cluster][token] = BigNumber.from(0);
                }
                const amount = stakedToCluster[token];
                stakedToGateway[cluster][token] = stakedToGateway[cluster][token].add(amount);
            }
        }
    }
    return stakedToGateway;
}

const checkGatewayStake = async (stakedToGateway: any, rewardDelegators: any) => {
    for(let cluster in stakedToGateway) {
        const stakedToCluster = stakedToGateway[cluster];
        for(let token in stakedToCluster) {
            let actualStake;
            try {
                actualStake = await rewardDelegators.getDelegation(cluster, config.gatewayL1, token);
            } catch(err) {
                actualStake = await rewardDelegators.getDelegation(cluster, config.gatewayL1, token);
            }
            if(!actualStake.eq(stakedToCluster[token])) {
                console.error(`expected stake for cluster ${cluster} and token ${token} is ${stakedToCluster[token].toString()}, actual is ${actualStake.toString()}`);
                process.exit();
            } else {
                console.log(`stake matches for cluster ${cluster} and token ${token} is ${stakedToCluster[token].toString()}`);
            }
        }
    }
}

const prepareStakerData = async (stakeData: any) => {
    const preparedData: any = {
        delegators: [],
        clusters: [],
        tokens: [],
        allAmounts: [],
        isDelegations: []
    };

    const token1 = "0x5802add45f8ec0a524470683e7295faacc853f97cf4a8d3ffbaaf25ce0fd87c4";
    const token2 = "0x1635815984abab0dbb9afd77984dad69c24bf3d711bc0ddb1e2d53ef2d523e5e";

    preparedData.tokens.push(token1);
    preparedData.tokens.push(token2);

    for(let staker in stakeData) {
        let stakes = stakeData[staker];
        for(let cluster in stakes) {
            let stakedToCluster = stakes[cluster];
            preparedData.delegators.push(staker);
            preparedData.clusters.push(cluster);
            preparedData.allAmounts.push(stakedToCluster[token1]);
            preparedData.allAmounts.push(stakedToCluster[token2]);
            preparedData.isDelegations.push(true);
        }
    }

    return preparedData;
}

const prepareGatewayData = async (stakedToGateway: any) => {
    const preparedData: any = {
        delegators: [],
        clusters: [],
        tokens: [],
        allAmounts: [],
        isDelegations: []
    };

    const token1 = "0x5802add45f8ec0a524470683e7295faacc853f97cf4a8d3ffbaaf25ce0fd87c4";
    const token2 = "0x1635815984abab0dbb9afd77984dad69c24bf3d711bc0ddb1e2d53ef2d523e5e";

    preparedData.tokens.push(token1);
    preparedData.tokens.push(token2);

    for(let cluster in stakedToGateway) {
        const clusterStake = stakedToGateway[cluster];
        preparedData.delegators.push(config.gatewayL1);
        preparedData.clusters.push(cluster);
        preparedData.allAmounts.push(clusterStake[token1]);
        preparedData.allAmounts.push(clusterStake[token2]);
        preparedData.isDelegations.push(false);
    }

    return preparedData;
}

const checkFixedStake = async (stashData: any, rewardDelegators: any) => {
    for(let staker in  stashData) {
        const stake = stashData[staker];
        for(let cluster in stake) {
            const stakedToCluster = stake[cluster];
            for(let token in stakedToCluster) {
                const amount = stakedToCluster[token];
                let delegation;
                try {
                    delegation = await rewardDelegators.getDelegation(cluster, staker, token);
                } catch(err) {
                    delegation = await rewardDelegators.getDelegation(cluster, staker, token);
                }
                const delegationGateway = await rewardDelegators.getDelegation(cluster, config.gatewayL1, token);
                if(!amount.eq(delegation)) {
                    console.error(`updated stake for cluster ${cluster} and token ${token} should be ${stakedToCluster[token].toString()}, actual is ${delegation.toString()}`);
                    process.exit();
                } else {
                    console.log(`stake matches for cluster ${cluster} and token ${token} is ${stakedToCluster[token].toString()}`);
                }
                if(!delegationGateway.eq(BigNumber.from(0))) {
                    console.error(`Gateway stake not reset for cluster ${cluster} and token ${token}`);
                    process.exit();
                }
            }
        }
    }
}

const fix = async () => {
    const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
    const stakeManager = StakeManagerFactory.attach(config.contracts.stakeManager);
    const RewardDelegatorsFactory = await ethers.getContractFactory("RewardDelegators");
    const rewardDelegators = RewardDelegatorsFactory.attach(config.contracts.rewardDelegators).connect(
        ethers.provider.getSigner("0x52b50644a9fef330ffc7a93d92a4b7591d5a3903")
    );
    // get all affected stashes
    const stashData = await getTransferedStashes(stakeManager, config.bug.duration.start, config.bug.duration.end);
    console.log("transfered stashes indexed");
    // get tokens supposed to be staked to gateway
    const stakedToGateway = await getAmountsDelegatedToGateway(stashData);
    console.log("processed stake to gateway per cluster");
    // verify supposed staked tokens against actual staked to gateway
    await checkGatewayStake(stakedToGateway, rewardDelegators);
    console.log("checked gateway stake with expected");
    // prepare data for removing gateway stake tx
    const gatewayTxData = await prepareGatewayData(stakedToGateway);
    console.log("data for gateway stake tx prepared");
    // send gateway tx
    const gatewayTx = await rewardDelegators.applyDiffs(
        gatewayTxData.delegators,
        gatewayTxData.clusters,
        gatewayTxData.tokens,
        gatewayTxData.allAmounts,
        gatewayTxData.isDelegations
    );
    console.log(`tx for applying gateway diffs submitted hash: ${gatewayTx.hash}`);
    // wait for success
    const gatewayTxReceipt = await gatewayTx.wait();
    console.log("tx for gateway successful", gatewayTxReceipt);
    // prepare data for adding staker stake tx
    const stakerTxData = await prepareStakerData(stashData);
    console.log("data for staker stake tx prepared");
    // send staker tx
    const stakerTx = await rewardDelegators.applyDiffs(
        stakerTxData.delegators,
        stakerTxData.clusters,
        stakerTxData.tokens,
        stakerTxData.allAmounts,
        stakerTxData.isDelegations
    );
    console.log(`tx for applying staker diffs submitted hash: ${stakerTx.hash}`);
    // wait for success
    const stakerReceipt = await stakerTx.wait();
    console.log("tx for staker successful", stakerReceipt);
    // query and verify
    await checkFixedStake(stashData, rewardDelegators);
    console.log("Upgrade successful");
}

const deploy = async () => {
    if(network.name == "hardhat") {
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x52b50644a9fef330ffc7a93d92a4b7591d5a3903"],
        });
    }

    const rewardDelegatorsFactory = await ethers.getContractFactory("RewardDelegators");
    const upgraded = await upgrades.upgradeProxy(
        config.contracts.rewardDelegators, 
        rewardDelegatorsFactory.connect(
            ethers.provider.getSigner("0x52b50644a9fef330ffc7a93d92a4b7591d5a3903")
        )
    );
    console.log("contract upgraded");
    await fix();
}

deploy();