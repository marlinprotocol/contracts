import { ethers, upgrades, network } from "hardhat";
import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";

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

async function skipToTimestamp(t: number) {
  await ethers.provider.send("evm_mine", [t]);
}


let startTime = Math.floor(Date.now()/1000) + 100000;

describe("ClusterSelector", function () {
  let signers: Signer[];
  let addrs: string[];

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
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

  it("deploys with initialization disabled", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await ClusterSelector.deploy(startTime, 900);

    await expect(
      clusterSelector.initialize(
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
      )
    ).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await upgrades.deployProxy(
      ClusterSelector,
      [
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
      ],
      {
        kind: "uups",
        constructorArgs: [startTime, 900],
      },
    );

    expect(await clusterSelector.hasRole(await clusterSelector.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterSelector.hasRole(await clusterSelector.REWARD_CONTROLLER_ROLE(), addrs[0])).to.be.true;
    expect(await clusterSelector.hasRole(await clusterSelector.UPDATER_ROLE(), addrs[11])).to.be.true;
    expect(await clusterSelector.numberOfClustersToSelect()).to.equal(5);
    expect(await clusterSelector.rewardForSelectingClusters()).to.equal(100);
    expect(await clusterSelector.rewardToken()).to.equal(addrs[12]);
    expect(await clusterSelector.START_TIME()).to.equal(startTime);
    expect(await clusterSelector.EPOCH_LENGTH()).to.equal(900);
  });

  it("upgrades", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await upgrades.deployProxy(
      ClusterSelector,
      [
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
      ],
      {
        kind: "uups",
        constructorArgs: [startTime, 900],
      },
    );
    await upgrades.upgradeProxy(clusterSelector.address, ClusterSelector, { kind: "uups", constructorArgs: [startTime, 900] });

    expect(await clusterSelector.hasRole(await clusterSelector.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterSelector.hasRole(await clusterSelector.REWARD_CONTROLLER_ROLE(), addrs[0])).to.be.true;
    expect(await clusterSelector.hasRole(await clusterSelector.UPDATER_ROLE(), addrs[11])).to.be.true;
    expect(await clusterSelector.numberOfClustersToSelect()).to.equal(5);
    expect(await clusterSelector.rewardForSelectingClusters()).to.equal(100);
    expect(await clusterSelector.rewardToken()).to.equal(addrs[12]);
    expect(await clusterSelector.START_TIME()).to.equal(startTime);
    expect(await clusterSelector.EPOCH_LENGTH()).to.equal(900);
  });

  it("does not upgrade without admin", async () => {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await upgrades.deployProxy(
      ClusterSelector,
      [
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
      ],
      {
        kind: "uups",
        constructorArgs: [startTime, 900],
      },
    );

    await expect(upgrades.upgradeProxy(clusterSelector.address, ClusterSelector.connect(signers[1]), { kind: "uups", constructorArgs: [startTime, 900] })).to.be.reverted;
  });
});

