import { ethers } from 'hardhat';
import { deploy, upgrade, verify } from './oyster/MarketV1';
import { upgrade as upgradeClusterRewards, verify as verifyClusterRewards } from './staking/ClusterRewards';
import { upgrade as upgradeRewardDelegators, verify as verifyRewardDelegators } from './staking/RewardDelegators';

async function run() {
    let chainId = (await ethers.provider.getNetwork()).chainId;
    console.log("Chain Id:", chainId);

    if(chainId !== 1) {
        await upgradeClusterRewards();
        await upgradeRewardDelegators();

        await verifyClusterRewards();
        await verifyRewardDelegators();
    }
}

run();