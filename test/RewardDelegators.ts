import { ethers, upgrades } from "hardhat";
import { expect, util } from "chai";
import { BigNumber as BN, Signer, Contract, BigNumber } from "ethers";
import exp from "constants";
import { Sign, sign } from "crypto";
import cluster, { Address } from "cluster";
const appConfig = require("../app-config");

declare module "ethers" {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18));
};

describe("RewardDelegators", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManagerInstance: Contract;
  let pondInstance: Contract;
  let mpondInstance: Contract;
  let clusterRewardsInstance: Contract;
  let clusterRegistryInstance: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);
  });

  it("deploys with initialization disabled", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await RewardDelegators.deploy(pondTokenId, mpondTokenId);

    await expect(
      rewardDelegators.initialize(
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
      )
    ).to.be.reverted;
  });

  it("deploy as proxy and initializes", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );
    expect(await rewardDelegators.hasRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect([await rewardDelegators.tokenList(0), await rewardDelegators.tokenList(1)]).to.eql([pondTokenId, mpondTokenId]);
  });

  it("upgrades", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );
    await upgrades.upgradeProxy(rewardDelegators.address, RewardDelegators, { constructorArgs: [pondTokenId, mpondTokenId], kind: "uups" });
    expect(await rewardDelegators.hasRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect([await rewardDelegators.tokenList(0), await rewardDelegators.tokenList(1)]).to.eql([pondTokenId, mpondTokenId]);
  });

  it("does not upgrade without admin", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );
    await expect(
      upgrades.upgradeProxy(rewardDelegators.address, RewardDelegators.connect(signers[1]), {
        constructorArgs: [pondTokenId, mpondTokenId],
        kind: "uups",
      })
    ).to.be.reverted;
  });
});

describe("RewardDelegators", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManagerInstance: Contract;
  let pondInstance: Contract;
  let mpondInstance: Contract;
  let clusterRewardsInstance: Contract;
  let clusterRegistryInstance: Contract;
  let rewardDelegators: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );
  });

  it("non owner cannot update PondAddress", async () => {
    const Pond = await ethers.getContractFactory("Pond");
    let pondInstance2 = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    await expect(rewardDelegators.connect(signers[1]).updatePONDAddress(pondInstance2.address)).to.be.reverted;
  });

  it("cannot update PondAddress to 0", async () => {
    await expect(rewardDelegators.updatePONDAddress(0)).to.be.reverted;
  });

  it("owner can update PondAddress", async () => {
    const Pond = await ethers.getContractFactory("Pond");
    let pondInstance2 = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    let tx = await (await rewardDelegators.updatePONDAddress(pondInstance2.address)).wait();
    expect(tx.events[0].event).to.equal("PONDAddressUpdated");
  });

  it("non owner cannot update ClusterRegistry", async () => {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstance2 = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await expect(rewardDelegators.connect(signers[1]).updateClusterRegistry(clusterRegistryInstance2.address)).to.be.reverted;
  });

  it("cannot update ClusterRegistry to 0", async () => {
    await expect(rewardDelegators.updateClusterRegistry(0)).to.be.reverted;
  });

  it("owner can update ClusterRegistry", async () => {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstance2 = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    let tx = await (await rewardDelegators.updateClusterRegistry(clusterRegistryInstance2.address)).wait();
    expect(tx.events[0].event).to.equal("ClusterRegistryUpdated");
  });

  it("non owner cannot update ClusterRewards", async () => {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstance2 = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    await expect(rewardDelegators.connect(signers[1]).updateClusterRewards(clusterRewardsInstance2.address)).to.be.reverted;
  });

  it("cannot update ClusterRewards to 0", async () => {
    await expect(rewardDelegators.updateClusterRewards(0)).to.be.reverted;
  });

  it("owner can update ClusterRewards", async () => {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstance2 = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    let tx = await (await rewardDelegators.updateClusterRewards(clusterRewardsInstance2.address)).wait();
    expect(tx.events[0].event).to.equal("ClusterRewardsAddressUpdated");
  });

  it("non owner cannot update StakeManager", async () => {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstance2 = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await expect(rewardDelegators.connect(signers[1]).updateStakeAddress(stakeManagerInstance2.address)).to.be.reverted;
  });

  it("cannot update StakeManager to 0", async () => {
    await expect(rewardDelegators.updateStakeAddress(0)).to.be.reverted;
  });

  it("owner can update StakeManager", async () => {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstance2 = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    let tx = await (await rewardDelegators.updateStakeAddress(stakeManagerInstance2.address)).wait();
    expect(tx.events[0].event).to.equal("StakeAddressUpdated");
  });
});

