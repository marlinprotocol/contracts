import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber as BN, Signer, Contract } from 'ethers';
import exp from 'constants';
import { Sign, sign } from 'crypto';
import cluster, { Address } from 'cluster';
const appConfig = require("../app-config");

declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}

describe('ClusterRegistry Deployment', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistryInstance: Contract;
  let pondInstance: Contract;
  let mpondInstance: Contract;
  let rewardDelegatorsInstance: Contract;
  let clusterRewardsInstance: Contract;
  let stakeManagerInstance: Contract;
  const COMMISSION_LOCK = "0x7877e81172e1242eb265a9ff5a14c913d44197a6e15e0bc1d984f40be9096403";
  const SWITCH_NETWORK_LOCK = "0x18981a75d138782f14f3fbd4153783a0dc1558f28dc5538bf045e7de84cb2ae2";
  const UNREGISTER_LOCK = "0x027b176aae0bed270786878cbabc238973eac20b1957aae44b82a73cc8c7080c";
  const MPOND_HASH = ethers.utils.id("MPOND");
  let pondTokenId: string;
  let mpondTokenId: string;
  let admin: Signer;
  let bridge: string;
  let registeredCluster: Signer;
  let registeredCluster1: Signer;
  let unregisteredCluster: Signer;
  let updatedRewardAddress: string;
  let updatedClientKey: string;
  let rewardDelegatorsOwner: string;
  let clusterRewardsOwner: Signer;
  let feeder: Signer;
  let stakeManagerOwner: string;
  let clusterRegistryOwner: string;
  let registeredClusterRewardAddress: string;
  let clientKey1: string;
  let delegator: Signer;
  let mpondAccount: Signer;
  let clientKey2: string;
  let registeredClusterRewardAddress1: string;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    mpondAccount = signers[2];
    delegator = signers[3];
    clusterRegistryOwner = addrs[4];
    admin = signers[5];
    bridge = addrs[6];
    registeredCluster = signers[7];
    registeredCluster1 = signers[8];
    unregisteredCluster = signers[9];
    updatedRewardAddress = addrs[10];
    updatedClientKey = addrs[11];
    clusterRewardsOwner = signers[12];
    feeder = signers[13];
    rewardDelegatorsOwner = addrs[14];
    stakeManagerOwner = addrs[15];
    registeredClusterRewardAddress = addrs[16];
    clientKey1 = addrs[17];
    clientKey2 = addrs[18];
    registeredClusterRewardAddress1 = addrs[19];

  });

  it('deploys with initialization disabled', async function () {
    const Pond = await ethers.getContractFactory('Pond');
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"],{ kind: "uups" });

    const MPond = await ethers.getContractFactory('MPond');
    mpondInstance = await upgrades.deployProxy(MPond.connect(admin), { kind: "uups" });
    await mpondInstance.connect(admin).grantRole(await mpondInstance.WHITELIST_ROLE(), await mpondAccount.getAddress());
    await mpondInstance.connect(admin).transfer(await mpondAccount.getAddress(), BN.from(3000).e18());
    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const StakeManager = await ethers.getContractFactory('StakeManager');
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, {kind: "uups", initializer: false});

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await clusterRegistryInstance.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

    const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
    rewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, { kind: "uups", initializer: false });

    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewardsInstance = await ClusterRewards.deploy();
  
    await stakeManagerInstance.initialize(
      [pondTokenId, mpondTokenId],
      [pondInstance.address, mpondInstance.address],
      mpondInstance.address,
      rewardDelegatorsInstance.address,
      stakeManagerOwner,
      appConfig.staking.undelegationWaitTime
    );

    await expect(clusterRewardsInstance.initialize(
      await clusterRewardsOwner.getAddress(), // oracleOwner
      rewardDelegatorsInstance.address,
      ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533", "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701", "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
      [100, 100, 100],
      appConfig.staking.rewardPerEpoch,
      pondInstance.address,
      appConfig.staking.payoutDenomination,
      await feeder.getAddress(),
      1
    )).to.be.reverted;
  });


  it('deploys as proxy and initializes', async function () {

    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards,
      [await clusterRewardsOwner.getAddress(), // oracleOwner
        rewardDelegatorsInstance.address,
        ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533", "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701", "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
        [100, 100, 100],
        appConfig.staking.rewardPerEpoch,
        pondInstance.address,
        appConfig.staking.payoutDenomination,
        await feeder.getAddress(),
        1],
      { kind: "uups" });

    await rewardDelegatorsInstance.initialize(stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      rewardDelegatorsOwner,
      appConfig.staking.minMPONDStake,
      MPOND_HASH,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );

    await mpondInstance.connect(admin).grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    await pondInstance.transfer(rewardDelegatorsInstance.address, appConfig.staking.rewardPerEpoch * 100);
    expect(await clusterRewardsInstance.feeder()).is.equal(await feeder.getAddress());
    expect(await clusterRewardsInstance.totalRewardsPerEpoch()).to.equal(appConfig.staking.rewardPerEpoch);
  });

  it('upgrades', async function () {

    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    await upgrades.upgradeProxy(clusterRewardsInstance.address, ClusterRewards.connect(clusterRewardsOwner), {kind: "uups"});

    expect(await clusterRewardsInstance.feeder()).is.equal(await feeder.getAddress());
    expect(await clusterRewardsInstance.totalRewardsPerEpoch()).to.equal(appConfig.staking.rewardPerEpoch);
  });

  it('does not upgrade without admin', async function () {

    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    await expect(upgrades.upgradeProxy(clusterRewardsInstance.address, ClusterRewards, {kind: "uups"})).to.be.reverted;
  });

  it("Add network", async () => {
    const networkId = ethers.utils.id("ETH");
    const rewardWeight = 10;
    expect(Number(await clusterRewardsInstance.rewardWeight(networkId))).to.equal(0);
    await expect(clusterRewardsInstance.addNetwork(networkId, rewardWeight)).to.be.reverted;

    await clusterRewardsInstance.connect(clusterRewardsOwner).addNetwork(networkId, rewardWeight);
    expect(Number(await clusterRewardsInstance.rewardWeight(networkId))).to.equal(rewardWeight);
  });

  it("Remove network", async () => {
    const networkId = ethers.utils.id("NEAR1");
    const rewardWeight = 5;

    await clusterRewardsInstance.connect(clusterRewardsOwner).addNetwork(networkId, rewardWeight);
    expect(Number(await clusterRewardsInstance.rewardWeight(networkId))).to.equal(rewardWeight);
    await expect(clusterRewardsInstance.removeNetwork(networkId)).to.be.reverted;

    await clusterRewardsInstance.connect(clusterRewardsOwner).removeNetwork(networkId);
    expect(Number(await clusterRewardsInstance.rewardWeight(networkId))).to.equal(0);
  });

  it("change network reward", async () => {
    const networkId = ethers.utils.id("DOT1");
    const rewardWeight = 5;
    const updateRewardWeight = 10;

    await clusterRewardsInstance.connect(clusterRewardsOwner).addNetwork(networkId, rewardWeight);
    expect(Number(await clusterRewardsInstance.rewardWeight(networkId))).to.equal(rewardWeight);
    await expect(clusterRewardsInstance.changeNetworkReward(networkId, updateRewardWeight)).to.be.reverted;

    await clusterRewardsInstance.connect(clusterRewardsOwner).changeNetworkReward(networkId, updateRewardWeight);
    expect(Number(await clusterRewardsInstance.rewardWeight(networkId))).to.equal(updateRewardWeight);
  });

  it("feed cluster reward", async () => {
    let commission = 10;
    let networkId = ethers.utils.id("BSC");

    await clusterRegistryInstance.connect(registeredCluster).register(networkId, commission, registeredClusterRewardAddress, clientKey1);
    expect(Number(await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress()))).to.equal(0);
    await delegate(delegator, [await registeredCluster.getAddress()], [1], [2000000]);
    await feedData([await registeredCluster.getAddress()], 0);
    expect(Number(await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress()))).equal(3125);
  });

  it("should revert when cluster rewards are more than total rewards distributed per epoch", async () => {
    
    await ethers.provider.send('evm_increaseTime', [24*60*60]);
    // change the reward per epoch then feed
    await clusterRewardsInstance.connect(clusterRewardsOwner).changeRewardPerEpoch(1);
    await delegate(delegator, [await registeredCluster.getAddress()], [1], [2000000]);

    // cluster reward more than total reward per epoch
    await expect(feedData([await registeredCluster.getAddress()], 0)).to.be.reverted;

    // change the epoch reward to 10000
    await clusterRewardsInstance.connect(clusterRewardsOwner).changeRewardPerEpoch(appConfig.staking.rewardPerEpoch);
    await ethers.provider.send('evm_increaseTime', [24*60*60]);
  });

  it("feed rewards for epoch 1 & 2 simultaneously", async () => {
    await ethers.provider.send('evm_increaseTime', [24*60*60]);
    await feedData([await registeredCluster.getAddress()], 1);
    await expect(feedData([await registeredCluster.getAddress()], 2)).to.be.reverted;
  });

  it("add new network then feed then remove network then feed again", async () => {
    await ethers.provider.send('evm_increaseTime', [24*60*60]);
    const networkId = ethers.utils.id("testnet");
    const rewardWeight = 10;
    let commission = 10;

    await clusterRewardsInstance.connect(clusterRewardsOwner).addNetwork(networkId, rewardWeight);
    await clusterRegistryInstance.connect(registeredCluster1).register(networkId,
        commission, registeredClusterRewardAddress1, clientKey2);
    expect(Number(await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress()))).to.equal(0);

    await delegate(delegator, [await registeredCluster1.getAddress()], [1], [2000000]);
    await feedData([await registeredCluster1.getAddress()], 3);
    expect(Number(await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress()))).to.equal(3030);
    await clusterRewardsInstance.connect(clusterRewardsOwner).removeNetwork(networkId);
    await ethers.provider.send('evm_increaseTime', [24*60*60]);
    // transfer some rewards to rewardDelegators
    await pondInstance.transfer(rewardDelegatorsInstance.address, 1000000);

    // feed again the cluster reward increases 
    await delegate(delegator, [await registeredCluster1.getAddress()], [1], [2000000]);
    await feedData([await registeredCluster1.getAddress()], 4);
    expect(Number(await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress()))).to.equal(3126);
  });

  it("add new network then feed then update reward to 0 then feed again", async () => {
    const networkId = ethers.utils.id("testnet");
    const updateRewardWeight = 0;
    await expect(clusterRewardsInstance.connect(clusterRewardsOwner).changeNetworkReward(networkId, updateRewardWeight)).to.be.reverted;
  });

  it("delegate then claim reward", async () => {
    await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress());
    expect(Number(await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress()))).to.equal(3126);
    const oldBalance = await pondInstance.balanceOf(registeredClusterRewardAddress1);
    expect(oldBalance).to.equal(302);

    await delegate(delegator, [await registeredCluster1.getAddress()], [1], [2000000]);
    await clusterRewardsInstance.connect(clusterRewardsOwner).updateRewardDelegatorAddress(addrs[0]);
    const PondBalBefore = await pondInstance.balanceOf(clusterRewardsInstance.address);

    await clusterRewardsInstance.claimReward(await registeredCluster1.getAddress());
    const newBalance = await pondInstance.balanceOf(registeredClusterRewardAddress1);
    expect(newBalance).to.equal(614);

    // check the balance of clusterRewards
    const PondBalAfter = await pondInstance.balanceOf(clusterRewardsInstance.address);
    expect(PondBalBefore).to.equal(PondBalAfter);
  });

  async function getTokensAndApprove(user: Signer, tokens: any, spender: string) {
    if (tokens.pond > 0) {
      await pondInstance.transfer(await user.getAddress(), tokens.pond);
      await pondInstance.connect(user).approve(spender, tokens.pond);
    }

    if (tokens.mpond > 0) {
      await mpondInstance.connect(mpondAccount).transfer(await user.getAddress(), tokens.mpond);
      await mpondInstance.connect(user).approve(spender, tokens.mpond);
    }
  }
  async function delegate(delegator: Signer, clusters: string[], mpondAmounts: any[], pondAmounts: any[]) {
    let totalPond = 0;
    let totalMPond = 0;
    for (let i = 0; i < pondAmounts.length; i++) {
      totalPond += pondAmounts[i];
      totalMPond += mpondAmounts[i];
    }
    await getTokensAndApprove(delegator, { pond: totalPond, mpond: totalMPond }, stakeManagerInstance.address);

    for (let i = 0; i < clusters.length; i++) {
      const tokens = [];
      const amounts = [];
      if (mpondAmounts[i] > 0) {
        tokens.push(mpondTokenId);
        amounts.push(mpondAmounts[i]);
      }
      if (pondAmounts[i] > 0) {
        tokens.push(pondTokenId);
        amounts.push(pondAmounts[i]);
      }
      await stakeManagerInstance.connect(delegator).createStashAndDelegate(tokens, amounts, clusters[i]);
    }
  }

  async function feedData(clusters: string[], epoch: any) {
    const stakes = [];
    let totalStake = BN.from(0);
    let pondPerMpond = BN.from(1000000);
    let payoutDenomination = BN.from(appConfig.staking.payoutDenomination);
    for (let i = 0; i < clusters.length; i++) {
      const mpondClusterStake = await rewardDelegatorsInstance.getClusterDelegation(clusters[i], mpondTokenId);
      const pondClusterStake = await rewardDelegatorsInstance.getClusterDelegation(clusters[i], pondTokenId);
      const clusterStake = mpondClusterStake.mul(pondPerMpond).add(pondClusterStake);
      stakes.push(clusterStake);
      totalStake = totalStake.add(clusterStake);
    }
    const payouts = [];
    for (let i = 0; i < clusters.length; i++) {
      const stake = stakes[i];
      payouts.push(stake.mul(payoutDenomination).div(totalStake).toString())
    }
    await clusterRewardsInstance.connect(feeder).feed(ethers.utils.id("DOT"), clusters, payouts, epoch);
  }
});



