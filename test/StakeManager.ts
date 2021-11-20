import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber as BN, Signer, Contract } from 'ethers';
import exp from 'constants';
const appConfig = require("../app-config");

declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}


describe('StakeManager Deployment', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistryOwner: string;
  let clusterRewardsOwner: string;
  let feeder: string;
  let rewardDelegatorsOwner: string;
  let stakeManagerOwner: Signer;
  let MpondAccount: Signer;
  let PONDTokenId: string;
  let MPONDTokenId: string;
  let pondInstance: Contract;
  let mpondInstance: Contract;
  let stakeManagerInstance: Contract;
  let clusterRegistryInstance: Contract;
  let clusterRewardsInstance: Contract;
  let rewardDelegatorsInstance: Contract;
  const COMMISSION_LOCK = "0x7877e81172e1242eb265a9ff5a14c913d44197a6e15e0bc1d984f40be9096403";
  const SWITCH_NETWORK_LOCK = "0x18981a75d138782f14f3fbd4153783a0dc1558f28dc5538bf045e7de84cb2ae2";
  const UNREGISTER_LOCK = "0x027b176aae0bed270786878cbabc238973eac20b1957aae44b82a73cc8c7080c";
  const REDELEGATION_LOCK = "0xc9fb5027edad04dc7cbd44766b39dcb7d42c498b3b47b80001805039c63cf1e0";
  const MOND_HASH = "0x9d76bde6f6a1e9bf8e29a98238a6cb26e11f790c4377a675d10c5b375109dbc8";

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    MpondAccount = signers[3];
    clusterRegistryOwner = addrs[5];
    clusterRewardsOwner = addrs[6];
    feeder = addrs[7];
    rewardDelegatorsOwner = addrs[8];
    stakeManagerOwner = signers[9];
  });

  it('deploys with initialization disabled', async function () {
    const Pond = await ethers.getContractFactory('Pond');
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"],{ kind: "uups" });

    const MPond = await ethers.getContractFactory('MPond');
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });
    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), MpondAccount.getAddress());
    await mpondInstance.transfer(MpondAccount.getAddress(), BN.from(3000).e18());

    PONDTokenId = ethers.utils.keccak256(pondInstance.address);
    MPONDTokenId = ethers.utils.keccak256(mpondInstance.address);

    const StakeManager = await ethers.getContractFactory('StakeManager');
    let stakeManager = await StakeManager.deploy();

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [4, 10, 22];
    const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await clusterRegistryInstance.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

    const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
    rewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, { kind: "uups", initializer: false });

    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewardsInstance = await upgrades.deployProxy(
      ClusterRewards,
      [clusterRewardsOwner, // oracleOwner,
        rewardDelegatorsInstance.address,
        ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533", "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701", "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
        [100, 100, 100],
        appConfig.staking.rewardPerEpoch,
        mpondInstance.address,
        appConfig.staking.payoutDenomination,
        feeder,
        10],
      { kind: "uups" });
  
    await rewardDelegatorsInstance.initialize(stakeManager.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      rewardDelegatorsOwner,
      appConfig.staking.minMPONDStake,
      MOND_HASH,
      pondInstance.address,
      [PONDTokenId, MPONDTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );

    await expect(stakeManager.initialize(
      [PONDTokenId, MPONDTokenId],
      [pondInstance.address, mpondInstance.address],
      mpondInstance.address,
      rewardDelegatorsInstance.address,
      stakeManagerOwner.getAddress(),
      appConfig.staking.undelegationWaitTime
    )).to.be.reverted;
  });

  it('deploys as proxy and initializes', async function () {

    

    const StakeManager = await ethers.getContractFactory('StakeManager');
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory('RewardDelegators');
    rewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, { kind: "uups", initializer: false });

    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewardsInstance = await upgrades.deployProxy(
      ClusterRewards,
      [clusterRewardsOwner, // oracleOwner,
        rewardDelegatorsInstance.address,
        ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533", "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701", "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
        [100, 100, 100],
        appConfig.staking.rewardPerEpoch,
        mpondInstance.address,
        appConfig.staking.payoutDenomination,
        feeder,
        10],
      { kind: "uups" });
  
    await rewardDelegatorsInstance.initialize(stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      rewardDelegatorsOwner,
      appConfig.staking.minMPONDStake,
      MOND_HASH,
      pondInstance.address,
      [PONDTokenId, MPONDTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );

    await stakeManagerInstance.initialize(
      [PONDTokenId, MPONDTokenId],
      [pondInstance.address, mpondInstance.address],
      mpondInstance.address,
      rewardDelegatorsInstance.address,
      stakeManagerOwner.getAddress(),
      appConfig.staking.undelegationWaitTime
    );
    
    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    await pondInstance.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch*100);
    await stakeManagerInstance.connect(stakeManagerOwner).updateLockWaitTime(REDELEGATION_LOCK, 5);

    expect(await stakeManagerInstance.lockWaitTime(REDELEGATION_LOCK)).to.equal(5);
  });

  it('upgrades', async function () {

    const StakeManager = await ethers.getContractFactory('StakeManager');
    await upgrades.upgradeProxy(stakeManagerInstance.address, StakeManager.connect(stakeManagerOwner), {kind: "uups"});
    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    await pondInstance.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch*100);
    await stakeManagerInstance.connect(stakeManagerOwner).updateLockWaitTime(REDELEGATION_LOCK, 5);

    expect(await stakeManagerInstance.lockWaitTime(REDELEGATION_LOCK)).to.equal(5);
  });

  it('does not upgrade without admin', async function () {
    const StakeManager = await ethers.getContractFactory('StakeManager');
    await expect(upgrades.upgradeProxy(stakeManagerInstance.address, StakeManager.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });

  it('create POND stash', async()=> {
    const amount = 12000000;

    await pondInstance.approve(stakeManagerInstance.address, 0);
    await expect(stakeManagerInstance.createStash([PONDTokenId], [1])).to.be.reverted;

    await pondInstance.approve(stakeManagerInstance.address, amount);
    expect(await pondInstance.allowance(addrs[0], stakeManagerInstance.address)).to.equal(amount);

    const prevUserBalance = await pondInstance.balanceOf(addrs[0]);
    const prevBalLowStash = await pondInstance.balanceOf(stakeManagerInstance.address);

    // Even if excess amount is approved, only amount mentioned while creating stash should be used and tokens should be transferred to stakingContract.
    await stakeManagerInstance.createStash([PONDTokenId], [amount - 100]);
    const postBalLowStash = await pondInstance.balanceOf(stakeManagerInstance.address);
    const postUserBalance = await pondInstance.balanceOf(addrs[0]);
    expect(postBalLowStash.sub(prevBalLowStash)).to.equal(amount - 100);
    expect(prevUserBalance.sub(postUserBalance)).to.equal(amount - 100);

    await pondInstance.approve(stakeManagerInstance.address, amount);
    const prevBalEqStash = await pondInstance.balanceOf(stakeManagerInstance.address);
    // If exact amount is approved, the stash should still be created and tokens transferred to stakingContract with specified amount
    await stakeManagerInstance.createStash([PONDTokenId], [amount]);
    const postBalEqStash = await pondInstance.balanceOf(stakeManagerInstance.address);
    expect(postBalEqStash.sub(prevBalEqStash)).to.equal(amount);

    // Should revert if trying to createStash with more amount than approved.
    await pondInstance.approve(stakeManagerInstance.address, amount);
    await expect(stakeManagerInstance.createStash([PONDTokenId], [amount + 1])).to.be.reverted;

    // should revert if trying to createStash with any of the token using 0 amount
    await pondInstance.approve(stakeManagerInstance.address, amount);
    await expect(stakeManagerInstance.createStash([PONDTokenId], [0])).to.be.reverted;
    await expect(stakeManagerInstance.createStash([PONDTokenId, MPONDTokenId], [amount, 0])).to.be.reverted;

    // should revert if trying to createStash with same tokenId sent multiple times in same tx
    await pondInstance.approve(stakeManagerInstance.address, amount + 2);
    await mpondInstance.connect(MpondAccount).transfer(addrs[0], amount);
    await mpondInstance.approve(stakeManagerInstance.address, amount);
    await expect(stakeManagerInstance.createStash([PONDTokenId, MPONDTokenId, PONDTokenId], [amount, amount, 2])).to.be.reverted;

    // If multiple stashes with same data are created, stashid should be different for both
    await pondInstance.approve(stakeManagerInstance.address, amount * 2);
    let tx1 = await (await stakeManagerInstance.createStash([PONDTokenId], [amount])).wait();
    let tx2 = await (await stakeManagerInstance.createStash([PONDTokenId], [amount])).wait();
    expect(tx1.events[2].args.stashId).to.not.equal(tx2.events[2].args.stashId);
  });

});


