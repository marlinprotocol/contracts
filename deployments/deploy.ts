import { Contract } from 'ethers';
import { ethers } from 'hardhat';
import { deploy as deployClusterRegistry } from './staking/ClusterRegistry';
import { deploy as deployClusterRewards } from './staking/ClusterRewards';
import { deploy as deployClusterSelector } from './staking/ClusterSelector';
import { deploy as deployReceiverStaking } from './staking/ReceiverStaking';
import { deployNoInit as deployRewardDelegators } from './staking/RewardDelegators';
import { init as initRewardDelegators } from './staking/RewardDelegatorsInit';
import { deploy as deployStakeManager } from './staking/StakeManager';

import { deploy as deployAttestationVerifier, verify as verifyAttestationVerifier } from './enclaves/AttestationVerifier';

const stakingConfig = require('./staking/config');

async function deployStaking() {
    let chainId = (await ethers.provider.getNetwork()).chainId;
    console.log("Chain Id:", chainId);

    const chainConfig = stakingConfig[chainId];

    const rewardDelegators: Contract = await deployRewardDelegators();
    const stakeManager: Contract = await deployStakeManager(rewardDelegators.address);
    const clusterRegistry: Contract = await deployClusterRegistry(rewardDelegators.address);
    const clusterSelectorMap = Object();
    for(let network in chainConfig.staking.rewardWeights) {
        const clusterSelector = await deployClusterSelector(network, rewardDelegators.address);
        clusterSelectorMap[network] = clusterSelector.address;
    }
    const receiverStaking: Contract = await deployReceiverStaking();
    const clusterRewards: Contract = await deployClusterRewards(rewardDelegators.address, receiverStaking.address, clusterSelectorMap);
    await initRewardDelegators(rewardDelegators.address, stakeManager.address, clusterRewards.address, clusterRegistry.address);
}

async function deployEnclaves() {
    // const attestationVerifier: Contract = await deployAttestationVerifier();
    await verifyAttestationVerifier();
}

deployEnclaves();