describe("RewardDelegators", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManagerInstance: Contract;
  let pondInstance: Contract;
  let mpondInstance: Contract;
  let clusterRewardsInstance: Contract;
  let clusterRegistryInstance: Contract;
  let rewardDelegators: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );
  });

  it("non owner cannot add rewardFactor", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.connect(signers[1]).addRewardFactor(testTokenId, 1)).to.be.reverted;
  });

  it(" cannot add for already existing tokenId", async () => {
    await expect(rewardDelegators.addRewardFactor(pondTokenId, appConfig.staking.PondRewardFactor)).to.be.reverted;
  });

  it("cannot add 0 reward Factor", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.addRewardFactor(testTokenId, 0)).to.be.reverted;
  });

  it("owner can add rewardFactor", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    let tx = await (await rewardDelegators.addRewardFactor(testTokenId, 1)).wait();
    expect(tx.events[0].event).to.equal("AddReward");
  });

  it("non owner cannot remove rewardFactor", async () => {
    await expect(rewardDelegators.connect(signers[1]).removeRewardFactor(pondTokenId)).to.be.reverted;
  });

  it("cannot remove non existing tokenId", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.removeRewardFactor(testTokenId)).to.be.reverted;
  });

  it("owner can remove rewardFactor", async () => {
    let tx = await (await rewardDelegators.removeRewardFactor(pondTokenId)).wait();
    expect(tx.events[0].event).to.equal("RemoveReward");
  });

  it("non owner cannot update reward Factor", async () => {
    await expect(rewardDelegators.connect(signers[1]).updateRewardFactor(pondTokenId, appConfig.staking.PondRewardFactor + 1)).to.be
      .reverted;
  });

  it("cannot update non existing tokenId", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.updateRewardFactor(testTokenId, 1)).to.be.reverted;
  });

  it("cannot update rewardFactor to 0", async () => {
    await expect(rewardDelegators.updateRewardFactor(pondTokenId, 0)).to.be.reverted;
  });

  it("owner can update rewardFactor", async () => {
    let tx = await (await rewardDelegators.updateRewardFactor(pondTokenId, appConfig.staking.PondRewardFactor + 1)).wait();
    expect(tx.events[0].event).to.equal("RewardsUpdated");
  });
});

