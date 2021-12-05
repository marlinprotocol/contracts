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

describe('RewardDelegators Deployment', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistryInstance: Contract;
  let pondInstance: Contract;
  let mpondInstance: Contract;
  let rewardDelegatorsInstance: Contract;
  let clusterRewardsInstance: Contract;
  let stakeManagerInstance: Contract;
  let testTokenInstance: Contract;
  const COMMISSION_LOCK = "0x7877e81172e1242eb265a9ff5a14c913d44197a6e15e0bc1d984f40be9096403";
  const SWITCH_NETWORK_LOCK = "0x18981a75d138782f14f3fbd4153783a0dc1558f28dc5538bf045e7de84cb2ae2";
  const UNREGISTER_LOCK = "0x027b176aae0bed270786878cbabc238973eac20b1957aae44b82a73cc8c7080c";
  let pondTokenId: string;
  let mpondTokenId: string;
  let registeredCluster: Signer;
  let registeredCluster1: Signer;
  let registeredCluster2: Signer;
  let registeredCluster3: Signer;
  let registeredCluster4: Signer;
  let rewardDelegatorsOwner: Signer;
  let feeder: Signer;
  let registeredClusterRewardAddress: string;
  let clientKey1: string;
  let delegator: Signer;
  let mpondAccount: Signer;
  let clientKey2: string;
  let clientKey3: string;
  let clientKey4: string;
  let clientKey5: string;
  let delegator1: Signer;
  let delegator2: Signer;
  let delegator3: Signer;
  let delegator4: Signer;
  let registeredClusterRewardAddress1: string;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    registeredCluster3 = signers[1];
    mpondAccount = signers[2];
    delegator = signers[3];
    registeredCluster2 = signers[4];
    clientKey3 = addrs[5]; delegator3 = signers[5];
    registeredCluster = signers[7];
    registeredCluster1 = signers[8];
    registeredCluster4 = signers[9];
    clientKey4 = addrs[12]; delegator4 = signers[12];
    feeder = signers[13];
    rewardDelegatorsOwner = signers[14];
    clientKey5 = addrs[15];
    registeredClusterRewardAddress = addrs[16];
    clientKey1 = addrs[17]; delegator1 = signers[17];
    clientKey2 = addrs[18]; delegator2 = signers[18];
    registeredClusterRewardAddress1 = addrs[19];

  });

  it('deploys with initialization disabled', async function () {
    const Pond = await ethers.getContractFactory('Pond');
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"],{ kind: "uups" });

    const MPond = await ethers.getContractFactory('MPond');
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });
    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), await mpondAccount.getAddress());
    await mpondInstance.transfer(await mpondAccount.getAddress(), BN.from(3000).e18());
    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const StakeManager = await ethers.getContractFactory('StakeManager');
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, {kind: "uups", initializer: false});

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await clusterRegistryInstance.initialize(selectors, lockWaitTimes, addrs[0]);

    const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
    rewardDelegatorsInstance = await RewardDelegators.deploy();

    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.initialize(
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        await rewardDelegatorsOwner.getAddress(),
        appConfig.staking.minMPONDStake,
        mpondTokenId,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    )).to.be.reverted;
  });


  it('deploys as proxy and initializes', async function () {

    const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
    rewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, [
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        await rewardDelegatorsOwner.getAddress(),
        appConfig.staking.minMPONDStake,
        mpondTokenId,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    ], { kind: "uups" });

    await stakeManagerInstance.initialize(
        [pondTokenId, mpondTokenId],
        [pondInstance.address, mpondInstance.address],
        mpondInstance.address,
        rewardDelegatorsInstance.address,
        addrs[0],
        appConfig.staking.undelegationWaitTime
    );
    await clusterRewardsInstance.initialize(
        addrs[0], // oracleOwner
        rewardDelegatorsInstance.address,
        ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533", "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701", "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
        [100, 100, 100],
        appConfig.staking.rewardPerEpoch,
        pondInstance.address,
        appConfig.staking.payoutDenomination,
        await feeder.getAddress(),
        10);
    

    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    await pondInstance.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch * 100);
    // initialize contract and check if all variables are correctly set(including admin)
    expect(await stakeManagerInstance.undelegationWaitTime()).to.equal(appConfig.staking.undelegationWaitTime);
    expect(await rewardDelegatorsInstance.minMPONDStake()).to.equal(appConfig.staking.minMPONDStake);
  });

  it('upgrades', async function () {

    const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
    await upgrades.upgradeProxy(rewardDelegatorsInstance.address, RewardDelegators.connect(rewardDelegatorsOwner), {kind: "uups"});
    expect(await rewardDelegatorsInstance.minMPONDStake()).to.equal(appConfig.staking.minMPONDStake);
  });

  it('does not upgrade without admin', async function () {

    const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
    await expect(upgrades.upgradeProxy(rewardDelegatorsInstance.address, RewardDelegators, {kind: "uups"})).to.be.reverted;
  });

  it("update rewards", async () => {
    // Update rewards when there are no rewards pending for the cluster
    // update rewards when there are pending rewards for cluster and check if cluster is getting correct commission and also that accRewardPerShare is getting updated correctly
    // If weightedStake is 0, then check that no rewards are distributed
    // If rewards exist and then weightedStake becomes 0, then rewards still have to be distributed

    const clusterBeforeReward = await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress());
    expect(Number(clusterBeforeReward)).to.equal(0);

    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner)._updateRewards(await registeredCluster.getAddress());
    const clusterAfterReward = await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress());
    expect(Number(clusterAfterReward)).to.equal(0);

    // Check For Correct Update Case
    const commission = 5;
    await clusterRegistryInstance.connect(registeredCluster).register(ethers.utils.id("DOT"), commission, registeredClusterRewardAddress, clientKey1);
    await delegate(delegator, [await registeredCluster.getAddress()], [0], [2000000]);
    expect(await rewardDelegatorsInstance.getDelegation(await registeredCluster.getAddress(), await delegator.getAddress(), pondTokenId)).to.equal(2000000);

    await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
    await feedData([await registeredCluster.getAddress()], 1);

    const clusterUpdatedReward = await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress());
    expect(Number(clusterUpdatedReward)).equal(3333);

    const rewardAddrOldBalance = await pondInstance.balanceOf(registeredClusterRewardAddress);
    expect(Number(rewardAddrOldBalance)).to.equal(0);

    const accPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster.getAddress(), pondTokenId);
    const accMPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster.getAddress(), mpondTokenId);
    expect(Number(accPondRewardPerShareBefore)).to.equal(0);
    expect(Number(accMPondRewardPerShareBefore)).to.equal(0);

    const rewardDelegatorsBal = await pondInstance.balanceOf(rewardDelegatorsInstance.address);

    // transfer POND for rewards
    await pondInstance.transfer(rewardDelegatorsInstance.address, appConfig.staking.rewardPerEpoch*100);
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner)._updateRewards(await registeredCluster.getAddress());

    // Checking Cluster Reward
    const cluster1UpdatedRewardNew = await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress());
    expect(Number(cluster1UpdatedRewardNew)).to.equal(1);

    // Checking Cluster Commission
    const rewardAddrNewBalance = await pondInstance.balanceOf(registeredClusterRewardAddress);
    expect(rewardAddrOldBalance).to.not.equal(rewardAddrNewBalance);

    // the actual rewardAddrNewBalance is 166.65 but due to solidity uint, it'll be 166
    expect(Number(rewardAddrNewBalance)).to.equal(Math.floor(Number(clusterUpdatedReward) / 100 * commission));

    // Checking cluster Acc Reward
    const accPondRewardPerShareAfter = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster.getAddress(), pondTokenId);
    const accMPondRewardPerShareAfter = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster.getAddress(), mpondTokenId);
    expect(String(accPondRewardPerShareAfter)).to.equal("1583000000000000000000000000");
    expect(String(accMPondRewardPerShareAfter),).equal("0")
    });

    it("delegate to cluster", async () => {
        // delegate to an  invalid cluster
        await clusterRegistryInstance.connect(registeredCluster1).register(ethers.utils.id("DOT"), 0, registeredClusterRewardAddress1, clientKey2);
        await clusterRegistryInstance.connect(registeredCluster2).register(ethers.utils.id("DOT"), 0, registeredClusterRewardAddress1, clientKey3);
        // 2 users delegate tokens to a cluster - one twice the other
        await delegate(delegator1, [await registeredCluster1.getAddress(), await registeredCluster2.getAddress()], [0, 4], [2000000, 0]);
        await delegate(delegator2, [await registeredCluster1.getAddress(), await registeredCluster2.getAddress()], [10, 0], [0, 2000000]);
        let accPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster1.getAddress(), pondTokenId);
        let accMPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster1.getAddress(), mpondTokenId);
        // data is fed to the oracle
        // await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
        // wait for 1 day
        await ethers.provider.send('evm_increaseTime', [24*60*60]);
        await ethers.provider.send('evm_mine', []);
        await feedData([await registeredCluster1.getAddress(), await registeredCluster2.getAddress()], 2);
        const cluster1Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress());
        const cluster2Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster2.getAddress());
        expect(cluster1Reward).to.equal(Math.round((10 + 2) / (10 + 2 + 4 + 2) * appConfig.staking.rewardPerEpoch / 3));
        expect(cluster2Reward).to.equal(Math.round((4 + 2) / (10 + 2 + 4 + 2) * appConfig.staking.rewardPerEpoch / 3));
        // do some delegations for both users to the cluster
        // rewards for one user is withdraw - this reward should be as per the time of oracle feed
        let PondBalance1Before = await pondInstance.balanceOf(await delegator1.getAddress());
        await delegate(delegator1, [await registeredCluster1.getAddress(), await registeredCluster2.getAddress()], [0, 4], [2000000, 0]);
        let PondBalance1After = await pondInstance.balanceOf(await delegator1.getAddress());
        let accPondRewardPerShare = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster1.getAddress(), pondTokenId);
        let accMPondRewardPerShare = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster1.getAddress(), mpondTokenId);
        // substract 1 from the delegator rewards according to contract changes?
        // expect(PondBalance1After.sub(PondBalance1Before)).to.equal(Math.round(appConfig.staking.rewardPerEpoch * 1 / 3 * (2.0 / 3 * 1 / 2 + 1.0 / 3 * 1 / 2) - 1)); // TODO
        // feed data again to the oracle
        // await feedData([registeredCluster, registeredCluster1, registeredCluster2, registeredCluster3, registeredCluster4]);
        // // do some delegations for both users to the cluster
        // let PondBalance2Before = await PONDInstance.balanceOf(delegator2);
        // await delegate(delegator2, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);PondBalance1Before
        // let PondBalance2After = await PONDInstance.balanceOf(delegator2);
        // console.log(PondBalance2After.sub(PondBalance2Before).toString(), appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5)));
        // assert(PondBalance2After.sub(PondBalance2Before).toString() == parseInt(appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5))));
    });

    it("withdraw reward", async () => {
        const commission = 10;
        await clusterRegistryInstance.connect(registeredCluster3).register(ethers.utils.id("DOT"), commission, registeredClusterRewardAddress1, clientKey4);

        await delegate(delegator3, [await registeredCluster3.getAddress()], [4], [1000000]);
        // await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
        // wait 1 day
        await ethers.provider.send('evm_increaseTime', [24*60*60]);
        await ethers.provider.send('evm_mine', []);
        await feedData([await registeredCluster3.getAddress()], 3);
        const clusterReward = await clusterRewardsInstance.clusterRewards(await registeredCluster3.getAddress());
        const clusterCommission = Math.ceil(Number(clusterReward) / 100 * commission);

        const delegatorOldBalance = await pondInstance.balanceOf(await delegator3.getAddress());
        expect(Number(delegatorOldBalance)).to.equal(0);
        await rewardDelegatorsInstance.connect(delegator3)["withdrawRewards(address,address[])"](await delegator3.getAddress(), [await registeredCluster3.getAddress()]);
        const delegatorNewBalance = await pondInstance.balanceOf(await delegator3.getAddress());
        expect(Number(delegatorNewBalance)).to.equal( Number(clusterReward) - clusterCommission -1);
    });

    it("update MPOND Token id", async () => {
        // update MPOND token id and check if minMPOND requirements is happenning(is cluster  active) with the updated token
        // cluster had minMPOND before and after change it doesn't
        // cluster had minMPOND before and after change it does have in new tokenId as well
        // update MPOND token to id that doesn't have an address mapped
        const oldMPONDTokenId = await rewardDelegatorsInstance.MPONDTokenId();
        const oldClusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster1.getAddress(), oldMPONDTokenId);

        const rewardDelegatorsOwner = await ethers.getSigner(await rewardDelegatorsInstance.owner());
        await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateMPONDTokenId(ethers.utils.id("dummyTokenId"));
        const newMPONDTokenId = await rewardDelegatorsInstance.MPONDTokenId();

        // should be zero
        const newClusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster1.getAddress(), newMPONDTokenId);
        const clusterTokenDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster1.getAddress(), oldMPONDTokenId);
        expect(newClusterDelegation).to.equal(0);
        expect(oldClusterDelegation).to.equal(clusterTokenDelegation);
    });

    it("reinitialize contract then delegate and withdraw rewards for single token", async () => {

        // deploy pond and mpond tokens
        const Pond = await ethers.getContractFactory('Pond');
        pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"],{ kind: "uups" });

        const MPond = await ethers.getContractFactory('MPond');
        mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });
        await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), await mpondAccount.getAddress());
        await mpondInstance.transfer(await mpondAccount.getAddress(), BN.from(3000).e18());
        pondTokenId = ethers.utils.keccak256(pondInstance.address);
        mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

        // deploy a test erc20 token

        testTokenInstance = await upgrades.deployProxy(Pond, ["TestToken", "TEST"],{ kind: "uups" });
        const testTokenId = ethers.utils.keccak256(testTokenInstance.address);

        const StakeManager = await ethers.getContractFactory('StakeManager');
        stakeManagerInstance = await upgrades.deployProxy(StakeManager, {kind: "uups", initializer: false});

        const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
        const lockWaitTimes = [20, 21, 22];
        const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
        clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
        await clusterRegistryInstance.initialize(selectors, lockWaitTimes, addrs[0]);


        const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
        clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

        const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
        rewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, [
            stakeManagerInstance.address,
            clusterRewardsInstance.address,
            clusterRegistryInstance.address,
            await rewardDelegatorsOwner.getAddress(),
            appConfig.staking.minMPONDStake,
            mpondTokenId,
            pondInstance.address,
            [testTokenId],
            [100]
        ], { kind: "uups" });
        
        await stakeManagerInstance.initialize(
            [testTokenId],
            [testTokenInstance.address],
            mpondInstance.address,
            rewardDelegatorsInstance.address,
            addrs[0],
            appConfig.staking.undelegationWaitTime
        );
        await clusterRewardsInstance.initialize(
            addrs[0], // oracleOwner
            rewardDelegatorsInstance.address,
            [ethers.utils.id("testing")],
            [100],
            appConfig.staking.rewardPerEpoch,
            pondInstance.address,
            appConfig.staking.payoutDenomination,
            await feeder.getAddress(),
            10);
        

        await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
        expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

        await pondInstance.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch * 100);

        // register cluster
        await clusterRegistryInstance.connect(registeredCluster4).register(ethers.utils.id("DOT"), 10, registeredClusterRewardAddress1, clientKey5);

        const delegator1BeforeBalance = await pondInstance.balanceOf(await delegator1.getAddress());

        // delegate to the cluster
        await delegateToken(delegator1, [await registeredCluster4.getAddress()], [10], testTokenInstance);
        await delegateToken(delegator2, [await registeredCluster4.getAddress()], [20], testTokenInstance);
        await skipBlocks(10);
        await feedTokenData([await registeredCluster4.getAddress()], testTokenInstance, 1);
        
        // cluster reward
        const cluster4Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster4.getAddress());
        expect(cluster4Reward).to.equal(10000);

        // transfer POND for rewards
        await pondInstance.transfer(rewardDelegatorsInstance.address, appConfig.staking.rewardPerEpoch*100);
        await rewardDelegatorsInstance.connect(delegator1)["withdrawRewards(address,address)"](await delegator1.getAddress(), await registeredCluster4.getAddress()); 

        // delegator reward
        const delegator1AfterBalance = await pondInstance.balanceOf(await delegator1.getAddress());
        expect(await delegator1AfterBalance).to.equal(3000);
    });

    it("Add, remove and update reward Factor", async ()=> {
      const testTokenId = ethers.utils.id("testTokenId");
      // only owner can add the reward factor
      await expect(rewardDelegatorsInstance.addRewardFactor(testTokenId, 10)).to.be.reverted;
      const addRewardTx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).addRewardFactor(testTokenId, 10)).wait();
      expect(addRewardTx.events[0].event).to.equal("AddReward");

      // only owner can update the reward factor
      await expect(rewardDelegatorsInstance.updateRewardFactor(testTokenId, 100)).to.be.reverted;
      const updateRewardTx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateRewardFactor(testTokenId, 100)).wait();
      expect(updateRewardTx.events[0].event).to.equal("RewardsUpdated");

      // only owner can remove the reward factor
      await expect(rewardDelegatorsInstance.removeRewardFactor(testTokenId)).to.be.reverted;
      const removeRewardTx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).removeRewardFactor(testTokenId)).wait();
      expect(removeRewardTx.events[0].event).to.equal("RemoveReward");
    });

    it("update minPondStake", async()=> {
      const minPondStakeBefore = await rewardDelegatorsInstance.minMPONDStake();
      // only owner can update
      await expect(rewardDelegatorsInstance.updateMinMPONDStake(minPondStakeBefore + 10)).to.be.reverted;
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateMinMPONDStake(minPondStakeBefore + 10);

      expect(await rewardDelegatorsInstance.minMPONDStake()).to.equal(minPondStakeBefore + 10);
    });

    it("update stake address", async()=> {
      const StakeManager = await ethers.getContractFactory('StakeManager');
      const tempStakeManagerInstance = await upgrades.deployProxy(StakeManager, {kind: "uups", initializer: false});

      await expect(rewardDelegatorsInstance.updateStakeAddress(tempStakeManagerInstance.address)).to.be.reverted;
      let tx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateStakeAddress(tempStakeManagerInstance.address)).wait();
      expect(tx.events[0].event).to.equal("StakeAddressUpdated");

      //change back to original
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateStakeAddress(stakeManagerInstance.address);
    });

    it("update clusterReward address", async()=> {
      const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
      const tempCLusterRewardInstance = await upgrades.deployProxy(ClusterRewards, {kind: "uups", initializer: false});

      await expect(rewardDelegatorsInstance.updateClusterRewards(tempCLusterRewardInstance.address)).to.be.reverted;
      let tx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRewards(tempCLusterRewardInstance.address)).wait();
      expect(tx.events[0].event).to.equal("ClusterRewardsAddressUpdated");

      //change back to original
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRewards(clusterRewardsInstance.address);
    });

    it("update clusterRegistry address", async()=> {
      const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
      const tempCLusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, {kind: "uups", initializer: false});

      await expect(rewardDelegatorsInstance.updateClusterRegistry(tempCLusterRegistryInstance.address)).to.be.reverted;
      let tx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRegistry(tempCLusterRegistryInstance.address)).wait();
      expect(tx.events[0].event).to.equal("ClusterRegistryUpdated");

      //change back to original
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRegistry(clusterRegistryInstance.address);
    });

    it("update POND address", async()=> {
      const Pond = await ethers.getContractFactory('Pond');
      const tempPondInstance = await upgrades.deployProxy(Pond, {kind: "uups", initializer: false});

      await expect(rewardDelegatorsInstance.updatePONDAddress(tempPondInstance.address)).to.be.reverted;
      let tx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updatePONDAddress(tempPondInstance.address)).wait();
      expect(tx.events[0].event).to.equal("PONDAddressUpdated");

      //change back to original
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updatePONDAddress(pondInstance.address);
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

  async function skipBlocks(blocks: Number) {
    for(let i=0; i < blocks; i++) {
        await pondInstance.transfer(addrs[0], 0);
    }
  }

  async function delegateToken(delegator: Signer, clusters: string[], tokenAmounts: any[], tokenInstance: Contract) {
    let totalToken = 0;
    for (let i = 0; i < tokenAmounts.length; i++) {
        totalToken += tokenAmounts[i];
    }

    if (totalToken > 0) {
        await tokenInstance.transfer(await delegator.getAddress(), totalToken);
        await tokenInstance.connect(delegator).approve(stakeManagerInstance.address, totalToken);
    }

    let testTokenId = ethers.utils.keccak256(tokenInstance.address);
    for (let i = 0; i < clusters.length; i++) {
        const tokens = [];
        const amounts = [];
        if (tokenAmounts[i] > 0) {
            tokens.push(testTokenId);
            amounts.push(tokenAmounts[i]);
        }
        await stakeManagerInstance.connect(delegator).createStashAndDelegate(tokens, amounts, clusters[i]);
    }
  }

  async function feedTokenData(clusters: string[], tokenInstance: Contract, epoch: Number) {
    const stakes = [];
    let totalStake = BN.from(0);
    let pondPerToken = BN.from(1000000);
    let payoutDenomination = BN.from(appConfig.staking.payoutDenomination);

    let testTokenId = await ethers.utils.keccak256(tokenInstance.address);
    for (let i = 0; i < clusters.length; i++) {
        const tokenClusterStake = await rewardDelegatorsInstance.getClusterDelegation(clusters[i], testTokenId);
        const clusterStake = tokenClusterStake.mul(pondPerToken);
        stakes.push(clusterStake);
        totalStake = totalStake.add(clusterStake);
    }
    const payouts = [];
    for (let i = 0; i < clusters.length; i++) {
        const stake = stakes[i];
        payouts.push(stake.mul(payoutDenomination).div(totalStake).toString())
    }
    await clusterRewardsInstance.connect(feeder).feed(ethers.utils.id("testing"), clusters, payouts, epoch);
  }
});

