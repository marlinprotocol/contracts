import { ethers, upgrades } from "hardhat";
import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";
const stakingConfig = require("../config/staking.json");

import { testERC165 } from "../helpers/erc165.ts";
import { testAdminRole, testRole } from "../helpers/rbac.ts";


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
const WAIT_TIMES = [120, 300, 600];

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
  });

  it("deploys with initialization disabled", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistry = await ClusterRegistry.deploy();

    await expect(clusterRegistry.initialize(WAIT_TIMES, addrs[11])).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const clusterRegistry = await upgrades.deployProxy(
      ClusterRegistry,
      [
        WAIT_TIMES,
        addrs[11],
      ],
      { kind: "uups" },
    );

    await Promise.all(
      SELECTORS.map(async (s, idx) => {
        expect(await clusterRegistry.lockWaitTime(s)).to.equal(WAIT_TIMES[idx]);
      })
    );
    expect(await clusterRegistry.hasRole(await clusterRegistry.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterRegistry.rewardDelegators()).to.equal(addrs[11]);
  });

  it("upgrades", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const clusterRegistry = await upgrades.deployProxy(
      ClusterRegistry,
      [
        WAIT_TIMES,
        addrs[11],
      ],
      { kind: "uups" },
    );
    await upgrades.upgradeProxy(clusterRegistry.address, ClusterRegistry, { kind: "uups" });

    await Promise.all(
      SELECTORS.map(async (s, idx) => {
        expect(await clusterRegistry.lockWaitTime(s)).to.equal(WAIT_TIMES[idx]);
      })
    );
    expect(await clusterRegistry.hasRole(await clusterRegistry.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterRegistry.rewardDelegators()).to.equal(addrs[11]);
  });

  it("does not upgrade without admin", async function () {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const clusterRegistry = await upgrades.deployProxy(
      ClusterRegistry,
      [
        WAIT_TIMES,
        addrs[11],
      ],
      { kind: "uups" },
    );

    await expect(upgrades.upgradeProxy(clusterRegistry.address, ClusterRegistry.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

testERC165("ClusterRegistry", async function (signers: Signer[], addrs: string[]) {
  const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
  let clusterRegistry = await upgrades.deployProxy(
    ClusterRegistry,
    [
      WAIT_TIMES,
      addrs[11],
    ],
    { kind: "uups" },
  );
  return clusterRegistry;
}, {
  "IAccessControl": [
    "hasRole(bytes32,address)",
    "getRoleAdmin(bytes32)",
    "grantRole(bytes32,address)",
    "revokeRole(bytes32,address)",
    "renounceRole(bytes32,address)",
  ],
  "IAccessControlEnumerable": [
    "getRoleMember(bytes32,uint256)",
    "getRoleMemberCount(bytes32)"
  ],
});

testAdminRole("ClusterRegistry", async function (signers: Signer[], addrs: string[]) {
  const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
  let clusterRegistry = await upgrades.deployProxy(
    ClusterRegistry,
    [
      WAIT_TIMES,
      addrs[11],
    ],
    { kind: "uups" },
  );
  return clusterRegistry;
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("non admin cannot update lockWaitTime", async () => {
    await expect(clusterRegistry.connect(signers[1]).updateLockWaitTime(COMMISSION_LOCK, 10)).to.be.reverted;
    await expect(clusterRegistry.connect(signers[1]).updateLockWaitTime(SWITCH_NETWORK_LOCK, 10)).to.be.reverted;
    await expect(clusterRegistry.connect(signers[1]).updateLockWaitTime(UNREGISTER_LOCK, 10)).to.be.reverted;
  });

  it("admin can update lockWaitTime", async () => {
    await clusterRegistry.updateLockWaitTime(COMMISSION_LOCK, 10);
    expect(await clusterRegistry.lockWaitTime(COMMISSION_LOCK)).to.equal(10);

    await clusterRegistry.updateLockWaitTime(SWITCH_NETWORK_LOCK, 100);
    expect(await clusterRegistry.lockWaitTime(SWITCH_NETWORK_LOCK)).to.equal(100);

    await clusterRegistry.updateLockWaitTime(UNREGISTER_LOCK, 1000);
    expect(await clusterRegistry.lockWaitTime(UNREGISTER_LOCK)).to.equal(1000);
  });

  it("non admin cannot update RewardDelegatorsAddress", async () => {
    await expect(clusterRegistry.connect(signers[1]).updateRewardDelegators(addrs[13])).to.be.reverted;
  });

  it("admin can update RewardDelegatorsAddress", async () => {
    await clusterRegistry.updateRewardDelegators(addrs[13]);
    expect(await clusterRegistry.rewardDelegators()).to.equal(addrs[13]);
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can register new cluster", async () => {
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], DOTHASH).returns();

    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    const clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    expect(await clusterRegistry.clientKeys(addrs[12])).to.equal(addrs[0]);
  });

  it("cannot register new cluster with commission over 100", async () => {
    await rewardDelegators.mock.updateClusterDelegation.returns();

    await expect(clusterRegistry.register(DOTHASH, 101, addrs[1], addrs[2])).to.be.reverted;
  });

  it("cannot register new cluster with existing client key", async () => {
    await rewardDelegators.mock.updateClusterDelegation.returns();

    await clusterRegistry.connect(signers[1]).register(DOTHASH, 7, addrs[11], addrs[12]);
    const clusterData = await clusterRegistry.getCluster(addrs[1]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await expect(clusterRegistry.register(DOTHASH, 7, addrs[13], addrs[12])).to.be.reverted;
  });

  it("cannot register existing cluster again", async () => {
    await rewardDelegators.mock.updateClusterDelegation.returns();

    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    const clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await expect(clusterRegistry.register(DOTHASH, 7, addrs[13], addrs[14])).to.be.reverted;
  });

  it("cannot register existing cluster while unregistering", async () => {
    await rewardDelegators.mock.updateClusterDelegation.returns();
    await rewardDelegators.mock.removeClusterDelegation.returns();

    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    const clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await clusterRegistry.requestUnregister();

    await expect(clusterRegistry.register(DOTHASH, 7, addrs[13], addrs[14])).to.be.reverted;
  });

  it("can register existing cluster after unregistering", async () => {
    await rewardDelegators.mock.updateClusterDelegation.returns();
    await rewardDelegators.mock.removeClusterDelegation.returns();

    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await clusterRegistry.requestUnregister();

    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();

    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], ethers.utils.id("NEAR")).returns();
    await clusterRegistry.register(ethers.utils.id("NEAR"), 17, addrs[21], addrs[22]);
    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(ethers.utils.id("NEAR"));
    expect(clusterData.commission).to.equal(17);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");
  const NEARHASH = ethers.utils.id("NEAR");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();

    clusterData = await clusterRegistry.getRewardInfo(addrs[0]);
    expect(clusterData[0]).to.equal(7);
    expect(clusterData[1]).to.equal(addrs[11]);
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can update commission, network, reward address, client key", async () => {
    await clusterRegistry.updateCluster(70, NEARHASH, addrs[21], addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update commission, network, reward address", async () => {
    await clusterRegistry.updateCluster(70, NEARHASH, addrs[21], ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update commission, network, client key", async () => {
    await clusterRegistry.updateCluster(70, NEARHASH, ethers.constants.AddressZero, addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update commission, reward address, client key", async () => {
    await clusterRegistry.updateCluster(70, ethers.constants.HashZero, addrs[21], addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update network, reward address, client key", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, NEARHASH, addrs[21], addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update commission, network", async () => {
    await clusterRegistry.updateCluster(70, NEARHASH, ethers.constants.AddressZero, ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update commission, reward address", async () => {
    await clusterRegistry.updateCluster(70, ethers.constants.HashZero, addrs[21], ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update commission, client key", async () => {
    await clusterRegistry.updateCluster(70, ethers.constants.HashZero, ethers.constants.AddressZero, addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update network, reward address", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, NEARHASH, addrs[21], ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update network, client key", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, NEARHASH, ethers.constants.AddressZero, addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update reward address, client key", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, ethers.constants.HashZero, addrs[21], addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update commission", async () => {
    await clusterRegistry.updateCluster(70, ethers.constants.HashZero, ethers.constants.AddressZero, ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await clusterRegistry.updateCommission();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update network", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, NEARHASH, ethers.constants.AddressZero, ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await clusterRegistry.switchNetwork();

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update reward address", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, ethers.constants.HashZero, addrs[21], ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update client key", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, ethers.constants.HashZero, ethers.constants.AddressZero, addrs[22]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("can update nothing", async () => {
    await clusterRegistry.updateCluster(ethers.constants.MaxUint256, ethers.constants.HashZero, ethers.constants.AddressZero, ethers.constants.AddressZero);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await skipTime(WAIT_TIMES[0]);
    await expect(clusterRegistry.updateCommission()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0]);
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;

    clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can request commission update", async () => {
    await clusterRegistry.requestCommissionUpdate(70);
  });

  it("cannot request commission update to over 100", async () => {
    await expect(clusterRegistry.requestCommissionUpdate(101)).to.be.reverted;
  });

  it("cannot request commission update if already requested", async () => {
    await clusterRegistry.requestCommissionUpdate(70);
    await expect(clusterRegistry.requestCommissionUpdate(70)).to.be.reverted;
  });

  it("cannot request commission update if never registered", async () => {
    await expect(clusterRegistry.connect(signers[1]).requestCommissionUpdate(70)).to.be.reverted;
  });

  it("cannot request commission update if unregistered", async () => {
    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.reverts();

    await expect(clusterRegistry.requestCommissionUpdate(70)).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can update commission after wait time", async () => {
    await clusterRegistry.requestCommissionUpdate(70);

    await skipTime(WAIT_TIMES[0]);

    await clusterRegistry.updateCommission();

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("cannot update commission again after update", async () => {
    await clusterRegistry.requestCommissionUpdate(70);

    await skipTime(WAIT_TIMES[0]);

    await clusterRegistry.updateCommission();

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(70);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await expect(clusterRegistry.updateCommission()).to.be.reverted;
  });

  it("cannot update commission before wait time", async () => {
    await clusterRegistry.requestCommissionUpdate(70);

    await skipTime(WAIT_TIMES[0] - 10);

    await expect(clusterRegistry.updateCommission()).to.be.reverted;
  });

  it("cannot update commission without request", async () => {
    await skipTime(WAIT_TIMES[0]);

    await expect(clusterRegistry.updateCommission()).to.be.reverted;
  });

  it("cannot update commission if unregistered after request", async () => {
    await clusterRegistry.requestCommissionUpdate(70);

    await skipTime(WAIT_TIMES[0]);

    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.reverts();

    await expect(clusterRegistry.updateCommission()).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");
  const NEARHASH = ethers.utils.id("NEAR");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can request network switch", async () => {
    await clusterRegistry.requestNetworkSwitch(NEARHASH);
  });

  it("cannot request network switch if already requested", async () => {
    await clusterRegistry.requestNetworkSwitch(NEARHASH);
    await expect(clusterRegistry.requestNetworkSwitch(NEARHASH)).to.be.reverted;
  });

  it("cannot request network switch if never registered", async () => {
    await expect(clusterRegistry.connect(signers[1]).requestNetworkSwitch(NEARHASH)).to.be.reverted;
  });

  it("cannot request network switch if unregistered", async () => {
    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.reverts();

    await expect(clusterRegistry.requestNetworkSwitch(NEARHASH)).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");
  const NEARHASH = ethers.utils.id("NEAR");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can switch network after wait time", async () => {
    await clusterRegistry.requestNetworkSwitch(NEARHASH);

    await skipTime(WAIT_TIMES[1]);

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await clusterRegistry.switchNetwork();

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("cannot switch network again after update", async () => {
    await clusterRegistry.requestNetworkSwitch(NEARHASH);

    await skipTime(WAIT_TIMES[1]);

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await clusterRegistry.switchNetwork();

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(NEARHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;

    await expect(clusterRegistry.switchNetwork()).to.be.reverted;
  });

  it("cannot switch network before wait time", async () => {
    await clusterRegistry.requestNetworkSwitch(NEARHASH);

    await skipTime(WAIT_TIMES[1] - 10);

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;
  });

  it("cannot switch network without request", async () => {
    await skipTime(WAIT_TIMES[1]);

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;
  });

  it("cannot switch network if unregistered after request", async () => {
    await clusterRegistry.requestNetworkSwitch(NEARHASH);

    await skipTime(WAIT_TIMES[1]);

    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.reverts();

    await rewardDelegators.mock.removeClusterDelegation.reverts();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await rewardDelegators.mock.updateClusterDelegation.reverts();
    await rewardDelegators.mock.updateClusterDelegation.withArgs(addrs[0], NEARHASH).returns();
    await expect(clusterRegistry.switchNetwork()).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can update client key", async () => {
    await clusterRegistry.updateClientKey(addrs[22]);

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[22]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("cannot update client key to zero address", async () => {
    await expect(clusterRegistry.updateClientKey(ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot update client key to already used key", async () => {
    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.connect(signers[1]).register(ethers.utils.id("NEAR"), 15, addrs[13], addrs[14]);
    let clusterData = await clusterRegistry.getCluster(addrs[1]);
    expect(clusterData.networkId).to.equal(ethers.utils.id("NEAR"));
    expect(clusterData.commission).to.equal(15);
    expect(clusterData.rewardAddress).to.equal(addrs[13]);
    expect(clusterData.clientKey).to.equal(addrs[14]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();

    await expect(clusterRegistry.updateClientKey(addrs[14])).to.be.reverted;
  });

  it("cannot update client key if never registered", async () => {
    await expect(clusterRegistry.connect(signers[1]).updateClientKey(addrs[22])).to.be.reverted;
  });

  it("cannot update client key if unregistered", async () => {
    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.reverts();

    await expect(clusterRegistry.updateClientKey(addrs[22])).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can update reward address", async () => {
    await clusterRegistry.updateRewardAddress(addrs[21]);

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[21]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
  });

  it("cannot update reward address if never registered", async () => {
    await expect(clusterRegistry.connect(signers[1]).updateRewardAddress(addrs[21])).to.be.reverted;
  });

  it("cannot update reward address if unregistered", async () => {
    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.reverts();

    await expect(clusterRegistry.updateRewardAddress(addrs[21])).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can request unregister", async () => {
    await clusterRegistry.requestUnregister();
  });

  it("cannot request unregister if already requested", async () => {
    await clusterRegistry.requestUnregister();
    await expect(clusterRegistry.requestUnregister()).to.be.reverted;
  });

  it("cannot request unregister if never registered", async () => {
    await expect(clusterRegistry.connect(signers[1]).requestUnregister()).to.be.reverted;
  });

  it("cannot request unregister if unregistered", async () => {
    await clusterRegistry.requestUnregister();
    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.reverts();

    await expect(clusterRegistry.requestUnregister()).to.be.reverted;
  });
});

describe("ClusterRegistry", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistry: Contract;
  let rewardDelegators: Contract;
  const DOTHASH = ethers.utils.id("DOT");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await deployMockContract(signers[0], RewardDelegators.interface.format());

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [WAIT_TIMES, rewardDelegators.address], { kind: "uups" });

    await rewardDelegators.mock.updateClusterDelegation.returns();
    await clusterRegistry.register(DOTHASH, 7, addrs[11], addrs[12]);
    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.rewardAddress).to.equal(addrs[11]);
    expect(clusterData.clientKey).to.equal(addrs[12]);
    expect(clusterData.isValidCluster).to.be.true;
    await rewardDelegators.mock.updateClusterDelegation.reverts();
  });

  beforeEach(async function () {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async function () {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  it("can unregister after wait time", async () => {
    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();
    await rewardDelegators.mock.removeClusterDelegation.withArgs(addrs[0], DOTHASH).reverts();

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.isValidCluster).to.be.false;
  });

  it("cannot unregister again after unregister", async () => {
    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);
    await clusterRegistry.unregister();

    let clusterData = await clusterRegistry.getCluster(addrs[0]);
    expect(clusterData.isValidCluster).to.be.false;

    await expect(clusterRegistry.unregister()).to.be.reverted;
  });

  it("cannot unregister before wait time", async () => {
    await clusterRegistry.requestUnregister();

    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2] - 10);

    await expect(clusterRegistry.unregister()).to.be.reverted;
  });

  it("cannot unregister without request", async () => {
    await rewardDelegators.mock.removeClusterDelegation.returns();
    await skipTime(WAIT_TIMES[2]);

    await expect(clusterRegistry.unregister()).to.be.reverted;
  });
});

// describe("ClusterRegistry", function () {
//   let signers: Signer[];
//   let addrs: string[];
//   let clusterRegistry: Contract;
//   let pond: Contract;
//   let pondTokenId: string;
//   let mpond: Contract;
//   let mpondTokenId: string;
//   let clusterRewardsInstance: Contract;
//   let stakeManagerInstance: Contract;
//   let rewardDelegators: Contract;
//   let dotEpochSelector: Contract;
//   let nearEpochSelector: Contract;
//   let receiverStaking: Contract;
//   const ETHHASH = ethers.utils.id("ETH");
//   const DOTHASH = ethers.utils.id("DOT");
//   const NEARHASH = ethers.utils.id("NEAR");
//   const NETWORK_IDS = [ETHHASH, DOTHASH, NEARHASH];
//   const ETHWEIGHT = 100;
//   const DOTWEIGHT = 200;
//   const NEARWEIGHT = 300;
//   const WEIGHTS = [ETHWEIGHT, DOTWEIGHT, NEARWEIGHT];

//   beforeEach(async function () {
//     signers = await ethers.getSigners();
//     addrs = await Promise.all(signers.map((a) => a.getAddress()));

//     const Pond = await ethers.getContractFactory("Pond");
//     pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

//     const MPond = await ethers.getContractFactory("MPond");
//     mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

//     pondTokenId = ethers.utils.keccak256(pond.address);
//     mpondTokenId = ethers.utils.keccak256(mpond.address);

//     const StakeManager = await ethers.getContractFactory("StakeManager");
//     stakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

//     const blockData = await ethers.provider.getBlock("latest");

//     let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
//     receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
//       constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
//       kind: "uups",
//       initializer: false,
//     });

//     await receiverStaking.initialize(addrs[0]);

//     const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
//     rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
//       kind: "uups",
//       initializer: false,
//     });

//     let EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");
//     dotEpochSelector = await upgrades.deployProxy(EpochSelector, [
//       addrs[0],
//       rewardDelegators.address,
//       5,
//       pond.address,
//       ethers.utils.parseEther("1").toString()
//     ], {
//       kind: "uups",
//       constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
//     });

//     nearEpochSelector = await upgrades.deployProxy(EpochSelector, [
//       addrs[0],
//       rewardDelegators.address,
//       5,
//       pond.address,
//       ethers.utils.parseEther("1").toString()
//     ], {
//       kind: "uups",
//       constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
//     });

//     const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
//     clusterRewardsInstance = await upgrades.deployProxy(
//       ClusterRewards,
//       [
//         addrs[0],
//         addrs[1],
//         receiverStaking.address,
//         NETWORK_IDS,
//         WEIGHTS,
//         [
//           "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
//           dotEpochSelector.address,
//           nearEpochSelector.address,
//         ],
//         60000,
//       ],
//       { kind: "uups" }
//     );

//     const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
//     clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

//     await rewardDelegators.initialize(
//       stakeManagerInstance.address,
//       clusterRewardsInstance.address,
//       clusterRegistry.address,
//       pond.address,
//       [pondTokenId, mpondTokenId],
//       [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
//       [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
//       [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
//     );

//     await clusterRegistry.initialize(WAIT_TIMES, rewardDelegators.address);
//     await clusterRegistry.register(DOTHASH, 7, addrs[1], addrs[2]);
//   });

//   it("updates commission correctly", async () => {
//     await expect(clusterRegistry.connect(signers[1]).requestCommissionUpdate(15)).to.be.reverted;
//     // commission can't be more than 100
//     await expect(clusterRegistry.requestCommissionUpdate(150)).to.be.reverted;
//     // can't update without any request
//     await expect(clusterRegistry.updateCommission()).to.be.reverted;

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     await clusterRegistry.requestCommissionUpdate(15);
//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     await skipTime(WAIT_TIMES[0] - 10);
//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     await skipTime(10);
//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     await clusterRegistry.updateCommission();
//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(15));
//     // no request after the previous request was enforced and closed
//     await expect(clusterRegistry.updateCommission()).to.be.reverted;
//   });

//   it("switches network correctly", async () => {
//     const NEARHASH = ethers.utils.id("NEAR");
//     // unregistered  user can't request network switch
//     await expect(clusterRegistry.connect(signers[1]).requestNetworkSwitch(NEARHASH)).to.be.reverted;
//     // can't switch network without any request
//     await expect(clusterRegistry.switchNetwork()).to.be.reverted;

//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     await clusterRegistry.requestNetworkSwitch(NEARHASH);
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     await skipTime(WAIT_TIMES[1] - 10);
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     await skipTime(10);
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     await clusterRegistry.switchNetwork();
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(NEARHASH);
//     // no request after the previous request was enforced and closed
//     await expect(clusterRegistry.switchNetwork()).to.be.reverted;
//   });

//   it("updates reward address correctly", async () => {
//     await expect(clusterRegistry.connect(signers[1]).updateRewardAddress(addrs[3])).to.be.reverted;

//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[1]);
//     await clusterRegistry.updateRewardAddress(addrs[3]);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//   });

//   it("updates client key correctly", async () => {
//     await expect(clusterRegistry.connect(signers[1]).updateClientKey(addrs[3])).to.be.reverted;

//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[2]);
//     await clusterRegistry.updateClientKey(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[3]);
//   });

//   // not relevant anymore as the function is removed
//   it("updates cluster params correctly", async () => {
//     const NEARHASH = ethers.utils.id("NEAR");

//     await expect(clusterRegistry.connect(signers[1]).updateCluster(7, DOTHASH, addrs[1], addrs[2])).to.be.reverted;
//     await expect(clusterRegistry.updateCluster(150, DOTHASH, addrs[1], addrs[2])).to.be.reverted;

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[1]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[2]);

//     await clusterRegistry.updateCluster(15, NEARHASH, addrs[3], addrs[4]);

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

//     await skipTime(WAIT_TIMES[0] - 5);

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

//     await skipTime(10);

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(7));
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

//     // enforce request as wait time is complete
//     await clusterRegistry.updateCommission();
//     // switch network wait time is not over yet
//     await expect(clusterRegistry.switchNetwork()).to.be.reverted;

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(15));
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

//     await skipTime(WAIT_TIMES[1] - WAIT_TIMES[0] - 10);

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(15));
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

//     await skipTime(10);

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(15));
//     // doesn't change yet as request wait time is over but itt is not enforced yet
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(DOTHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);

//     // no request after the previous request was enforced and closed
//     await expect(clusterRegistry.updateCommission()).to.be.reverted;
//     // enforce request as wait time is complete
//     await clusterRegistry.switchNetwork();

//     expect(await clusterRegistry.getCommission(addrs[0])).to.equal(BN.from(15));
//     expect(await clusterRegistry.getNetwork(addrs[0])).to.equal(NEARHASH);
//     expect(await clusterRegistry.getRewardAddress(addrs[0])).to.equal(addrs[3]);
//     expect(await clusterRegistry.getClientKey(addrs[0])).to.equal(addrs[4]);
//   });
// });