describe("RewardDelegators Deployment", function () {
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
  let registeredClusterRewardAddress2: string;
  let registeredClusterRewardAddress3: string;
  let registeredClusterRewardAddress4: string;

  let epochSelectorInstance: Contract;
  let numberOfClustersToSelect: number = 5;

  let receiverStaking: Contract;
  let receiverStaker: Signer;
  let receiverStakerAddress: string;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    registeredCluster3 = signers[1];
    mpondAccount = signers[2];
    delegator = signers[3];
    registeredCluster2 = signers[4];
    clientKey3 = addrs[5];
    delegator3 = signers[5];
    registeredCluster = signers[7];
    registeredCluster1 = signers[8];
    registeredCluster4 = signers[9];
    clientKey4 = addrs[12];
    delegator4 = signers[12];
    rewardDelegatorsOwner = signers[0];
    clientKey5 = addrs[15];
    registeredClusterRewardAddress = addrs[16];
    clientKey1 = addrs[17];
    delegator1 = signers[17];
    clientKey2 = addrs[18];
    delegator2 = signers[18];
    registeredClusterRewardAddress1 = addrs[19];
    receiverStaker = signers[20];
    receiverStakerAddress = addrs[20];
    registeredClusterRewardAddress2 = addrs[21];
    registeredClusterRewardAddress3 = addrs[22];
    registeredClusterRewardAddress4 = addrs[23];
  });

  it("deploys with initialization disabled", async function () {
    const Pond = await ethers.getContractFactory("Pond");
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });
    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), await mpondAccount.getAddress());
    await mpondInstance.transfer(await mpondAccount.getAddress(), BN.from(3000).e18());
    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await clusterRegistryInstance.initialize(lockWaitTimes);

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegatorsInstance = await RewardDelegators.deploy(pondTokenId, mpondTokenId);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    await expect(
      rewardDelegatorsInstance.initialize(
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
      )
    ).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegatorsInstance = await upgrades.deployProxy(
      RewardDelegators,
      [
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor],
      ],
      { kind: "uups", constructorArgs: [pondTokenId, mpondTokenId] }
    );

    await stakeManagerInstance.initialize(
      [pondTokenId, mpondTokenId],
      [pondInstance.address, mpondInstance.address],
      [false, true],
      rewardDelegatorsInstance.address,
      5,
      appConfig.staking.undelegationWaitTime,
      addrs[0]
    );

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);
    epochSelectorInstance = await EpochSelector.deploy(
      addrs[0],
      numberOfClustersToSelect,
      blockData.timestamp,
      pondInstance.address,
      BigNumber.from(10).pow(20)
    );

    let role = await epochSelectorInstance.UPDATER_ROLE();
    await epochSelectorInstance.connect(signers[0]).grantRole(role, rewardDelegatorsInstance.address);

    await rewardDelegatorsInstance.connect(signers[0]).updateEpochSelector(epochSelectorInstance.address);

    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(pondInstance.address, addrs[0]);

    await clusterRewardsInstance.initialize(
      addrs[0],
      rewardDelegatorsInstance.address,
      receiverStaking.address,
      epochSelectorInstance.address,
      [
        "0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533",
        "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701",
        "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f",
      ],
      [100, 100, 100],
      appConfig.staking.rewardPerEpoch
    );

    await pondInstance.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch * 100);
    // initialize contract and check if all variables are correctly set(including admin)
    expect(await stakeManagerInstance.lockWaitTime(await stakeManagerInstance.UNDELEGATION_LOCK_SELECTOR())).to.equal(
      appConfig.staking.undelegationWaitTime
    );
  });

  it("upgrades", async function () {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    await upgrades.upgradeProxy(rewardDelegatorsInstance.address, RewardDelegators.connect(rewardDelegatorsOwner), {
      kind: "uups",
      constructorArgs: [pondTokenId, mpondTokenId],
    });
  });

  it("does not upgrade without admin", async function () {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    await expect(
      upgrades.upgradeProxy(rewardDelegatorsInstance.address, RewardDelegators.connect(signers[1]), {
        kind: "uups",
        constructorArgs: [pondTokenId, mpondTokenId],
      })
    ).to.be.reverted;
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

    await registerCluster(
      commission,
      clusterRegistryInstance,
      registeredCluster,
      registeredClusterRewardAddress,
      ethers.utils.id("DOT"),
      clientKey1
    );
    await registerCluster(
      commission,
      clusterRegistryInstance,
      registeredCluster1,
      registeredClusterRewardAddress1,
      ethers.utils.id("DOT"),
      clientKey2
    );
    await registerCluster(
      commission,
      clusterRegistryInstance,
      registeredCluster2,
      registeredClusterRewardAddress2,
      ethers.utils.id("DOT"),
      clientKey3
    );
    await registerCluster(
      commission,
      clusterRegistryInstance,
      registeredCluster3,
      registeredClusterRewardAddress3,
      ethers.utils.id("DOT"),
      clientKey4
    );
    await registerCluster(
      commission,
      clusterRegistryInstance,
      registeredCluster4,
      registeredClusterRewardAddress4,
      ethers.utils.id("DOT"),
      clientKey5
    );

    await delegate(delegator, [await registeredCluster.getAddress()], [BigNumber.from(10).pow(18).toString()], [2000000]);
    await delegate(delegator, [await registeredCluster1.getAddress()], [BigNumber.from(10).pow(18).toString()], [2000000]);
    await delegate(delegator, [await registeredCluster2.getAddress()], [BigNumber.from(10).pow(18).toString()], [2000000]);
    await delegate(delegator, [await registeredCluster3.getAddress()], [BigNumber.from(10).pow(18).toString()], [2000000]);
    await delegate(delegator, [await registeredCluster4.getAddress()], [BigNumber.from(10).pow(18).toString()], [2000000]);

    expect(
      await rewardDelegatorsInstance.getDelegation(await registeredCluster.getAddress(), await delegator.getAddress(), pondTokenId)
    ).to.equal(2000000);
    expect(
      await rewardDelegatorsInstance.getDelegation(await registeredCluster.getAddress(), await delegator.getAddress(), mpondTokenId)
    ).to.equal(BigNumber.from(10).pow(18).toString());

    await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.

    let pondToUse = BigNumber.from(10).pow(18).mul(1000000).toString(); // 1 million pond

    await pondInstance.transfer(receiverStakerAddress, pondToUse);
    await pondInstance.connect(receiverStaker).approve(receiverStaking.address, pondToUse);
    await receiverStaking.connect(receiverStaker).deposit(pondToUse); // 1 million pond

    let epoch = (await mineTillGivenClusterIsSelected(receiverStaking, epochSelectorInstance, registeredCluster)).toString();

    await ethers.provider.send("evm_increaseTime", [4 * 60 * 61]);
    await ethers.provider.send("evm_mine", []);

    await clusterRewardsInstance
      .connect(receiverStaker)
      .issueTickets(ethers.utils.id("DOT"), epoch, [await registeredCluster.getAddress()], [BigNumber.from(10).pow(18)]);

    const clusterUpdatedReward = await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress());
    expect(Number(clusterUpdatedReward)).equal(3333);

    const rewardAddrOldBalance = await pondInstance.balanceOf(registeredClusterRewardAddress);
    expect(Number(rewardAddrOldBalance)).to.equal(0);

    const accPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(
      await registeredCluster.getAddress(),
      pondTokenId
    );
    const accMPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(
      await registeredCluster.getAddress(),
      mpondTokenId
    );
    expect(Number(accPondRewardPerShareBefore)).to.equal(0);
    expect(Number(accMPondRewardPerShareBefore)).to.equal(0);

    const rewardDelegatorsBal = await pondInstance.balanceOf(rewardDelegatorsInstance.address);

    // transfer POND for rewards
    await pondInstance.transfer(rewardDelegatorsInstance.address, appConfig.staking.rewardPerEpoch * 100);
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner)._updateRewards(await registeredCluster.getAddress());

    // Checking Cluster Reward
    const cluster1UpdatedRewardNew = await clusterRewardsInstance.clusterRewards(await registeredCluster.getAddress());
    expect(Number(cluster1UpdatedRewardNew)).to.equal(1);

    // Checking Cluster Commission
    const rewardAddrNewBalance = await pondInstance.balanceOf(registeredClusterRewardAddress);
    expect(rewardAddrOldBalance).to.not.equal(rewardAddrNewBalance);

    // the actual rewardAddrNewBalance is 166.65 but due to solidity uint, it'll be 166
    expect(Number(rewardAddrNewBalance)).to.equal(Math.floor((Number(clusterUpdatedReward) / 100) * commission));

    // Checking cluster Acc Reward
    const accPondRewardPerShareAfter = await rewardDelegatorsInstance.getAccRewardPerShare(
      await registeredCluster.getAddress(),
      pondTokenId
    );
    const accMPondRewardPerShareAfter = await rewardDelegatorsInstance.getAccRewardPerShare(
      await registeredCluster.getAddress(),
      mpondTokenId
    );
    expect(String(accPondRewardPerShareAfter)).to.equal("791500000000000000000000000");
    expect(String(accMPondRewardPerShareAfter)).equal("1583000000000000");
  });

  it("delegate to cluster", async () => {
    // delegate to an  invalid cluster
    // await clusterRegistryInstance
    //   .connect(registeredCluster1)
    //   .register(ethers.utils.id("DOT"), 0, registeredClusterRewardAddress1, clientKey2);
    // await clusterRegistryInstance
    //   .connect(registeredCluster2)
    //   .register(ethers.utils.id("DOT"), 0, registeredClusterRewardAddress1, clientKey3);

    // 2 users delegate tokens to a cluster - one twice the other
    await delegate(delegator1, [await registeredCluster1.getAddress(), await registeredCluster2.getAddress()], [0, 4], [2000000, 0]);
    await delegate(delegator2, [await registeredCluster1.getAddress(), await registeredCluster2.getAddress()], [10, 0], [0, 2000000]);
    let accPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(
      await registeredCluster1.getAddress(),
      pondTokenId
    );
    let accMPondRewardPerShareBefore = await rewardDelegatorsInstance.getAccRewardPerShare(
      await registeredCluster1.getAddress(),
      mpondTokenId
    );
    // data is fed to the oracle
    // await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
    // wait for 1 day
    let pondToUse = BigNumber.from(10).pow(18).mul(1000000).toString(); // 1 million pond

    await pondInstance.transfer(receiverStakerAddress, pondToUse);
    await pondInstance.connect(receiverStaker).approve(receiverStaking.address, pondToUse);
    await receiverStaking.connect(receiverStaker).deposit(pondToUse); // 1 million pond

    let epoch = (await mineTillGivenClusterIsSelected(receiverStaking, epochSelectorInstance, registeredCluster1)).toString();

    await clusterRewardsInstance
      .connect(receiverStaker)
      .issueTickets(ethers.utils.id("DOT"), epoch, [await registeredCluster1.getAddress()], [BigNumber.from(10).pow(18).div(2)]);

    await clusterRewardsInstance
      .connect(receiverStaker)
      .issueTickets(ethers.utils.id("DOT"), epoch, [await registeredCluster2.getAddress()], [BigNumber.from(10).pow(18).div(2)]);

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    const cluster1Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress());
    const cluster2Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster2.getAddress());

    // expect(cluster1Reward).to.equal(Math.round((((10 + 2) / (10 + 2 + 4 + 2)) * appConfig.staking.rewardPerEpoch) / 3));
    // expect(cluster2Reward).to.equal(Math.round((((4 + 2) / (10 + 2 + 4 + 2)) * appConfig.staking.rewardPerEpoch) / 3));

    // issue tickets have no link with total delegations to cluster, hence skipping it.
    expect(cluster1Reward).to.eq(cluster2Reward);

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
    const commission = 5;
    // await clusterRegistryInstance
    //   .connect(registeredCluster3)
    //   .register(ethers.utils.id("DOT"), commission, registeredClusterRewardAddress1, clientKey4);

    await delegate(delegator3, [await registeredCluster3.getAddress()], [4], [1000000]);
    // await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
    // wait 1 day

    let pondToUse = BigNumber.from(10).pow(18).mul(1000000).toString(); // 1 million pond

    await pondInstance.transfer(receiverStakerAddress, pondToUse);
    await pondInstance.connect(receiverStaker).approve(receiverStaking.address, pondToUse);
    await receiverStaking.connect(receiverStaker).deposit(pondToUse); // 1 million pond

    let epoch = (await mineTillGivenClusterIsSelected(receiverStaking, epochSelectorInstance, registeredCluster3)).toString();

    await clusterRewardsInstance
      .connect(receiverStaker)
      .issueTickets(ethers.utils.id("DOT"), epoch, [await registeredCluster3.getAddress()], [BigNumber.from(10).pow(18)]);

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    const clusterReward = await clusterRewardsInstance.clusterRewards(await registeredCluster3.getAddress());
    const clusterCommission = Math.ceil((Number(clusterReward) / 100) * commission);

    const delegatorOldBalance = await pondInstance.balanceOf(await delegator3.getAddress());
    expect(Number(delegatorOldBalance)).to.equal(0);
    await rewardDelegatorsInstance
      .connect(delegator3)
      ["withdrawRewards(address,address[])"](await delegator3.getAddress(), [await registeredCluster3.getAddress()]);
    const delegatorNewBalance = await pondInstance.balanceOf(await delegator3.getAddress());
    expect(Number(delegatorNewBalance)).to.equal(527);
  });

  it.skip("reinitialize contract then delegate and withdraw rewards for single token", async () => {
    // deploy pond and mpond tokens
    const Pond = await ethers.getContractFactory("Pond");
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });
    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), await mpondAccount.getAddress());
    await mpondInstance.transfer(await mpondAccount.getAddress(), BN.from(3000).e18());
    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    // deploy a test erc20 token

    testTokenInstance = await upgrades.deployProxy(Pond, ["TestToken", "TEST"], { kind: "uups" });
    const testTokenId = ethers.utils.keccak256(testTokenInstance.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await clusterRegistryInstance.initialize(lockWaitTimes);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegatorsInstance = await upgrades.deployProxy(
      RewardDelegators,
      [
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [testTokenId],
        [100],
      ],
      { kind: "uups", constructorArgs: [testTokenId, testTokenId] }
    );

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);
    epochSelectorInstance = await EpochSelector.deploy(
      addrs[0],
      numberOfClustersToSelect,
      blockData.timestamp,
      pondInstance.address,
      BigNumber.from(10).pow(20)
    );

    let role = await epochSelectorInstance.UPDATER_ROLE();
    await epochSelectorInstance.connect(signers[0]).grantRole(role, rewardDelegatorsInstance.address);

    await rewardDelegatorsInstance.connect(signers[0]).updateEpochSelector(epochSelectorInstance.address);

    await stakeManagerInstance.initialize(
      [testTokenId],
      [testTokenInstance.address],
      [false, true],
      rewardDelegatorsInstance.address,
      5,
      appConfig.staking.undelegationWaitTime,
      addrs[0]
    );

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(pondInstance.address, addrs[0]);

    await clusterRewardsInstance.initialize(
      addrs[0],
      rewardDelegatorsInstance.address,
      receiverStaking.address,
      epochSelectorInstance.address,
      [ethers.utils.id("testing")],
      [100],
      appConfig.staking.rewardPerEpoch
    );

    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    await pondInstance.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch * 100);

    // register cluster
    await clusterRegistryInstance
      .connect(registeredCluster4)
      .register(ethers.utils.id("DOT"), 10, registeredClusterRewardAddress1, clientKey5);

    await registerCluster(
      10,
      clusterRegistryInstance,
      registeredCluster,
      registeredClusterRewardAddress,
      ethers.utils.id("DOT"),
      clientKey1
    );
    await registerCluster(
      10,
      clusterRegistryInstance,
      registeredCluster2,
      registeredClusterRewardAddress2,
      ethers.utils.id("DOT"),
      clientKey2
    );
    await registerCluster(
      10,
      clusterRegistryInstance,
      registeredCluster3,
      registeredClusterRewardAddress3,
      ethers.utils.id("DOT"),
      clientKey3
    );
    await registerCluster(
      10,
      clusterRegistryInstance,
      registeredCluster1,
      registeredClusterRewardAddress1,
      ethers.utils.id("DOT"),
      clientKey4
    );

    const delegator1BeforeBalance = await pondInstance.balanceOf(await delegator1.getAddress());

    // delegate to the cluster
    await delegateToken(delegator1, [await registeredCluster4.getAddress()], [BigNumber.from(10).pow(18)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster4.getAddress()], [BigNumber.from(10).pow(18).mul(2)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster3.getAddress()], [BigNumber.from(10).pow(18)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster3.getAddress()], [BigNumber.from(10).pow(18).mul(2)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster2.getAddress()], [BigNumber.from(10).pow(18)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster2.getAddress()], [BigNumber.from(10).pow(18).mul(2)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster1.getAddress()], [BigNumber.from(10).pow(18)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster1.getAddress()], [BigNumber.from(10).pow(18).mul(2)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster.getAddress()], [BigNumber.from(10).pow(18)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster.getAddress()], [BigNumber.from(10).pow(18).mul(2)], testTokenInstance);
    await skipBlocks(10);

    // cluster reward

    let pondToUse = BigNumber.from(10).pow(18).mul(1000000).toString(); // 1 million pond

    await pondInstance.transfer(receiverStakerAddress, pondToUse);
    await pondInstance.connect(receiverStaker).approve(receiverStaking.address, pondToUse);
    await receiverStaking.connect(receiverStaker).deposit(pondToUse); // 1 million pond

    let epoch = (await mineTillGivenClusterIsSelected(receiverStaking, epochSelectorInstance, registeredCluster4)).toString();

    await clusterRewardsInstance
      .connect(receiverStaker)
      .issueTickets(ethers.utils.id("DOT"), epoch, [await registeredCluster4.getAddress()], [BigNumber.from(10).pow(18)]);

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const cluster4Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster4.getAddress());
    expect(cluster4Reward).to.equal(10000);

    // transfer POND for rewards
    await pondInstance.transfer(rewardDelegatorsInstance.address, appConfig.staking.rewardPerEpoch * 100);
    await rewardDelegatorsInstance
      .connect(delegator1)
      ["withdrawRewards(address,address)"](await delegator1.getAddress(), await registeredCluster4.getAddress());

    // delegator reward
    const delegator1AfterBalance = await pondInstance.balanceOf(await delegator1.getAddress());
    expect(await delegator1AfterBalance).to.equal(3000);
  });

  it("Add, remove and update reward Factor", async () => {
    const testTokenId = ethers.utils.id("testTokenId");
    // only owner can add the reward factor
    await expect(rewardDelegatorsInstance.connect(signers[1]).addRewardFactor(testTokenId, 10)).to.be.reverted;
    const addRewardTx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).addRewardFactor(testTokenId, 10)).wait();
    expect(addRewardTx.events[0].event).to.equal("AddReward");

    // only owner can update the reward factor
    await expect(rewardDelegatorsInstance.connect(signers[1]).updateRewardFactor(testTokenId, 100)).to.be.reverted;
    const updateRewardTx = await (
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateRewardFactor(testTokenId, 100)
    ).wait();
    expect(updateRewardTx.events[0].event).to.equal("RewardsUpdated");

    // only owner can remove the reward factor
    await expect(rewardDelegatorsInstance.connect(signers[1]).removeRewardFactor(testTokenId)).to.be.reverted;
    const removeRewardTx = await (await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).removeRewardFactor(testTokenId)).wait();
    expect(removeRewardTx.events[0].event).to.equal("RemoveReward");
  });

  it("update stake address", async () => {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    const tempStakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updateStakeAddress(tempStakeManagerInstance.address)).to.be.reverted;
    let tx = await (
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateStakeAddress(tempStakeManagerInstance.address)
    ).wait();
    expect(tx.events[0].event).to.equal("StakeAddressUpdated");

    //change back to original
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateStakeAddress(stakeManagerInstance.address);
  });

  it("update clusterReward address", async () => {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const tempCLusterRewardInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updateClusterRewards(tempCLusterRewardInstance.address)).to.be.reverted;
    let tx = await (
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRewards(tempCLusterRewardInstance.address)
    ).wait();
    expect(tx.events[0].event).to.equal("ClusterRewardsAddressUpdated");

    //change back to original
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRewards(clusterRewardsInstance.address);
  });

  it("update clusterRegistry address", async () => {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const tempCLusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updateClusterRegistry(tempCLusterRegistryInstance.address)).to.be.reverted;
    let tx = await (
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRegistry(tempCLusterRegistryInstance.address)
    ).wait();
    expect(tx.events[0].event).to.equal("ClusterRegistryUpdated");

    //change back to original
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRegistry(clusterRegistryInstance.address);
  });

  it("update POND address", async () => {
    const Pond = await ethers.getContractFactory("Pond");
    const tempPondInstance = await upgrades.deployProxy(Pond, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updatePONDAddress(tempPondInstance.address)).to.be.reverted;
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

  async function skipBlocks(blocks: Number) {
    for (let i = 0; i < blocks; i++) {
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

  async function mineTillGivenClusterIsSelected(
    receiverStaking: Contract,
    epochSelecotor: Contract,
    registeredCluster: Signer
  ): Promise<number | string> {
    let currentEpoch = (await epochSelecotor.getCurrentEpoch()).toString();
    let elementsInTree = await epochSelecotor.totalElements();
    console.log({ elementsInTree });

    for (;;) {
      let clusters = (await epochSelecotor.getClusters(currentEpoch)) as string[];
      console.log({ clusters, currentEpoch });
      clusters = clusters.map((a) => a.toLowerCase());

      let registeredClusterAddress = (await registeredCluster.getAddress()).toLowerCase();

      if (clusters.includes(registeredClusterAddress)) {
        console.log({ clusters, registeredClusterAddress });
        return currentEpoch;
      } else {
        await ethers.provider.send("evm_increaseTime", [4 * 60 * 61]);
        await ethers.provider.send("evm_mine", []);

        await epochSelecotor.connect(registeredCluster).selectClusters();
        currentEpoch = BigNumber.from(currentEpoch.toString()).add(1).toString();
      }
    }
  }

  async function registerCluster(
    commission: number,
    clusterRegistryInstance: Contract,
    registeredCluster: Signer,
    registeredClusterRewardAddress: string,
    networkId: string,
    clientKey1: string
  ) {
    await clusterRegistryInstance.connect(registeredCluster).register(networkId, commission, registeredClusterRewardAddress, clientKey1);
  }
});