testERC165("ClusterSelector", async function (signers: Signer[], addrs: string[]) {
  const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
  let clusterSelector = await upgrades.deployProxy(
    ClusterSelector,
    [
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
    ],
    {
      kind: "uups",
      constructorArgs: [startTime, 900],
    },
  );
  return clusterSelector;
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

testAdminRole("ClusterSelector", async function (signers: Signer[], addrs: string[]) {
  const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
  let clusterSelector = await upgrades.deployProxy(
    ClusterSelector,
    [
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
    ],
    {
      kind: "uups",
      constructorArgs: [startTime, 900],
    },
  );
  return clusterSelector;
});

testRole("ClusterSelector", async function (signers: Signer[], addrs: string[]) {
  const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
  let clusterSelector = await upgrades.deployProxy(
    ClusterSelector,
    [
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
    ],
    {
      kind: "uups",
      constructorArgs: [startTime, 900],
    },
  );
  return clusterSelector;
}, "UPDATER_ROLE");

testRole("ClusterSelector", async function (signers: Signer[], addrs: string[]) {
  const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
  let clusterSelector = await upgrades.deployProxy(
    ClusterSelector,
    [
        addrs[0],
        addrs[11],
        5,
        addrs[12],
        100,
    ],
    {
      kind: "uups",
      constructorArgs: [startTime, 900],
    },
  );
  return clusterSelector;
}, "REWARD_CONTROLLER_ROLE");

describe("ClusterSelector", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterSelector: Contract;

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    clusterSelector = await upgrades.deployProxy(
      ClusterSelector,
      [
          addrs[0],
          addrs[11],
          5,
          addrs[12],
          100,
      ],
      {
        kind: "uups",
        constructorArgs: [startTime, 900],
      },
    );

    expect(await clusterSelector.hasRole(await clusterSelector.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterSelector.hasRole(await clusterSelector.REWARD_CONTROLLER_ROLE(), addrs[0])).to.be.true;
    expect(await clusterSelector.hasRole(await clusterSelector.UPDATER_ROLE(), addrs[11])).to.be.true;
    expect(await clusterSelector.numberOfClustersToSelect()).to.equal(5);
    expect(await clusterSelector.rewardForSelectingClusters()).to.equal(100);
    expect(await clusterSelector.rewardToken()).to.equal(addrs[12]);
    expect(await clusterSelector.START_TIME()).to.equal(startTime);
    expect(await clusterSelector.EPOCH_LENGTH()).to.equal(900);
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

  it("non updater cannot insert nodes", async () => {
    await expect(clusterSelector.insert_unchecked(addrs[31], 31)).to.be.reverted;
  });

  it("updater can insert nodes", async () => {
    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[31], 31);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[31]);
    let nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(2)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[32], 32);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[32]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(3)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[33], 33);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[33]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(33);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(4)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insertMultiple_unchecked([addrs[34], addrs[35], addrs[36]], [34, 35, 36]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(4);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(addrs[34]);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(5);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(addrs[35]);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(6);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(69);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(7)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[37], 37);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(7);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;
  });

  it("non updater cannot update nodes", async () => {
    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[31], 31);
    await expect(clusterSelector.update_unchecked(addrs[31], 41)).to.be.reverted;
  });

  it("updater can update nodes", async () => {
    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[31], 31);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[31]);
    let nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(2)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[32], 32);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[32]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(3)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[33], 33);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[33]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(33);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(4)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insertMultiple_unchecked([addrs[34], addrs[35], addrs[36]], [34, 35, 36]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(4);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(addrs[34]);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(5);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(addrs[35]);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(6);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(69);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(7)).to.be.reverted;

    await clusterSelector.connect(signers[11]).insert_unchecked(addrs[37], 37);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(7);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).update_unchecked(addrs[31], 41);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[31]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).update_unchecked(addrs[32], 22);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[32]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).update_unchecked(addrs[33], 43);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[33]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(116);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsertMultiple([addrs[34], addrs[35], addrs[36]], [24, 45, 26]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(4);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(addrs[34]);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(5);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(addrs[35]);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(6);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).update_unchecked(addrs[37], 47);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(7);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(116);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(47);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(47);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;
  });

  it("non updater cannot upsert nodes", async () => {
    await expect(clusterSelector.upsert(addrs[31], 31)).to.be.reverted;
  });

  it("updater can upsert nodes", async () => {
    await clusterSelector.connect(signers[11]).upsert(addrs[31], 31);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[31]);
    let nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(2)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[32], 32);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[32]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(3)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[33], 33);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[33]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(33);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(4)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsertMultiple([addrs[34], addrs[35], addrs[36]], [34, 35, 36]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(4);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(addrs[34]);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(5);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(addrs[35]);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(6);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(69);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(7)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[37], 37);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(7);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[31], 41);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[31]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[32], 22);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[32]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[33], 43);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[33]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(116);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsertMultiple([addrs[34], addrs[35], addrs[36]], [24, 45, 26]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(4);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(addrs[34]);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(5);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(addrs[35]);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(6);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[37], 47);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(7);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(116);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(47);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(47);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;
  });

  it("non updater cannot delete nodes", async () => {
    await clusterSelector.connect(signers[11]).upsert(addrs[31], 31);
    await expect(clusterSelector.delete_unchecked(addrs[31])).to.be.reverted;
  });

  it("updater can delete nodes", async () => {
    await clusterSelector.connect(signers[11]).upsert(addrs[31], 31);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[31]);
    let nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(2)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[32], 32);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[32]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(3)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[33], 33);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[33]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(32);
    expect(await nodeData.rightSum).to.equal(33);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(4)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsertMultiple([addrs[34], addrs[35], addrs[36]], [34, 35, 36]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(4);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(addrs[34]);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(5);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(addrs[35]);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(6);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(69);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(7)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[37], 37);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(7);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(31);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[31], 41);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[31]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(101);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(32);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[32], 22);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[32]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(33);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[33], 43);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[33]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(116);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(34);
    expect(await nodeData.rightSum).to.equal(35);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(36);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(34);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(35);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(36);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsertMultiple([addrs[34], addrs[35], addrs[36]], [24, 45, 26]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(4);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(addrs[34]);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(5);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(addrs[35]);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(6);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(106);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(37);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(37);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).upsert(addrs[37], 47);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(7);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(41);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(116);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(47);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(7);
    expect(await nodeData.value).to.equal(47);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(8)).to.be.reverted;

    await clusterSelector.connect(signers[11]).deleteIfPresent(addrs[38]);
    await clusterSelector.connect(signers[11]).deleteIfPresent(addrs[31]);

    expect(await clusterSelector.addressToIndexMap(addrs[31])).to.equal(0);
    expect(await clusterSelector.indexToAddressMap(7)).to.equal(ethers.constants.AddressZero);
    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[37]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(47);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(69);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(43);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(6);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(7)).to.be.reverted;

    await clusterSelector.connect(signers[11]).delete_unchecked(addrs[33]);

    expect(await clusterSelector.addressToIndexMap(addrs[33])).to.equal(0);
    expect(await clusterSelector.indexToAddressMap(6)).to.equal(ethers.constants.AddressZero);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(3);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(47);
    expect(await nodeData.leftSum).to.equal(91);
    expect(await nodeData.rightSum).to.equal(26);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(22);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(45);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(5);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(6)).to.be.reverted;

    await clusterSelector.connect(signers[11]).delete_unchecked(addrs[32]);

    expect(await clusterSelector.addressToIndexMap(addrs[32])).to.equal(0);
    expect(await clusterSelector.indexToAddressMap(5)).to.equal(ethers.constants.AddressZero);
    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[35]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(47);
    expect(await nodeData.leftSum).to.equal(69);
    expect(await nodeData.rightSum).to.equal(26);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(24);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(4);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(5)).to.be.reverted;

    await clusterSelector.connect(signers[11]).delete_unchecked(addrs[37]);

    expect(await clusterSelector.addressToIndexMap(addrs[37])).to.equal(0);
    expect(await clusterSelector.indexToAddressMap(4)).to.equal(ethers.constants.AddressZero);
    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(1);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(addrs[34]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(45);
    expect(await nodeData.rightSum).to.equal(26);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(45);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(3);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(4)).to.be.reverted;

    await clusterSelector.connect(signers[11]).delete_unchecked(addrs[35]);

    expect(await clusterSelector.addressToIndexMap(addrs[35])).to.equal(0);
    expect(await clusterSelector.indexToAddressMap(3)).to.equal(ethers.constants.AddressZero);
    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(2);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(addrs[36]);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(26);
    expect(await nodeData.rightSum).to.equal(0);
    nodeData = await clusterSelector.nodes(2);
    expect(await nodeData.value).to.equal(26);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(3)).to.be.reverted;

    await clusterSelector.connect(signers[11]).delete_unchecked(addrs[36]);

    expect(await clusterSelector.addressToIndexMap(addrs[36])).to.equal(0);
    expect(await clusterSelector.indexToAddressMap(2)).to.equal(ethers.constants.AddressZero);
    nodeData = await clusterSelector.nodes(1);
    expect(await nodeData.value).to.equal(24);
    expect(await nodeData.leftSum).to.equal(0);
    expect(await nodeData.rightSum).to.equal(0);
    await expect(clusterSelector.nodes(2)).to.be.reverted;

    await clusterSelector.connect(signers[11]).delete_unchecked(addrs[34]);

    expect(await clusterSelector.addressToIndexMap(addrs[34])).to.equal(0);
    expect(await clusterSelector.indexToAddressMap(1)).to.equal(ethers.constants.AddressZero);
    await expect(clusterSelector.nodes(1)).to.be.reverted;
  });
});
