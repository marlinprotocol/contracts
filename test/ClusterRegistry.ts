import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";
const appConfig = require("../app-config");

declare module "ethers" {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18));
};

async function skipBlocks(n: number) {
  await Promise.all([...Array(n)].map(async (x) => await ethers.provider.send("evm_mine", [])));
}

async function skipTime(t: number) {
  await ethers.provider.send("evm_increaseTime", [t]);
  await skipBlocks(1);
}

const COMMISSION_LOCK = "0x7877e81172e1242eb265a9ff5a14c913d44197a6e15e0bc1d984f40be9096403";
const SWITCH_NETWORK_LOCK = "0x18981a75d138782f14f3fbd4153783a0dc1558f28dc5538bf045e7de84cb2ae2";
const UNREGISTER_LOCK = "0x027b176aae0bed270786878cbabc238973eac20b1957aae44b82a73cc8c7080c";
const SELECTORS = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
const WAIT_TIMES = [20, 30, 40];

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let pondInstance: Contract;
  let pondTokenId: string;
  let mpondInstance: Contract;
  let mpondTokenId: string;
  let clusterRewardsInstance: Contract;
  let clusterRegistryInstance: Contract;
  let stakeManagerInstance: Contract;
  let rewardDelegators: Contract;

  beforeEach(async function () {
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
  });

  it("deploys with initialization disabled", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistry = await ClusterRegistry.deploy();

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

    await expect(clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address)).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

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

    await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);

    await Promise.all(
      SELECTORS.map(async (s, idx) => {
        expect(await clusterRegistry.lockWaitTime(s)).to.equal(WAIT_TIMES[idx]);
      })
    );
    expect(await clusterRegistry.hasRole(await clusterRegistry.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it("upgrades", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

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

    await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);
    await upgrades.upgradeProxy(clusterRegistry.address, ClusterRegistry, { kind: "uups" });

    await Promise.all(
      SELECTORS.map(async (s, idx) => {
        expect(await clusterRegistry.lockWaitTime(s)).to.equal(WAIT_TIMES[idx]);
      })
    );
    expect(await clusterRegistry.hasRole(await clusterRegistry.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it("does not upgrade without admin", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

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

    await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);
    await expect(upgrades.upgradeProxy(clusterRegistry.address, ClusterRegistry.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let pondInstance: Contract;
  let pondTokenId: string;
  let mpondInstance: Contract;
  let mpondTokenId: string;
  let clusterRewardsInstance: Contract;
  let stakeManagerInstance: Contract;
  let rewardDelegators: Contract;

  beforeEach(async function () {
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

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistry.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );

    await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);
  });

  it("supports ERC167", async function () {
    const iid = ethers.utils.id("supportsInterface(bytes4)").substr(0, 10);
    expect(await clusterRegistry.supportsInterface(iid)).to.be.true;
  });

  it("does not support 0xffffffff", async function () {
    expect(await clusterRegistry.supportsInterface("0xffffffff")).to.be.false;
  });

  function makeInterfaceId(interfaces: string[]): string {
    return ethers.utils.hexlify(
      interfaces.map((i) => ethers.utils.arrayify(ethers.utils.id(i).substr(0, 10))).reduce((i1, i2) => i1.map((i, idx) => i ^ i2[idx]))
    );
  }

  it("supports IAccessControl", async function () {
    let interfaces = [
      "hasRole(bytes32,address)",
      "getRoleAdmin(bytes32)",
      "grantRole(bytes32,address)",
      "revokeRole(bytes32,address)",
      "renounceRole(bytes32,address)",
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await clusterRegistry.supportsInterface(iid)).to.be.true;
  });

  it("supports IAccessControlEnumerable", async function () {
    let interfaces = ["getRoleMember(bytes32,uint256)", "getRoleMemberCount(bytes32)"];
    const iid = makeInterfaceId(interfaces);
    expect(await clusterRegistry.supportsInterface(iid)).to.be.true;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let pondInstance: Contract;
  let pondTokenId: string;
  let mpondInstance: Contract;
  let mpondTokenId: string;
  let clusterRewardsInstance: Contract;
  let stakeManagerInstance: Contract;
  let rewardDelegators: Contract;
  let DEFAULT_ADMIN_ROLE: string;

  beforeEach(async function () {
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

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistry.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );

    await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);
    DEFAULT_ADMIN_ROLE = await clusterRegistry.DEFAULT_ADMIN_ROLE();
  });

  it("admin can grant admin role", async function () {
    await clusterRegistry.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRegistry.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;
  });

  it("non admin cannot grant admin role", async function () {
    await expect(clusterRegistry.connect(signers[1]).grantRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can revoke admin role", async function () {
    await clusterRegistry.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRegistry.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await clusterRegistry.revokeRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRegistry.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it("non admin cannot revoke admin role", async function () {
    await clusterRegistry.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRegistry.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(clusterRegistry.connect(signers[2]).revokeRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can renounce own admin role if there are other admins", async function () {
    await clusterRegistry.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRegistry.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await clusterRegistry.connect(signers[1]).renounceRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRegistry.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it("admin cannot renounce own admin role if there are no other admins", async function () {
    await expect(clusterRegistry.renounceRole(DEFAULT_ADMIN_ROLE, addrs[0])).to.be.reverted;
  });

  it("admin cannot renounce admin role of other admins", async function () {
    await clusterRegistry.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRegistry.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(clusterRegistry.renounceRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let pondInstance: Contract;
  let pondTokenId: string;
  let mpondInstance: Contract;
  let mpondTokenId: string;
  let clusterRewardsInstance: Contract;
  let stakeManagerInstance: Contract;
  let rewardDelegators: Contract;
  let dotEpochSelector: Contract;
  let nearEpochSelector: Contract;
  let receiverStaking: Contract;
  const ETHHASH = ethers.utils.id("ETH");
  const DOTHASH = ethers.utils.id("DOT");
  const NEARHASH = ethers.utils.id("NEAR");
  const NETWORK_IDS = [ETHHASH, DOTHASH, NEARHASH];
  const ETHWEIGHT = 100;
  const DOTWEIGHT = 200;
  const NEARWEIGHT = 300;
  const WEIGHTS = [ETHWEIGHT, DOTWEIGHT, NEARWEIGHT];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const blockData = await ethers.provider.getBlock("latest");


    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    dotEpochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pondInstance.address, ethers.utils.parseEther("1").toString());
    nearEpochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pondInstance.address, ethers.utils.parseEther("1").toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pondInstance.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewardsInstance = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, NETWORK_IDS, WEIGHTS, [
        "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
        dotEpochSelector.address,
        nearEpochSelector.address
      ],60000],
      { kind: "uups" }
    );

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistry.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );

    await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);
    let UPDATER_ROLE = await nearEpochSelector.UPDATER_ROLE();
    await nearEpochSelector.connect(signers[0]).grantRole(UPDATER_ROLE, rewardDelegators.address);
    await dotEpochSelector.connect(signers[0]).grantRole(UPDATER_ROLE, rewardDelegators.address);
  });

  it("can register new cluster", async () => {
    await clusterRegistry.register(DOTHASH, 7, addrs[1], addrs[2]);
    const clusterData = await clusterRegistry.callStatic.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[1]);
    expect(clusterData.clientKey).to.equal(addrs[2]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("cannot register new cluster with commission over 100", async () => {
    await expect(clusterRegistry.register(DOTHASH, 101, addrs[1], addrs[2])).to.be.reverted;
  });

  it("cannot register new cluster with existing client key", async () => {
    await clusterRegistry.register(DOTHASH, 7, addrs[1], addrs[2]);
    const clusterData = await clusterRegistry.callStatic.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[1]);
    expect(clusterData.clientKey).to.equal(addrs[2]);
    expect(clusterData.isValidCluster).to.be.true;

    await expect(clusterRegistry.connect(signers[1]).register(DOTHASH, 101, addrs[3], addrs[2])).to.be.reverted;
  });

  it("cannot register existing cluster again", async () => {
    await clusterRegistry.register(DOTHASH, 7, addrs[1], addrs[2]);
    const clusterData = await clusterRegistry.callStatic.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[1]);
    expect(clusterData.clientKey).to.equal(addrs[2]);
    expect(clusterData.isValidCluster).to.be.true;

    await expect(clusterRegistry.register(DOTHASH, 7, addrs[3], addrs[4])).to.be.reverted;
  });

  it("unregister cluster", async () => {
    await clusterRegistry.register(DOTHASH, 7, addrs[1], addrs[2]);
    const clusterData = await clusterRegistry.callStatic.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[1]);
    expect(clusterData.clientKey).to.equal(addrs[2]);
    expect(clusterData.isValidCluster).to.be.true;

    await expect(clusterRegistry.connect(signers[1]).unregister()).to.be.reverted;

    expect(await clusterRegistry.callStatic.isClusterValid(addrs[0])).to.be.true;
    await clusterRegistry.unregister();
    expect(await clusterRegistry.callStatic.isClusterValid(addrs[0])).to.be.true;
    await skipTime(39);
    expect(await clusterRegistry.callStatic.isClusterValid(addrs[0])).to.be.true;
    await skipTime(2);
    expect(await clusterRegistry.callStatic.isClusterValid(addrs[0])).to.be.false;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let pondInstance: Contract;
  let pondTokenId: string;
  let mpondInstance: Contract;
  let mpondTokenId: string;
  let clusterRewardsInstance: Contract;
  let stakeManagerInstance: Contract;
  let rewardDelegators: Contract;
  let dotEpochSelector: Contract;
  let nearEpochSelector: Contract;
  let receiverStaking: Contract;
  const ETHHASH = ethers.utils.id("ETH");
  const DOTHASH = ethers.utils.id("DOT");
  const NEARHASH = ethers.utils.id("NEAR");
  const NETWORK_IDS = [ETHHASH, DOTHASH, NEARHASH];
  const ETHWEIGHT = 100;
  const DOTWEIGHT = 200;
  const NEARWEIGHT = 300;
  const WEIGHTS = [ETHWEIGHT, DOTWEIGHT, NEARWEIGHT];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pondInstance = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpondInstance = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const blockData = await ethers.provider.getBlock("latest");


    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    dotEpochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pondInstance.address, ethers.utils.parseEther("1").toString());
    nearEpochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pondInstance.address, ethers.utils.parseEther("1").toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pondInstance.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewardsInstance = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, NETWORK_IDS, WEIGHTS, [
        "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
        dotEpochSelector.address,
        nearEpochSelector.address
      ],60000],
      { kind: "uups" }
    );

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistry.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    );

    await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);
    let UPDATER_ROLE = await nearEpochSelector.UPDATER_ROLE();
    await nearEpochSelector.connect(signers[0]).grantRole(UPDATER_ROLE, rewardDelegators.address);
    await dotEpochSelector.connect(signers[0]).grantRole(UPDATER_ROLE, rewardDelegators.address);
    await clusterRegistry.register(DOTHASH, 7, addrs[1], addrs[2]);
  });

  it("updates commission correctly", async () => {
    await expect(clusterRegistry.connect(signers[1]).updateCommission(15)).to.be.reverted;
    await expect(clusterRegistry.updateCommission(150)).to.be.reverted;

    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(7));
    await clusterRegistry.updateCommission(15);
    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(7));
    await skipTime(19);
    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(7));
    await skipTime(2);
    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(15));
  });

  it("switches network correctly", async () => {
    const NEARHASH = ethers.utils.id("NEAR");

    await expect(clusterRegistry.connect(signers[1]).switchNetwork(NEARHASH)).to.be.reverted;

    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    await clusterRegistry.switchNetwork(NEARHASH);
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    await skipTime(29);
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    await skipTime(2);
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(NEARHASH);
  });

  it("updates reward address correctly", async () => {
    await expect(clusterRegistry.connect(signers[1]).updateRewardAddress(addrs[3])).to.be.reverted;

    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[1]);
    await clusterRegistry.updateRewardAddress(addrs[3]);
    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
  });

  it("updates client key correctly", async () => {
    await expect(clusterRegistry.connect(signers[1]).updateClientKey(addrs[3])).to.be.reverted;

    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[2]);
    await clusterRegistry.updateClientKey(addrs[3]);
    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[3]);
  });

  it("updates cluster params correctly", async () => {
    const NEARHASH = ethers.utils.id("NEAR");

    await expect(clusterRegistry.connect(signers[1]).updateCluster(7, DOTHASH, addrs[1], addrs[2])).to.be.reverted;
    await expect(clusterRegistry.updateCluster(150, DOTHASH, addrs[1], addrs[2])).to.be.reverted;

    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(7));
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[1]);
    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[2]);

    await clusterRegistry.updateCluster(15, NEARHASH, addrs[3], addrs[4]);

    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(7));
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

    await skipTime(19);

    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(7));
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

    await skipTime(2);

    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(15));
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

    await skipTime(8);

    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(15));
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(DOTHASH);
    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

    await skipTime(2);

    expect(await clusterRegistry.callStatic.getCommission(addrs[0])).to.equal(BN.from(15));
    expect(await clusterRegistry.callStatic.getNetwork(addrs[0])).to.equal(NEARHASH);
    expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
    expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);
  });
});
