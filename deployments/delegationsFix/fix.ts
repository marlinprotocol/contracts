const config = require("./config.json");
import { BigNumber } from "ethers";
import { ethers }  from "hardhat";
import Web3 from "web3";

import { ClusterRegistry, RewardDelegators, StakeManager } from "../../typechain";

const web3 = new Web3(`https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`);

const getStake = async (rewardDelegators: RewardDelegators, address: string) => {
    
};

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
        // const tx = await event.getTransaction();
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
            const actualStake = await rewardDelegators.getDelegation(cluster, config.gatewayL1, token);
            if(!actualStake.eq(stakedToCluster[token])) {
                console.error(`expected stake for cluster ${cluster} and token ${token} is ${stakedToCluster[token].toString()}, actual is ${actualStake.toString()}`);
                process.exit();
            } else {
                console.log(`stake matches for cluster ${cluster} and token ${token} is ${stakedToCluster[token].toString()}`);
            }
        }
    }
}

const prepareData = async (stakeData: any, stakedToGateway: any) => {
    const preparedData = {
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

const fix = async () => {
    const StakeManagerFactory = await ethers.getContractFactory("StakeManager");
    const stakeManager = StakeManagerFactory.attach(config.contracts.stakeManager);
    const RewardDelegatorsFactory = await ethers.getContractFactory("RewardDelegators");
    const rewardDelegators = RewardDelegatorsFactory.attach(config.contracts.rewardDelegators);
    // get all affected stashes
    const stashData = await getTransferedStashes(stakeManager, config.bug.duration.start, config.bug.duration.end);
    console.log("transfered stashes indexed");
    // get tokens supposed to be staked to gateway
    const stakedToGateway = await getAmountsDelegatedToGateway(stashData);
    console.log("processed stake to gateway per cluster");
    // verify supposed staked tokens against actual staked to gateway
    await checkGatewayStake(stakedToGateway, rewardDelegators);
    console.log("checked gateway stake with expected");
    // prepare data for tx
    const txData = await prepareData(stashData, stakedToGateway);
    // send tx
    const tx = await rewardDelegators.applyDiffs(
        txData.delegators,
        txData.clusters,
        txData.tokens,
        txData.allAmounts,
        txData.isDelegations
    );
    console.log(`tx for applying diffs submitted hash: ${tx.transactionHash}`);
    // wait for success
    const receipt = await tx.wait();
    console.log("receipt", receipt);
    // query and verify
    
}

fix()