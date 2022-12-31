import { ethers, upgrades, network, waffle } from "hardhat";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";
import { sign } from "crypto";
const appConfig = require("../../app-config");

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

const UNDELEGATION_WAIT_TIME = 604800;
const REDELEGATION_WAIT_TIME = 21600;

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
  });

  it("deploys with initialization disabled", async function () {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManager = await StakeManager.deploy();

    await expect(
      stakeManager.initialize(
        [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
        [addrs[1], addrs[2]],
        [false, true],
        addrs[3],
        REDELEGATION_WAIT_TIME,
        UNDELEGATION_WAIT_TIME,
        addrs[4]
      )
    ).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManager = await upgrades.deployProxy(
      StakeManager,
      [
        [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
        [addrs[1], addrs[2]],
        [false, true],
        addrs[3],
        REDELEGATION_WAIT_TIME,
        UNDELEGATION_WAIT_TIME,
        addrs[4],
      ],
      { kind: "uups" }
    );

    expect(await stakeManager.hasRole(await stakeManager.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await stakeManager.tokens(ethers.utils.id(addrs[1]))).to.equal(addrs[1]);
    expect(await stakeManager.tokens(ethers.utils.id(addrs[2]))).to.equal(addrs[2]);
    expect(await stakeManager.tokenIndex(ethers.utils.id(addrs[1]))).to.equal(0);
    expect(await stakeManager.tokenIndex(ethers.utils.id(addrs[2]))).to.equal(1);
    expect(await stakeManager.tokenList(0)).to.equal(ethers.utils.id(addrs[1]));
    expect(await stakeManager.tokenList(1)).to.equal(ethers.utils.id(addrs[2]));
    expect(await stakeManager.hasRole(await stakeManager.ACTIVE_TOKEN_ROLE(), addrs[1])).to.be.true;
    expect(await stakeManager.hasRole(await stakeManager.ACTIVE_TOKEN_ROLE(), addrs[2])).to.be.true;
    expect(await stakeManager.hasRole(await stakeManager.DELEGATABLE_TOKEN_ROLE(), addrs[1])).to.be.false;
    expect(await stakeManager.hasRole(await stakeManager.DELEGATABLE_TOKEN_ROLE(), addrs[2])).to.be.true;
    expect(await stakeManager.rewardDelegators()).to.equal(addrs[3]);
    expect(await stakeManager.lockWaitTime(ethers.utils.id("REDELEGATION_LOCK"))).to.equal(REDELEGATION_WAIT_TIME);
    expect(await stakeManager.lockWaitTime(ethers.utils.id("UNDELEGATION_LOCK"))).to.equal(UNDELEGATION_WAIT_TIME);
  });

  it("upgrades", async function () {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManager = await upgrades.deployProxy(
      StakeManager,
      [
        [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
        [addrs[1], addrs[2]],
        [false, true],
        addrs[3],
        REDELEGATION_WAIT_TIME,
        UNDELEGATION_WAIT_TIME,
        addrs[4],
      ],
      { kind: "uups" }
    );
    await upgrades.upgradeProxy(stakeManager.address, StakeManager, { kind: "uups" });

    expect(await stakeManager.hasRole(await stakeManager.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await stakeManager.tokens(ethers.utils.id(addrs[1]))).to.equal(addrs[1]);
    expect(await stakeManager.tokens(ethers.utils.id(addrs[2]))).to.equal(addrs[2]);
    expect(await stakeManager.tokenIndex(ethers.utils.id(addrs[1]))).to.equal(0);
    expect(await stakeManager.tokenIndex(ethers.utils.id(addrs[2]))).to.equal(1);
    expect(await stakeManager.tokenList(0)).to.equal(ethers.utils.id(addrs[1]));
    expect(await stakeManager.tokenList(1)).to.equal(ethers.utils.id(addrs[2]));
    expect(await stakeManager.hasRole(await stakeManager.ACTIVE_TOKEN_ROLE(), addrs[1])).to.be.true;
    expect(await stakeManager.hasRole(await stakeManager.ACTIVE_TOKEN_ROLE(), addrs[2])).to.be.true;
    expect(await stakeManager.hasRole(await stakeManager.DELEGATABLE_TOKEN_ROLE(), addrs[1])).to.be.false;
    expect(await stakeManager.hasRole(await stakeManager.DELEGATABLE_TOKEN_ROLE(), addrs[2])).to.be.true;
    expect(await stakeManager.rewardDelegators()).to.equal(addrs[3]);
    expect(await stakeManager.lockWaitTime(ethers.utils.id("REDELEGATION_LOCK"))).to.equal(REDELEGATION_WAIT_TIME);
    expect(await stakeManager.lockWaitTime(ethers.utils.id("UNDELEGATION_LOCK"))).to.equal(UNDELEGATION_WAIT_TIME);
  });

  it("does not upgrade without admin", async () => {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManager = await upgrades.deployProxy(
      StakeManager,
      [
        [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
        [addrs[1], addrs[2]],
        [false, true],
        addrs[3],
        REDELEGATION_WAIT_TIME,
        UNDELEGATION_WAIT_TIME,
        addrs[4],
      ],
      { kind: "uups" }
    );

    await expect(upgrades.upgradeProxy(stakeManager.address, StakeManager.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

testERC165("StakeManager", async function (signers: Signer[], addrs: string[]) {
  const StakeManager = await ethers.getContractFactory("StakeManager");
  let stakeManager = await upgrades.deployProxy(
    StakeManager,
    [
      [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
      [addrs[1], addrs[2]],
      [false, true],
      addrs[3],
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[4],
    ],
    { kind: "uups" }
  );
  return stakeManager;
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

testAdminRole("StakeManager", async function (signers: Signer[], addrs: string[]) {
  const StakeManager = await ethers.getContractFactory("StakeManager");
  let stakeManager = await upgrades.deployProxy(
    StakeManager,
    [
      [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
      [addrs[1], addrs[2]],
      [false, true],
      addrs[3],
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[4],
    ],
    { kind: "uups" }
  );
  return stakeManager;
});

testRole("StakeManager", async function (signers: Signer[], addrs: string[]) {
  const StakeManager = await ethers.getContractFactory("StakeManager");
  let stakeManager = await upgrades.deployProxy(
    StakeManager,
    [
      [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
      [addrs[1], addrs[2]],
      [false, true],
      addrs[3],
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[4],
    ],
    { kind: "uups" }
  );
  return stakeManager;
}, "DELEGATABLE_TOKEN_ROLE");

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let pond: Contract;
  let mpond: Contract;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(
      StakeManager,
      [
        [ethers.utils.id(addrs[1]), ethers.utils.id(addrs[2])],
        [addrs[1], addrs[2]],
        [false, true],
        addrs[3],
        REDELEGATION_WAIT_TIME,
        UNDELEGATION_WAIT_TIME,
        addrs[4],
      ],
      { kind: "uups" }
    );
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
    await expect(stakeManager.connect(signers[1]).updateLockWaitTime(REDELEGATION_LOCK, 10)).to.be.reverted;
    await expect(stakeManager.connect(signers[1]).updateLockWaitTime(UNDELEGATION_LOCK, 10)).to.be.reverted;
  });

  it("admin can update lockWaitTime", async () => {
    await stakeManager.updateLockWaitTime(REDELEGATION_LOCK, 10);
    expect(await stakeManager.lockWaitTime(REDELEGATION_LOCK)).to.equal(10);

    await stakeManager.updateLockWaitTime(UNDELEGATION_LOCK, 100);
    expect(await stakeManager.lockWaitTime(UNDELEGATION_LOCK)).to.equal(100);
  });

  it("non admin cannot update RewardDelegatorsAddress", async () => {
    await expect(stakeManager.connect(signers[1]).updateRewardDelegators(addrs[13])).to.be.reverted;
  });

  it("admin can update RewardDelegatorsAddress", async () => {
    await stakeManager.updateRewardDelegators(addrs[13]);
    expect(await stakeManager.rewardDelegators()).to.equal(addrs[13]);
  });

  it("cannot add already added token", async () => {
    await expect(stakeManager.addToken(ethers.utils.id(addrs[1]), addrs[11])).to.be.reverted;
  });

  it("cannot add token with zero address", async () => {
    await expect(stakeManager.addToken(ethers.utils.id(ethers.constants.AddressZero), ethers.constants.AddressZero)).to.be.reverted;
  });

  it("non admin cannot add token", async () => {
    await expect(stakeManager.connect(signers[1]).addToken(ethers.utils.id(addrs[11]), addrs[11])).to.be.reverted;
  });

  it("admin can add token", async () => {
    let tx = await (await stakeManager.addToken(ethers.utils.id(addrs[11]), addrs[11])).wait();
    expect(tx.events[0].event).to.equal("TokenAdded");
    expect(await stakeManager.tokens(ethers.utils.id(addrs[11]))).to.equal(addrs[11]);
    expect(await stakeManager.hasRole(ethers.utils.id("ACTIVE_TOKEN_ROLE"), addrs[11])).to.be.true;
  });

  it("cannot enable active token", async () => {
    await expect(stakeManager.enableToken(ethers.utils.id(addrs[1]))).to.be.reverted;
  });

  it("non admin cannot enable token", async () => {
    await stakeManager.disableToken(ethers.utils.id(addrs[1]));
    expect(await stakeManager.hasRole(ethers.utils.id("ACTIVE_TOKEN_ROLE"), addrs[1])).to.be.false;
    await expect(stakeManager.connect(signers[1]).enableToken(ethers.utils.id(addrs[1]))).to.be.reverted;
  });

  it("admin can enable token", async () => {
    await stakeManager.disableToken(ethers.utils.id(addrs[1]));
    expect(await stakeManager.hasRole(ethers.utils.id("ACTIVE_TOKEN_ROLE"), addrs[1])).to.be.false;
    await stakeManager.enableToken(ethers.utils.id(addrs[1]));
    expect(await stakeManager.hasRole(ethers.utils.id("ACTIVE_TOKEN_ROLE"), addrs[1])).to.be.true;
  });

  it("cannot disable inactive token", async () => {
    await stakeManager.disableToken(ethers.utils.id(addrs[1]));
    expect(await stakeManager.hasRole(ethers.utils.id("ACTIVE_TOKEN_ROLE"), addrs[1])).to.be.false;
    await expect(stakeManager.disableToken(ethers.utils.id(addrs[1]))).to.be.reverted;
  });

  it("non admin cannot disable token", async () => {
    await expect(stakeManager.connect(signers[1]).disableToken(ethers.utils.id(addrs[1]))).to.be.reverted;
  });

  it("admin can disable token", async () => {
    await stakeManager.disableToken(ethers.utils.id(addrs[1]));
    expect(await stakeManager.hasRole(ethers.utils.id("ACTIVE_TOKEN_ROLE"), addrs[1])).to.be.false;
  });

  it("cannot update token address to zero", async () => {
    await expect(stakeManager.updateToken(ethers.utils.id(addrs[1]), ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot update non existent token", async () => {
    await expect(stakeManager.updateToken(ethers.utils.id(addrs[11]), addrs[11])).to.be.reverted;
  });

  it("non admin cannot update token", async () => {
    await expect(stakeManager.connect(signers[1]).updateToken(ethers.utils.id(addrs[1]), addrs[11])).to.be.reverted;
  });

  it("admin can update token", async () => {
    let tx = await (await stakeManager.updateToken(ethers.utils.id(addrs[1]), addrs[11])).wait();
    expect(tx.events[0].event).to.equal("TokenUpdated");
    expect(await stakeManager.tokens(ethers.utils.id(addrs[1]))).to.equal(addrs[11]);
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      addrs[10],
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );

    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);
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

  it("can create stash with pond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId], [100]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create stash with zero pond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId], [0]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create stash with mpond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([mpondTokenId], [200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can create stash with zero mpond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([mpondTokenId], [0]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create stash with pond and mpond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can create stash with pond and zero mpond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 0]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create stash with mpond and zero pond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [0, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can create stash with zero pond and zero mpond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [0, 0]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("cannot create stash with mismatched token and amount lengths", async () => {
    await expect(stakeManager.createStash([pondTokenId, mpondTokenId], [0])).to.be.reverted;
    await expect(stakeManager.createStash([pondTokenId], [0, 0])).to.be.reverted;
  });

  it("cannot create empty stash", async () => {
    await expect(stakeManager.createStash([], [])).to.be.reverted;
  });

  it("cannot create stash with random token id", async () => {
    await expect(stakeManager.createStash([ethers.utils.id(addrs[11])], [100])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );

    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);
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

  it("can delegate stash with pond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId], [100]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);

    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 0]).returns();

    await stakeManager.delegateStash(stashId, addrs[11]);

    stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can delegate stash with mpond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([mpondTokenId], [200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 200]).returns();

    await stakeManager.delegateStash(stashId, addrs[11]);

    stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can delegate stash with pond and mpond", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();

    await stakeManager.delegateStash(stashId, addrs[11]);

    stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can delegate empty stash", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([mpondTokenId], [0]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);

    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 0]).returns();

    await stakeManager.delegateStash(stashId, addrs[11]);

    stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can delegate stash again after undelegation", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([mpondTokenId], [0]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);
    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);

    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 0]).returns();

    await stakeManager.delegateStash(stashId, addrs[11]);

    stashInfo = await stakeManager.stashes(stashId);
    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);

    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await skipTime(UNDELEGATION_WAIT_TIME);

    stashInfo = await stakeManager.stashes(stashId);
    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);

    await stakeManager.delegateStash(stashId, addrs[11]);

    stashInfo = await stakeManager.stashes(stashId);
    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);

  });

  it("cannot delegate stash to zero address", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.delegateStash(stashId, ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot delegate stash that is already delegated", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.delegateStash(stashId, addrs[11]);
    await expect(stakeManager.delegateStash(stashId, addrs[11])).to.be.reverted;
  });

  it("cannot delegate stash that is being undelegated", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.delegateStash(stashId, addrs[11]);
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await expect(stakeManager.delegateStash(stashId, addrs[11])).to.be.reverted;
  });

  it("cannot delegate third party stash", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.connect(signers[1]).delegateStash(stashId, addrs[11])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );

    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);
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

  it("can create and delegate stash with pond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 0]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId], [100], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create and delegate stash with zero pond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 0]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId], [0], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create and delegate stash with mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 200]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([mpondTokenId], [200], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can create and delegate stash with zero mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 0]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([mpondTokenId], [0], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create and delegate stash with pond and mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 200], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can create and delegate stash with pond and zero mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 0]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 0], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can create and delegate stash with mpond and zero pond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 200]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [0, 200], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can create and delegate stash with zero pond and zero mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 0]).returns();

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [0, 0], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18());
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18());
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("cannot create and delegate stash with pond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([pondTokenId], [100], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with zero pond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([pondTokenId], [0], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with mpond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([mpondTokenId], [200], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with zero mpond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([mpondTokenId], [0], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with pond and mpond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 200], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with pond and zero mpond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 0], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with mpond and zero pond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [0, 200], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with zero pond and zero mpond to zero address", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [0, 0], ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot create and delegate stash with mismatched token and amount lengths", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [0], addrs[11])).to.be.reverted;
    await expect(stakeManager.createStash([pondTokenId], [0, 0])).to.be.reverted;
  });

  it("cannot create and delegate empty stash", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([], [], addrs[11])).to.be.reverted;
  });

  it("cannot create and delegate stash with random token id", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.createStashAndDelegate([ethers.utils.id(addrs[11])], [100], addrs[11])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      addrs[10],
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );

    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
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

  it("can add to undelegated stash with pond", async () => {
    await stakeManager.addToStash(stashId, [pondTokenId], [50]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(150);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(150);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(150));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to undelegated stash with zero pond", async () => {
    await stakeManager.addToStash(stashId, [pondTokenId], [0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to undelegated stash with mpond", async () => {
    await stakeManager.addToStash(stashId, [mpondTokenId], [150]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(350);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);
  });

  it("can add to undelegated stash with zero mpond", async () => {
    await stakeManager.addToStash(stashId, [mpondTokenId], [0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to undelegated stash with pond and mpond", async () => {
    await stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [50, 150]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(150);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(350);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(150);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(150));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);
  });

  it("can add to undelegated stash with pond and zero mpond", async () => {
    await stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [50, 0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(150);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(150);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(150));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to undelegated stash with mpond and zero pond", async () => {
    await stakeManager.addToStash(stashId, [mpondTokenId, pondTokenId], [150, 0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(350);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);
  });

  it("can add to undelegated stash with zero pond and zero mpond", async () => {
    await stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [0, 0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("cannot add to undelegated stash with mismatched token and amount lengths", async () => {
    await expect(stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [0])).to.be.reverted;
    await expect(stakeManager.addToStash(stashId, [pondTokenId], [0, 0])).to.be.reverted;
  });

  // it("cannot add to undelegated stash with nothing", async () => {
  //   await expect(stakeManager.addToStash(stashId, [], [])).to.be.reverted;
  // });

  it("cannot add to undelegated stash with random token id", async () => {
    await expect(stakeManager.addToStash(stashId, [ethers.utils.id(addrs[11])], [100])).to.be.reverted;
  });

  it("cannot add to third party stash", async () => {
    await expect(stakeManager.connect(signers[1]).addToStash(stashId, [pondTokenId, mpondTokenId], [0, 0])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);
    await rewardDelegators.mock.delegate.reverts();

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
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

  it("can add to delegated stash with pond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId], [50]).returns();

    await stakeManager.addToStash(stashId, [pondTokenId], [50]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(150);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(150);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(150));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to delegated stash with zero pond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId], [0]).returns();

    await stakeManager.addToStash(stashId, [pondTokenId], [0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to delegated stash with mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [mpondTokenId], [150]).returns();

    await stakeManager.addToStash(stashId, [mpondTokenId], [150]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(350);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);
  });

  it("can add to delegated stash with zero mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [mpondTokenId], [0]).returns();

    await stakeManager.addToStash(stashId, [mpondTokenId], [0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to delegated stash with pond and mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [50, 150]).returns();

    await stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [50, 150]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(150);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(350);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(150);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(150));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);
  });

  it("can add to delegated stash with pond and zero mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [50, 0]).returns();

    await stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [50, 0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(150);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(150);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(150));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can add to delegated stash with mpond and zero pond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [mpondTokenId, pondTokenId], [150, 0]).returns();

    await stakeManager.addToStash(stashId, [mpondTokenId, pondTokenId], [150, 0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(350);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);
  });

  it("can add to delegated stash with zero pond and zero mpond", async () => {
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [0, 0]).returns();

    await stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [0, 0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("cannot add to delegated stash with mismatched token and amount lengths", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.addToStash(stashId, [pondTokenId, mpondTokenId], [0])).to.be.reverted;
    await expect(stakeManager.addToStash(stashId, [pondTokenId], [0, 0])).to.be.reverted;
  });

  // it("cannot add to delegated stash with nothing", async () => {
  //   await rewardDelegators.mock.delegate.returns();

  //   await expect(stakeManager.addToStash(stashId, [], [])).to.be.reverted;
  // });

  it("cannot add to delegated stash with random token id", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.addToStash(stashId, [ethers.utils.id(addrs[11])], [100])).to.be.reverted;
  });

  it("cannot add to third party stash", async () => {
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.connect(signers[1]).addToStash(stashId, [pondTokenId, mpondTokenId], [0, 0])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
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

  it("can request stash redelegation", async () => {
    await stakeManager.requestStashRedelegation(stashId, addrs[21]);
  });

  it("cannot request redelegation to zero address", async () => {
    await expect(stakeManager.requestStashRedelegation(stashId, ethers.constants.AddressZero)).to.be.reverted;
  });

  it("cannot request redelegation if already requested", async () => {
    await stakeManager.requestStashRedelegation(stashId, addrs[21]);
    await expect(stakeManager.requestStashRedelegation(stashId, addrs[21])).to.be.reverted;
  });

  it("cannot request redelegation if never delegated", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    await expect(stakeManager.requestStashRedelegation(newStashId, addrs[21])).to.be.reverted;
  });

  it("cannot request redelegation if undelegation initiated", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await rewardDelegators.mock.undelegate.reverts();

    await expect(stakeManager.requestStashRedelegation(stashId, addrs[21])).to.be.reverted;
  });

  it("cannot request redelegation if undelegated", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await skipTime(UNDELEGATION_WAIT_TIME);
    await rewardDelegators.mock.undelegate.reverts();

    await expect(stakeManager.requestStashRedelegation(stashId, addrs[21])).to.be.reverted;
  });

  it("cannot request redelegation for third party stash", async () => {
    await expect(stakeManager.connect(signers[1]).requestStashRedelegation(stashId, addrs[21])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  let otherStashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 200], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));
    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 200], addrs[12]);
    otherStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex+1]));

    await rewardDelegators.mock.delegate.reverts();
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

  it("can request multiple redelegations", async () => {
    await stakeManager.requestStashRedelegations([stashId, otherStashId], [addrs[21], addrs[22]]);
  });

  it("cannot request multiple redelegations to zero address", async () => {
    await expect(stakeManager.requestStashRedelegations([stashId, otherStashId], [addrs[21], ethers.constants.AddressZero])).to.be.reverted;
    await expect(stakeManager.requestStashRedelegations([stashId, otherStashId], [ethers.constants.AddressZero, addrs[22]])).to.be.reverted;
    await expect(stakeManager.requestStashRedelegations([stashId, otherStashId], [ethers.constants.AddressZero, ethers.constants.AddressZero])).to.be.reverted;
  });

  it("cannot request multiple redelegations if never delegated", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    await expect(stakeManager.requestStashRedelegations([stashId, newStashId], [addrs[21], addrs[22]])).to.be.reverted;
  });

  it("cannot request multiple redelegations if undelegation initiated", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await rewardDelegators.mock.undelegate.reverts();

    await expect(stakeManager.requestStashRedelegations([stashId, otherStashId], [addrs[21], addrs[22]])).to.be.reverted;
  });

  it("cannot request multiple redelegations if undelegated", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await skipTime(UNDELEGATION_WAIT_TIME);
    await rewardDelegators.mock.undelegate.reverts();

    await expect(stakeManager.requestStashRedelegations([stashId, otherStashId], [addrs[21], addrs[22]])).to.be.reverted;
  });

  it("cannot request multiple redelegations for third party stash", async () => {
    await expect(stakeManager.connect(signers[1]).requestStashRedelegations([stashId, otherStashId], [addrs[21], addrs[22]])).to.be.reverted;
  });

  it("cannot request multiple redelegations with mismatched lengths", async () => {
    await expect(stakeManager.requestStashRedelegations([stashId, otherStashId], [addrs[21]])).to.be.reverted;
    await expect(stakeManager.requestStashRedelegations([stashId], [addrs[21], addrs[22]])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
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

  it("can redelegate after redelegation time", async () => {
    await rewardDelegators.mock.undelegate.reverts();
    await rewardDelegators.mock.undelegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[21], [pondTokenId, mpondTokenId], [100, 200]).returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);

    await skipTime(REDELEGATION_WAIT_TIME);

    await stakeManager.redelegateStash(stashId);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[21]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("cannot redelegate before redelegation time", async () => {
    await rewardDelegators.mock.undelegate.reverts();
    await rewardDelegators.mock.undelegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[21], [pondTokenId, mpondTokenId], [100, 200]).returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);

    await skipTime(REDELEGATION_WAIT_TIME - 5);

    await expect(stakeManager.redelegateStash(stashId)).to.be.reverted;
  });

  it("cannot redelegate without request", async () => {
    await rewardDelegators.mock.undelegate.reverts();
    await rewardDelegators.mock.undelegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[21], [pondTokenId, mpondTokenId], [100, 200]).returns();

    await skipTime(REDELEGATION_WAIT_TIME);

    await expect(stakeManager.redelegateStash(stashId)).to.be.reverted;
  });

  it("cannot redelegate if undelegated after request", async () => {
    await rewardDelegators.mock.undelegate.reverts();
    await rewardDelegators.mock.undelegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[21], [pondTokenId, mpondTokenId], [100, 200]).returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);
    await stakeManager.undelegateStash(stashId);

    await skipTime(REDELEGATION_WAIT_TIME);

    await expect(stakeManager.redelegateStash(stashId)).to.be.reverted;
  });

  it("cannot redelegate if request is cancelled", async () => {
    await rewardDelegators.mock.undelegate.reverts();
    await rewardDelegators.mock.undelegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[21], [pondTokenId, mpondTokenId], [100, 200]).returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);
    await stakeManager.cancelRedelegation(stashId);

    await skipTime(REDELEGATION_WAIT_TIME);

    await expect(stakeManager.redelegateStash(stashId)).to.be.reverted;
  });

  it("cannot redelegate third party stash", async () => {
    await rewardDelegators.mock.undelegate.reverts();
    await rewardDelegators.mock.undelegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();
    await rewardDelegators.mock.delegate.reverts();
    await rewardDelegators.mock.delegate.withArgs(addrs[0], addrs[21], [pondTokenId, mpondTokenId], [100, 200]).returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);

    await skipTime(REDELEGATION_WAIT_TIME);

    await expect(stakeManager.connect(signers[1]).redelegateStashes([stashId])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
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

  it("can cancel redelegation after redelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);

    await skipTime(REDELEGATION_WAIT_TIME);

    await stakeManager.cancelRedelegation(stashId);

    await expect(stakeManager.redelegateStash(stashId)).to.be.reverted;
  });

  it("can cancel redelegation before redelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);

    await skipTime(REDELEGATION_WAIT_TIME - 10);

    await stakeManager.cancelRedelegation(stashId);

    await skipTime(10);

    await expect(stakeManager.redelegateStash(stashId)).to.be.reverted;
  });

  it("cannot cancel redelegation without request", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await skipTime(REDELEGATION_WAIT_TIME);

    await expect(stakeManager.cancelRedelegation(stashId)).to.be.reverted;
  });

  it("cannot cancel redelegation for third party stash", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.requestStashRedelegation(stashId, addrs[21]);

    await skipTime(REDELEGATION_WAIT_TIME);

    await expect(stakeManager.connect(signers[1]).cancelRedelegation(stashId)).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
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

  it("can split stash", async () => {
    const stashIndex = await stakeManager.stashIndex();

    await stakeManager.splitStash(stashId, [pondTokenId, mpondTokenId], [75, 150]);

    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(25);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(50);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    let newStashInfo = await stakeManager.stashes(newStashId);

    expect(newStashInfo.staker).to.equal(addrs[0]);
    expect(newStashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(newStashId, pondTokenId)).to.equal(75);
    expect(await stakeManager.stashes__amounts(newStashId, mpondTokenId)).to.equal(150);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("cannot split stash with nothing", async () => {
    await expect(stakeManager.splitStash(stashId, [], [])).to.be.reverted;
  });

  it("cannot split stash with mismatched lengths", async () => {
    await expect(stakeManager.splitStash(stashId, [pondTokenId, mpondTokenId], [75])).to.be.reverted;
    await expect(stakeManager.splitStash(stashId, [pondTokenId], [75, 150])).to.be.reverted;
  });

  it("cannot split stash with more tokens than in stash", async () => {
    await expect(stakeManager.splitStash(stashId, [pondTokenId, mpondTokenId], [101, 201])).to.be.reverted;
  });

  it("cannot split third party stash", async () => {
    await expect(stakeManager.connect(signers[1]).splitStash(stashId, [pondTokenId, mpondTokenId], [75, 150])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  let otherStashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 200], addrs[11]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));
    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [75, 150], addrs[11]);
    otherStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex+1]));

    await rewardDelegators.mock.delegate.reverts();
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

  it("can merge", async () => {
    await stakeManager.mergeStash(stashId, otherStashId);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(175);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(350);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(175);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(175));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);

    let otherStashInfo = await stakeManager.stashes(otherStashId);

    expect(otherStashInfo.staker).to.equal(ethers.constants.AddressZero);
    expect(otherStashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(otherStashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(otherStashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(175);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(350);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(175));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(350));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(350);
  });

  it("cannot merge stash with itself", async () => {
    await expect(stakeManager.mergeStash(stashId, stashId)).to.be.reverted;
  });

  it("cannot merge stashes delegated to different clusters", async () => {
    await rewardDelegators.mock.delegate.returns();
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStashAndDelegate([pondTokenId, mpondTokenId], [100, 200], addrs[12]);
    let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    await expect(stakeManager.mergeStash(stashId, newStashId)).to.be.reverted;
    await expect(stakeManager.mergeStash(newStashId, stashId)).to.be.reverted;
  });

  it("cannot merge if one is never delegated", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    await expect(stakeManager.mergeStash(stashId, newStashId)).to.be.reverted;
    await expect(stakeManager.mergeStash(newStashId, stashId)).to.be.reverted;
  });

  it("cannot merge if one is being undelegated", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);

    await expect(stakeManager.mergeStash(stashId, otherStashId)).to.be.reverted;
    await expect(stakeManager.mergeStash(otherStashId, stashId)).to.be.reverted;
  });

  it("cannot merge if one is being redelegated", async () => {
    await stakeManager.requestStashRedelegation(stashId, addrs[12]);

    await expect(stakeManager.mergeStash(stashId, otherStashId)).to.be.reverted;
    await expect(stakeManager.mergeStash(otherStashId, stashId)).to.be.reverted;
  });

  it("cannot merge if one is third party", async () => {
    await rewardDelegators.mock.delegate.returns();
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.connect(signers[1]).createStashAndDelegate([pondTokenId, mpondTokenId], [0, 0], addrs[11]);
    let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    await expect(stakeManager.mergeStash(stashId, newStashId)).to.be.reverted;
    await expect(stakeManager.mergeStash(newStashId, stashId)).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
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

  it("can request undelegation", async () => {
    await rewardDelegators.mock.undelegate.reverts();
    await rewardDelegators.mock.undelegate.withArgs(addrs[0], addrs[11], [pondTokenId, mpondTokenId], [100, 200]).returns();
    await stakeManager.undelegateStash(stashId);
  });

  it("cannot request undelegation if already requested", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await expect(stakeManager.undelegateStash(stashId)).to.be.reverted;
  });

  it("cannot request undelegation if never delegated", async () => {
    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));

    await rewardDelegators.mock.undelegate.returns();
    await expect(stakeManager.undelegateStash(newStashId)).to.be.reverted;
  });

  it("cannot request undelegation if undelegated", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await stakeManager.undelegateStash(stashId);
    await skipTime(UNDELEGATION_WAIT_TIME);

    await expect(stakeManager.undelegateStash(stashId)).to.be.reverted;
  });

  it("cannot request undelegation for third party stash", async () => {
    await expect(stakeManager.connect(signers[1]).undelegateStashes([stashId])).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
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

  it("can cancel undelegation before undelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME - 10);

    await stakeManager.cancelUndelegation(stashId);

    await skipTime(10);

    await expect(stakeManager["withdrawStash(bytes32)"](stashId)).to.be.reverted;
  });

  it("cannot cancel undelegation after undelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await expect(stakeManager.cancelUndelegation(stashId)).to.be.reverted;
  });

  it("cannot cancel undelegation without request", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await expect(stakeManager.cancelUndelegation(stashId)).to.be.reverted;
  });

  it("cannot cancel undelegation for third party stash", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.undelegateStash(stashId);

    await expect(stakeManager.connect(signers[1]).cancelUndelegation(stashId)).to.be.reverted;
  });
});

describe("StakeManager", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let pond: Contract;
  let mpond: Contract;
  let pondTokenId: String;
  let mpondTokenId: String;
  let stashId: String;
  const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
  const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

  let snapshot: any;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    // mock reward delegators
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await waffle.deployMockContract(signers[0], RewardDelegators.interface.format());
    await rewardDelegators.mock.delegate.returns();
    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await stakeManager.initialize(
      [pondTokenId, mpondTokenId],
      [pond.address, mpond.address],
      [false, true],
      rewardDelegators.address,
      REDELEGATION_WAIT_TIME,
      UNDELEGATION_WAIT_TIME,
      addrs[2]
    );
    await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
    await mpond.approve(stakeManager.address, 10000);
    await pond.approve(stakeManager.address, 10000);

    const stashIndex = await stakeManager.stashIndex();
    await stakeManager.createStash([pondTokenId, mpondTokenId], [100, 200]);
    expect(await stakeManager.stashIndex()).to.equal(BN.from(stashIndex).add(1));

    stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
    await stakeManager.delegateStash(stashId, addrs[11]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(addrs[11]);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);

    await rewardDelegators.mock.delegate.reverts();
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

  it("can withdraw all after undelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await stakeManager["withdrawStash(bytes32)"](stashId);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(0);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(0));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(0));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(0);
  });

  it("can withdraw all after undelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [0, 0]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can withdraw pond after undelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId], [50]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(50);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(200);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(50);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(200);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(50));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(200));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(200);
  });

  it("can withdraw mpond after undelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [mpondTokenId], [150]);

    let stashInfo = await stakeManager.stashes(stashId);

    expect(stashInfo.staker).to.equal(addrs[0]);
    expect(stashInfo.delegatedCluster).to.equal(ethers.constants.AddressZero);
    expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(100);
    expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(50);
    expect(await pond.balanceOf(stakeManager.address)).to.equal(100);
    expect(await mpond.balanceOf(stakeManager.address)).to.equal(50);
    expect(await pond.balanceOf(addrs[0])).to.equal(BN.from(1e10).e18().sub(100));
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(1e4).e18().sub(50));
    expect(await mpond.getDelegates(stakeManager.address, addrs[0])).to.equal(50);
  });

  it("cannot withdraw with mismtached lengths", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [mpondTokenId], [100, 150])).to.be.reverted;
    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [150])).to.be.reverted;
  });

  it("cannot withdraw before undelegation time", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME - 10);

    await expect(stakeManager["withdrawStash(bytes32)"](stashId)).to.be.reverted;
    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId], [50])).to.be.reverted;
    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [mpondTokenId], [50])).to.be.reverted;
  });

  it("cannot withdraw without request", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await skipTime(UNDELEGATION_WAIT_TIME);

    await expect(stakeManager["withdrawStash(bytes32)"](stashId)).to.be.reverted;
    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId], [50])).to.be.reverted;
    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [mpondTokenId], [50])).to.be.reverted;
  });

  it("cannot withdraw if request is cancelled", async () => {
    await rewardDelegators.mock.undelegate.returns();
    await rewardDelegators.mock.delegate.returns();

    await stakeManager.undelegateStash(stashId);
    await stakeManager.cancelUndelegation(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await expect(stakeManager["withdrawStash(bytes32)"](stashId)).to.be.reverted;
    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId], [50])).to.be.reverted;
    await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [mpondTokenId], [50])).to.be.reverted;
  });

  it("cannot withdraw third party stash", async () => {
    await rewardDelegators.mock.undelegate.returns();

    await stakeManager.undelegateStash(stashId);

    await skipTime(UNDELEGATION_WAIT_TIME);

    await expect(stakeManager.connect(signers[1])["withdrawStash(bytes32)"](stashId)).to.be.reverted;
    await expect(stakeManager.connect(signers[1])["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId], [50])).to.be.reverted;
    await expect(stakeManager.connect(signers[1])["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [mpondTokenId], [50])).to.be.reverted;
  });
});

// describe("StakeManager", function () {
//   let signers: Signer[];
//   let addrs: string[];
//   let stakeManager: Contract;
//   let pond: Contract;
//   let mpond: Contract;
//   let rewardDelegatorsInstance: Contract;
//   let dotEpochSelectorInstance: Contract;
//   let nearEpochSelectorInstance: Contract;
//   let numberOfClustersToSelect: number = 5;
//   let clusterRewardsInstance: Contract;
//   let clusterRegistryInstance: Contract;
//   let pondTokenId: String;
//   let mpondTokenId: String;
//   const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
//   const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");

//   let snapshot: any;

//   before(async function () {
//     signers = await ethers.getSigners();
//     addrs = await Promise.all(signers.map((a) => a.getAddress()));

//     const Pond = await ethers.getContractFactory("Pond");
//     pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
//     await pond.transfer(addrs[2], 10000);

//     const MPond = await ethers.getContractFactory("MPond");
//     mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
//     await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), addrs[0]);
//     await mpond.transfer(addrs[2], 10000);

//     pondTokenId = ethers.utils.keccak256(pond.address);
//     mpondTokenId = ethers.utils.keccak256(mpond.address);

//     const lockWaitTimes = [4, 10, 22];
//     const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
//     clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

//     const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
//     rewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, {
//       kind: "uups",
//       initializer: false
//     });

//     await clusterRegistryInstance.initialize(lockWaitTimes, rewardDelegatorsInstance.address);

//     const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
//     clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

//     const StakeManager = await ethers.getContractFactory("StakeManager");
//     stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
//     await stakeManager.initialize(
//       [pondTokenId, mpondTokenId],
//       [pond.address, mpond.address],
//       [false, true],
//       rewardDelegatorsInstance.address,
//       5,
//       UNDELEGATION_WAIT_TIME,
//       addrs[2]
//     );

//     await rewardDelegatorsInstance.initialize(
//       stakeManager.address,
//       clusterRewardsInstance.address,
//       clusterRegistryInstance.address,
//       pond.address,
//       [pondTokenId, mpondTokenId],
//       [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor],
//       [appConfig.staking.PondWeightForThreshold, appConfig.staking.MPondWeightForThreshold]
//     );

//     const blockData = await ethers.provider.getBlock("latest");
//     let EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");
//     dotEpochSelectorInstance = await upgrades.deployProxy(EpochSelector, [
//       addrs[0],
//       numberOfClustersToSelect,
//       pond.address,
//       BN.from(10).pow(20)
//     ], {
//       kind: "uups",
//       constructorArgs: [blockData.timestamp]
//     });

//     let role = await dotEpochSelectorInstance.UPDATER_ROLE();
//     await dotEpochSelectorInstance.connect(signers[0]).grantRole(role, rewardDelegatorsInstance.address);

//     nearEpochSelectorInstance = await upgrades.deployProxy(EpochSelector, [
//       addrs[0],
//       numberOfClustersToSelect,
//       pond.address,
//       BN.from(10).pow(20)
//     ], {
//       kind: "uups",
//       constructorArgs: [blockData.timestamp]
//     });
//     await nearEpochSelectorInstance.connect(signers[0]).grantRole(role, rewardDelegatorsInstance.address);

//     let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
//     let receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
//       constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
//       kind: "uups",
//       initializer: false,
//     });

//     await receiverStaking.initialize(addrs[0]);

//     clusterRewardsInstance.initialize(
//       addrs[7],
//       rewardDelegatorsInstance.address,
//       receiverStaking.address,
//       [ethers.utils.id("DOT"), ethers.utils.id("NEAR"), ethers.utils.id("ETH")],
//       [100, 100, 100],
//       [
//         dotEpochSelectorInstance.address,
//         nearEpochSelectorInstance.address, // invalid epoch selector
//         "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
//       ],
//       appConfig.staking.rewardPerEpoch
//     );

//     await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), stakeManager.address);
//     await mpond.connect(signers[2]).approve(stakeManager.address, 10000);
//     await pond.connect(signers[2]).approve(stakeManager.address, 10000);
//   });

//   beforeEach(async function () {
//     snapshot = await network.provider.request({
//       method: "evm_snapshot",
//       params: [],
//     });
//   });

//   afterEach(async function () {
//     await network.provider.request({
//       method: "evm_revert",
//       params: [snapshot],
//     });
//   });

//   it("non staker cannot request stash redelegation", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await expect(stakeManager.requestStashRedelegation(stashId, addrs[13])).to.be.reverted;
//   });

//   it("cannot redelegate to cluster address 0", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await expect(stakeManager.connect(signers[2]).requestStashRedelegation(stashId, ethers.constants.AddressZero)).to.be.reverted;
//   });

//   it("staker can request redelegate", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).requestStashRedelegation(stashId, addrs[10]);
//     let lockId = await ethers.utils.keccak256(
//       ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [ethers.utils.id("REDELEGATION_LOCK"), stashId])
//     );
//     expect((await stakeManager.locks(lockId)).iValue).to.equal(addrs[10]);
//   });

//   it("non staker cannot redelegate stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await clusterRegistryInstance.connect(signers[4]).register(ethers.utils.id("DOT"), 5, addrs[5], addrs[6]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).requestStashRedelegation(stashId, addrs[4]);
//     await expect(stakeManager.redelegateStash(stashId)).to.be.reverted;
//   });

//   it("cannot redelegate stash before unlock", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await clusterRegistryInstance.connect(signers[4]).register(ethers.utils.id("DOT"), 5, addrs[5], addrs[6]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).requestStashRedelegation(stashId, addrs[4]);
//     await expect(stakeManager.connect(signers[2]).redelegateStash(stashId)).to.be.reverted;
//   });

//   it("staker can redelegate stash on unlock", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await clusterRegistryInstance.connect(signers[4]).register(ethers.utils.id("DOT"), 5, addrs[5], addrs[6]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).requestStashRedelegation(stashId, addrs[4]);
//     await skipTime(5);
//     await stakeManager.connect(signers[2]).redelegateStash(stashId);

//     expect((await stakeManager.stashes(stashId)).delegatedCluster).to.equal(addrs[4]);
//   });

//   it("split stash params check", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     // tokens and amounts cannot be empty
//     await expect(stakeManager.connect(signers[2]).splitStash(stashId, [], [])).to.be.reverted;
//     // token and amounts length must be same
//     await expect(stakeManager.connect(signers[2]).splitStash(stashId, [pondTokenId], [50, 51])).to.be.reverted;
//     // amount cannot be greater than the stash
//     await expect(stakeManager.connect(signers[2]).splitStash(stashId, [pondTokenId, mpondTokenId], [101, 102])).to.be.reverted;
//   });

//   it("staker can split stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).splitStash(stashId, [pondTokenId, mpondTokenId], [50, 51]);
//     let newStashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [BN.from(stashIndex).add(1)]));
//     expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(50);
//     expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(50);

//     expect(await stakeManager.stashes__amounts(newStashId, pondTokenId)).to.equal(50);
//     expect(await stakeManager.stashes__amounts(newStashId, mpondTokenId)).to.equal(51);
//     expect((await stakeManager.stashes(newStashId)).delegatedCluster).to.equal(addrs[10]);

//     let lockId = await ethers.utils.keccak256(
//       ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [ethers.utils.id("UNDELEGATION_LOCK"), stashId])
//     );
//     let newLockId = await ethers.utils.keccak256(
//       ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [ethers.utils.id("UNDELEGATION_LOCK"), newStashId])
//     );
//     let newiValue = (await stakeManager.locks(newLockId)).iValue;
//     let newunlockTime = (await stakeManager.locks(newLockId)).unlockTime;

//     expect((await stakeManager.locks(lockId)).iValue).to.equal(newiValue);
//     expect((await stakeManager.locks(lockId)).unlockTime).to.equal(newunlockTime);
//   });

//   it("cannot merge two same stash ids", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await expect(stakeManager.connect(signers[2]).mergeStash(stashId, stashId)).to.be.reverted;
//   });

//   it("cannot merge stash with different delegated clusted", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId1 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     let stashId2 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex + 1]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await clusterRegistryInstance.connect(signers[4]).register(ethers.utils.id("DOT"), 5, addrs[5], addrs[6]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[4]);

//     await expect(stakeManager.connect(signers[2]).mergeStash(stashId1, stashId2)).to.be.reverted;
//   });

//   it("cannot merge with redelegation lock", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId1 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     let stashId2 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex + 1]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await clusterRegistryInstance.connect(signers[4]).register(ethers.utils.id("DOT"), 5, addrs[5], addrs[6]);

//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).requestStashRedelegation(stashId1, addrs[4]);

//     await expect(stakeManager.connect(signers[2]).mergeStash(stashId1, stashId2)).to.be.reverted;
//     // nitin undelegation check as well in a separate test
//   });

//   it("staker can merge stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId1 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     let stashId2 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex + 1]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await clusterRegistryInstance.connect(signers[4]).register(ethers.utils.id("DOT"), 5, addrs[5], addrs[6]);

//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).mergeStash(stashId1, stashId2);
//     expect(await stakeManager.stashes__amounts(stashId1, pondTokenId)).to.equal(200);
//     expect(await stakeManager.stashes__amounts(stashId1, mpondTokenId)).to.equal(202);
//     expect(await stakeManager.stashes__amounts(stashId2, pondTokenId)).to.equal(0);
//     expect(await stakeManager.stashes__amounts(stashId2, mpondTokenId)).to.equal(0);
//   });

//   it("non staker cannot merge stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId1 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     let stashId2 = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex + 1]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await clusterRegistryInstance.connect(signers[4]).register(ethers.utils.id("DOT"), 5, addrs[5], addrs[6]);

//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await expect(stakeManager.mergeStash(stashId1, stashId2)).to.be.reverted;
//   });

//   it("staker can cancel redelegation request", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).requestStashRedelegation(stashId, addrs[10]);
//     let lockId = await ethers.utils.keccak256(
//       ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [ethers.utils.id("REDELEGATION_LOCK"), stashId])
//     );
//     expect((await stakeManager.locks(lockId)).iValue).to.equal(addrs[10]);
//     await stakeManager.connect(signers[2]).cancelRedelegation(stashId);
//     expect((await stakeManager.locks(lockId)).iValue).to.equal(0);
//   });

//   it("non staker cannot cancel redelegation request", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).requestStashRedelegation(stashId, addrs[10]);
//     await expect(stakeManager.cancelRedelegation(stashId)).to.be.reverted;
//   });

//   it("cannot undelegate before delegating", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await stakeManager.connect(signers[2]).createStash([pondTokenId, mpondTokenId], [100, 101]);

//     await expect(stakeManager.connect(signers[2]).undelegateStash(stashId)).to.be.reverted;
//   });

//   it("staker can undelegate stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     expect((await stakeManager.stashes(stashId)).delegatedCluster).to.equal("0x0000000000000000000000000000000000000000");
//     let lockId = await ethers.utils.keccak256(
//       ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [ethers.utils.id("UNDELEGATION_LOCK"), stashId])
//     );
//     expect((await stakeManager.locks(lockId)).iValue).to.equal(addrs[10]);
//   });

//   it("non staker cannot undelegate", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await expect(stakeManager.undelegateStash(stashId)).to.be.reverted;
//   });

//   it("cannot cancel undelegtion after undelegation time", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME);
//     await expect(stakeManager.connect(signers[2]).cancelUndelegation(stashId)).to.be.reverted;
//   });

//   it("staker can cancel undelegation", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await stakeManager.connect(signers[2]).cancelUndelegation(stashId);
//     expect((await stakeManager.stashes(stashId)).delegatedCluster).to.equal(addrs[10]);
//   });

//   it("non staker cannot cancel undelegation", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await expect(stakeManager.cancelUndelegation(stashId)).to.be.reverted;
//   });

//   it("cannot withdraw stash while delegating", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);

//     await expect(stakeManager.connect(signers[2])["withdrawStash(bytes32)"](stashId)).to.be.reverted;
//     await expect(
//       stakeManager.connect(signers[2])["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [50, 50])
//     ).to.be.reverted;
//   });

//   it("cannot withdraw stash while undelegating", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).undelegateStash(stashId);

//     await expect(stakeManager.connect(signers[2])["withdrawStash(bytes32)"](stashId)).to.be.reverted;
//     await expect(
//       stakeManager.connect(signers[2])["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [50, 50])
//     ).to.be.reverted;
//   });

//   it("staker can withdraw complete stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME);

//     await stakeManager.connect(signers[2])["withdrawStash(bytes32)"](stashId);
//     expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(0);
//     expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(0);
//     expect(await pond.balanceOf(addrs[2])).to.equal(10000);
//     expect(await mpond.balanceOf(addrs[2])).to.equal(10000);
//   });

//   it("staker can withdraw partial stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME);

//     await stakeManager.connect(signers[2])["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [50, 50]);
//     expect(await stakeManager.stashes__amounts(stashId, pondTokenId)).to.equal(50);
//     expect(await stakeManager.stashes__amounts(stashId, mpondTokenId)).to.equal(51);
//     expect(await pond.balanceOf(addrs[2])).to.equal(9950);
//     expect(await mpond.balanceOf(addrs[2])).to.equal(9949);
//   });

//   it("staker cannot withdraw more that the existing stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME);

//     await expect(
//       stakeManager.connect(signers[2])["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [150, 150])
//     ).to.be.reverted;
//   });

//   it("non staker cannot withdraw stash", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME);

//     await expect(stakeManager["withdrawStash(bytes32)"](stashId)).to.be.reverted;
//     await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [50, 50])).to.be.reverted;
//   });

//   it("withdraw stash params check", async () => {
//     const stashIndex = await stakeManager.stashIndex();
//     let stashId = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     await clusterRegistryInstance.connect(signers[10]).register(ethers.utils.id("DOT"), 5, addrs[11], addrs[12]);
//     await stakeManager.connect(signers[2]).createStashAndDelegate([pondTokenId, mpondTokenId], [100, 101], addrs[10]);
//     await stakeManager.connect(signers[2]).undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME);

//     // tokenId and amount length should be same
//     await expect(stakeManager["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [pondTokenId, mpondTokenId], [50])).to.be.reverted;
//   });

//   async function skipTime(t: number) {
//     await ethers.provider.send("evm_increaseTime", [t]);
//     await skipBlocks(1);
//   }
//   async function skipBlocks(n: number) {
//     await Promise.all([...Array(n)].map(async (x) => await ethers.provider.send("evm_mine", [])));
//   }
// });

// describe("StakeManager Deployment", function () {
//   let signers: Signer[];
//   let addrs: string[];
//   let feeder: string;
//   let stakeManagerOwner: Signer;
//   let MpondAccount: Signer;
//   let PONDTokenId: string;
//   let MPONDTokenId: string;
//   let pond: Contract;
//   let mpond: Contract;
//   let stakeManagerInstance: Contract;
//   let clusterRegistryInstance: Contract;
//   let clusterRewardsInstance: Contract;
//   let rewardDelegatorsInstance: Contract;
//   let dotEpochSelectorInstance: Contract;
//   let nearEpochSelectorInstance: Contract;
//   const numberOfClustersToSelect: number = 5;
//   const COMMISSION_LOCK = "0x7877e81172e1242eb265a9ff5a14c913d44197a6e15e0bc1d984f40be9096403";
//   const SWITCH_NETWORK_LOCK = "0x18981a75d138782f14f3fbd4153783a0dc1558f28dc5538bf045e7de84cb2ae2";
//   const UNREGISTER_LOCK = "0x027b176aae0bed270786878cbabc238973eac20b1957aae44b82a73cc8c7080c";
//   const REDELEGATION_LOCK = "0xc9fb5027edad04dc7cbd44766b39dcb7d42c498b3b47b80001805039c63cf1e0";
//   const MOND_HASH = "0x9d76bde6f6a1e9bf8e29a98238a6cb26e11f790c4377a675d10c5b375109dbc8";
//   let registeredClusterRewardAddress: string;
//   let registeredClusterClientKey: string;
//   let unregisteredCluster: string;
//   let registeredCluster: Signer;
//   let deregisteredCluster: Signer;
//   let deregisteredClusterRewardAddress: string;
//   let deregisteredClusterClientKey: string;
//   let registeredCluster1: Signer;
//   let registeredCluster1RewardAddress: string;
//   let registeredCluster1ClientKey: string;
//   let registeredCluster2: Signer;
//   let clientKey: string;
//   const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

//   beforeEach(async function () {
//     signers = await ethers.getSigners();
//     addrs = await Promise.all(signers.map((a) => a.getAddress()));
//     MpondAccount = signers[3];
//     registeredClusterRewardAddress = addrs[4];
//     registeredClusterClientKey = addrs[5];
//     registeredCluster = signers[6];
//     feeder = addrs[7];
//     unregisteredCluster = addrs[8];
//     stakeManagerOwner = signers[0];
//     deregisteredClusterRewardAddress = addrs[10];
//     deregisteredClusterClientKey = addrs[11];
//     deregisteredCluster = signers[12];
//     registeredCluster1 = signers[13];
//     registeredCluster1RewardAddress = addrs[14];
//     registeredCluster1ClientKey = addrs[15];
//     registeredCluster2 = signers[16];
//     clientKey = addrs[17];
//   });

//   it("deploys with initialization disabled", async function () {
//     const Pond = await ethers.getContractFactory("Pond");
//     pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });

//     const MPond = await ethers.getContractFactory("MPond");
//     mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
//     await mpond.grantRole(await mpond.WHITELIST_ROLE(), await MpondAccount.getAddress());
//     await mpond.transfer(await MpondAccount.getAddress(), BN.from(3000).e18());

//     PONDTokenId = ethers.utils.keccak256(pond.address);
//     MPONDTokenId = ethers.utils.keccak256(mpond.address);

//     const StakeManager = await ethers.getContractFactory("StakeManager");
//     let stakeManager = await StakeManager.deploy();

//     const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
//     const lockWaitTimes = [4, 10, 22];
//     const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
//     clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

//     const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
//     rewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, {
//       kind: "uups",
//       initializer: false
//     });
//     await clusterRegistryInstance.initialize(lockWaitTimes, rewardDelegatorsInstance.address);

//     const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
//     clusterRewardsInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

//     await expect(
//       stakeManager.initialize(
//         [PONDTokenId, MPONDTokenId],
//         [pond.address, mpond.address],
//         [false, true],
//         rewardDelegatorsInstance.address,
//         5,
//         UNDELEGATION_WAIT_TIME,
//         await stakeManagerOwner.getAddress()
//       )
//     ).to.be.reverted;
//   });

//   it("deploys as proxy and initializes", async function () {
//     const StakeManager = await ethers.getContractFactory("StakeManager");
//     stakeManagerInstance = await upgrades.deployProxy(
//       StakeManager,
//       [
//         [PONDTokenId, MPONDTokenId],
//         [pond.address, mpond.address],
//         [false, true],
//         rewardDelegatorsInstance.address,
//         5,
//         UNDELEGATION_WAIT_TIME,
//         await stakeManagerOwner.getAddress(),
//       ],
//       { kind: "uups" }
//     );

//     await rewardDelegatorsInstance.initialize(
//       stakeManagerInstance.address,
//       clusterRewardsInstance.address,
//       clusterRegistryInstance.address,
//       pond.address,
//       [PONDTokenId, MPONDTokenId],
//       [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor],
//       [appConfig.staking.PondWeightForThreshold, appConfig.staking.MPondWeightForThreshold]
//     );

//     const blockData = await ethers.provider.getBlock("latest");
//     let EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");
//     dotEpochSelectorInstance = await upgrades.deployProxy(EpochSelector, [
//       addrs[0],
//       numberOfClustersToSelect,
//       pond.address,
//       BN.from(10).pow(20)
//     ], {
//       kind: "uups",
//       constructorArgs: [blockData.timestamp]
//     });

//     let role = await dotEpochSelectorInstance.UPDATER_ROLE();
//     await dotEpochSelectorInstance.connect(signers[0]).grantRole(role, rewardDelegatorsInstance.address);

//     nearEpochSelectorInstance = await upgrades.deployProxy(EpochSelector, [
//       addrs[0],
//       numberOfClustersToSelect,
//       pond.address,
//       BN.from(10).pow(20)
//     ], {
//       kind: "uups",
//       constructorArgs: [blockData.timestamp]
//     });
//     await nearEpochSelectorInstance.connect(signers[0]).grantRole(role, rewardDelegatorsInstance.address);

//     let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
//     let receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
//       constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
//       kind: "uups",
//       initializer: false,
//     });

//     await receiverStaking.initialize(addrs[0]);

//     clusterRewardsInstance.initialize(
//       addrs[7],
//       rewardDelegatorsInstance.address,
//       receiverStaking.address,
//       [ethers.utils.id("DOT"), ethers.utils.id("NEAR"), ethers.utils.id("ETH")],
//       [100, 100, 100],
//       [
//         dotEpochSelectorInstance.address,
//         nearEpochSelectorInstance.address, // invalid epoch selector
//         "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
//       ],
//       appConfig.staking.rewardPerEpoch
//     );

//     await mpond.grantRole(await mpond.WHITELIST_ROLE(), stakeManagerInstance.address);
//     expect(await mpond.hasRole(await mpond.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

//     await pond.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch * 100);

//     expect(await stakeManagerInstance.lockWaitTime(REDELEGATION_LOCK)).to.equal(5);
//   });

//   it("upgrades", async function () {
//     const StakeManager = await ethers.getContractFactory("StakeManager");
//     await upgrades.upgradeProxy(stakeManagerInstance.address, StakeManager.connect(stakeManagerOwner), { kind: "uups" });

//     await pond.transfer(clusterRewardsInstance.address, appConfig.staking.rewardPerEpoch * 100);

//     expect(await stakeManagerInstance.lockWaitTime(REDELEGATION_LOCK)).to.equal(5);
//   });

//   it("does not upgrade without admin", async function () {
//     const StakeManager = await ethers.getContractFactory("StakeManager");
//     await expect(upgrades.upgradeProxy(stakeManagerInstance.address, StakeManager.connect(signers[1]), { kind: "uups" })).to.be.reverted;
//   });

//   it("create POND stash", async () => {
//     const amount = 12000000;

//     await pond.approve(stakeManagerInstance.address, 0);
//     await expect(stakeManagerInstance.createStash([PONDTokenId], [1])).to.be.reverted;

//     await pond.approve(stakeManagerInstance.address, amount);
//     expect(await pond.allowance(addrs[0], stakeManagerInstance.address)).to.equal(amount);

//     const prevUserBalance = await pond.balanceOf(addrs[0]);
//     const prevBalLowStash = await pond.balanceOf(stakeManagerInstance.address);

//     // Even if excess amount is approved, only amount mentioned while creating stash should be used and tokens should be transferred to stakingContract.
//     await stakeManagerInstance.createStash([PONDTokenId], [amount - 100]);
//     const postBalLowStash = await pond.balanceOf(stakeManagerInstance.address);
//     const postUserBalance = await pond.balanceOf(addrs[0]);
//     expect(postBalLowStash.sub(prevBalLowStash)).to.equal(amount - 100);
//     expect(prevUserBalance.sub(postUserBalance)).to.equal(amount - 100);

//     await pond.approve(stakeManagerInstance.address, amount);
//     const prevBalEqStash = await pond.balanceOf(stakeManagerInstance.address);
//     // If exact amount is approved, the stash should still be created and tokens transferred to stakingContract with specified amount
//     await stakeManagerInstance.createStash([PONDTokenId], [amount]);
//     const postBalEqStash = await pond.balanceOf(stakeManagerInstance.address);
//     expect(postBalEqStash.sub(prevBalEqStash)).to.equal(amount);

//     // Should revert if trying to createStash with more amount than approved.
//     await pond.approve(stakeManagerInstance.address, amount);
//     await expect(stakeManagerInstance.createStash([PONDTokenId], [amount + 1])).to.be.reverted;

//     // // should revert if trying to createStash with any of the token using 0 amount
//     // await pond.approve(stakeManagerInstance.address, amount);
//     // await expect(stakeManagerInstance.createStash([PONDTokenId], [0])).to.be.reverted;
//     // await expect(stakeManagerInstance.createStash([PONDTokenId, MPONDTokenId], [amount, 0])).to.be.reverted;

//     // // should revert if trying to createStash with same tokenId sent multiple times in same tx
//     // await pond.approve(stakeManagerInstance.address, amount + 2);
//     // await mpond.connect(MpondAccount).transfer(addrs[0], amount);
//     // await mpond.approve(stakeManagerInstance.address, amount);
//     // await expect(stakeManagerInstance.createStash([PONDTokenId, MPONDTokenId, PONDTokenId], [amount, amount, 2])).to.be.reverted;

//     // If multiple stashes with same data are created, stashid should be different for both
//     await pond.approve(stakeManagerInstance.address, amount * 2);
//     let tx1 = await (await stakeManagerInstance.createStash([PONDTokenId], [amount])).wait();
//     let tx2 = await (await stakeManagerInstance.createStash([PONDTokenId], [amount])).wait();

//     expect(getStashId(tx1.events)).to.not.equal(getStashId(tx2.events));
//   });

//   it("create MPOND stash", async () => {
//     const amount = 13000000;

//     await mpond.connect(MpondAccount).transfer(addrs[0], amount * 8);
//     await mpond.approve(stakeManagerInstance.address, 0);
//     // should revert without token allowance
//     await expect(stakeManagerInstance.createStash([MPONDTokenId], [1])).to.be.reverted;

//     await mpond.approve(stakeManagerInstance.address, amount);
//     expect(await mpond.allowance(addrs[0], stakeManagerInstance.address)).to.equal(amount);

//     const prevUserBalance = await mpond.balanceOf(addrs[0]);
//     const prevBalLowStash = await mpond.balanceOf(stakeManagerInstance.address);
//     // Even if excess amount is approved, only amount mentioned while creating stash should be used and tokens should be transferred to stakingContract.
//     let tx = await stakeManagerInstance.createStash([MPONDTokenId], [amount - 100]);
//     const postBalLowStash = await mpond.balanceOf(stakeManagerInstance.address);
//     const postUserBalance = await mpond.balanceOf(addrs[0]);
//     expect(postBalLowStash.sub(prevBalLowStash)).to.equal(amount - 100);
//     expect(prevUserBalance.sub(postUserBalance)).to.equal(amount - 100);

//     await mpond.approve(stakeManagerInstance.address, amount);
//     const prevBalEqStash = await mpond.balanceOf(stakeManagerInstance.address);
//     // If exact amount is approved, the stash should still be created and tokens transferred to stakingContract with specified amount
//     await stakeManagerInstance.createStash([MPONDTokenId], [amount]);
//     const postBalEqStash = await mpond.balanceOf(stakeManagerInstance.address);
//     expect(postBalEqStash.sub(prevBalEqStash)).to.equal(amount);

//     // Should revert if trying to createStash with more amount than approved.
//     await mpond.approve(stakeManagerInstance.address, amount);
//     await expect(stakeManagerInstance.createStash([MPONDTokenId], [amount + 1])).to.be.reverted;

//     // // should revert if trying to createStash with any of the token using 0 amount
//     // await mpond.approve(stakeManagerInstance.address, amount);
//     // await expect(stakeManagerInstance.createStash([MPONDTokenId], [0])).to.be.reverted;
//     // await expect(stakeManagerInstance.createStash([PONDTokenId, MPONDTokenId], [0, amount])).to.be.reverted;

//     // // should revert if trying to createStash with same tokenId sent multiple times in same tx
//     // await mpond.approve(stakeManagerInstance.address, amount + 2);
//     // await pond.approve(stakeManagerInstance.address, amount);
//     // await expect(stakeManagerInstance.createStash([MPONDTokenId, PONDTokenId, MPONDTokenId], [amount, amount, 2])).to.be.reverted;
//     // If multiple stashes with same data are created, stashid should be different for both
//     await mpond.approve(stakeManagerInstance.address, amount * 2);
//     let tx1 = await (await stakeManagerInstance.createStash([MPONDTokenId], [amount])).wait();
//     let tx2 = await (await stakeManagerInstance.createStash([MPONDTokenId], [amount])).wait();
//     expect(getStashId(tx1.events)).to.not.equal(getStashId(tx2.events));
//   });

//   it("Delegate POND stash", async () => {
//     // delegate a stash that is withdrawn before delegating and hence deleted
//     // delegate a stash already delegating
//     // delegate a stash that is undelegating to same cluster
//     // delegate a stash that is undelegating to different cluster
//     // delegate a stash that is undelegated to a different cluster
//     // delegate a stash that is undelegated to same cluster
//     // delegate a stash that is undelegated and some amount is withdrawn
//     // delegate a stash that is undelegated and completely withdrawn, hence deleted
//     // delegate a stash that has multiple tokens
//     // delegate from a stash
//     const amount = 1000000;
//     // register cluster with cluster registry
//     await clusterRegistryInstance
//       .connect(registeredCluster)
//       .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);

//     const clusterInitialPONDDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );

//     const stashId = await createStash(0, amount);
//     const initialStakeContractBalance = (await pond.balanceOf(stakeManagerInstance.address)).toString();
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     const finalStakeContractBalance = (await pond.balanceOf(stakeManagerInstance.address)).toString();
//     const clusterPONDDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);

//     expect(clusterPONDDelegation - clusterInitialPONDDelegation).to.equal(amount);
//     expect(finalStakeContractBalance).to.equal(initialStakeContractBalance);
//   });

//   it("Delegate MPOND stash", async () => {
//     const amount = 1500000;
//     // register cluster with cluster registry
//     await expect(
//       clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey)
//     ).to.be.reverted;

//     const clusterInitialMPONDDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );

//     const stashId = await createStash(amount, 0);
//     const initalStakeContractBalance = await mpond.balanceOf(stakeManagerInstance.address);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     const finalStakeContractBalance = await mpond.balanceOf(stakeManagerInstance.address);
//     const clusterMPONDDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterMPONDDelegation - clusterInitialMPONDDelegation).to.equal(amount);
//     expect(finalStakeContractBalance).to.equal(initalStakeContractBalance);
//   });

//   it("Delegate POND to invalid cluster", async () => {
//     const amount = 900000;
//     const stashId = await createStash(0, amount);
//     await stakeManagerInstance.delegateStash(stashId, unregisteredCluster);
//   });

//   it("Delegate MPOND to invalid cluster", async () => {
//     const amount = 800000;
//     const stashId = await createStash(amount, 0);
//     await stakeManagerInstance.delegateStash(stashId, unregisteredCluster);
//   });

//   it("Delegate MPOND to deregistered cluster", async () => {
//     await clusterRegistryInstance
//       .connect(deregisteredCluster)
//       .register(ethers.utils.id("NEAR"), 5, deregisteredClusterRewardAddress, deregisteredClusterClientKey);
//     await clusterRegistryInstance.connect(deregisteredCluster).unregister();

//     await skipTime(23);

//     const amount = 700000;
//     const stashId = await createStash(amount, 0);

//     await stakeManagerInstance.delegateStash(stashId, await deregisteredCluster.getAddress());
//   });

//   it("Redelegate a undelegated POND stash", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(0, amount);
//     const clusterInitialPONDDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     const clusterFinalDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     expect(clusterFinalDelegation - clusterInitialPONDDelegation).to.equal(amount);
//     // verify if redelegation is allowed after the time period and value changes after delegatedCluster is changed
//     const delegationBeforeRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       PONDTokenId
//     );
//     const prevClusterDelegationBeforeRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     const stakeContractBalanceBeforeRedelegateRequest = await pond.balanceOf(stakeManagerInstance.address);
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     const delegationAfterRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       PONDTokenId
//     );
//     const prevClusterDelegationAfterRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     const stakeContractBalanceAfterRedelegateRequest = await pond.balanceOf(stakeManagerInstance.address);
//     // check if the delegations doesn't change when requested, also the balance of stake contract doesn't change
//     expect(delegationBeforeRedelegateRequest).to.equal(delegationAfterRedelegateRequest);
//     expect(prevClusterDelegationBeforeRedelegateRequest).to.equal(prevClusterDelegationAfterRedelegateRequest);
//     expect(stakeContractBalanceBeforeRedelegateRequest).to.equal(stakeContractBalanceAfterRedelegateRequest);

//     await skipTime(2);
//     await expect(stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress())).to.be.reverted;
//     await expect(stakeManagerInstance.redelegateStash(stashId)).to.be.reverted;
//     await expect(stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress())).to.be.reverted;

//     await stakeManagerInstance.redelegateStash(stashId);
//     const delegationAfterRedelegate = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       PONDTokenId
//     );
//     const prevClusterDelegationAfterRedelegate = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     const stakeContractBalanceAfterRedelegate = await pond.balanceOf(stakeManagerInstance.address);

//     expect((await stakeManagerInstance.stashes(stashId)).delegatedCluster).to.equal(await registeredCluster1.getAddress());
//     expect(delegationAfterRedelegate - delegationAfterRedelegateRequest).to.equal(amount);
//     expect(prevClusterDelegationAfterRedelegateRequest - prevClusterDelegationAfterRedelegate).to.equal(amount);
//     expect(stakeContractBalanceAfterRedelegateRequest).to.equal(stakeContractBalanceAfterRedelegate);
//   });

//   it("Redelegate a undelegated MPOND stash", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     // Redelegate a stash that is delegated to some cluster and check the wait time and updates in cluster delegations
//     const stashId = await createStash(amount, 0);
//     const clusterInitialMPONDDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     const clusterFinalDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterFinalDelegation - clusterInitialMPONDDelegation).to.equal(amount);
//     // verify if redelegation is allowed after the time period and value changes after delegatedCluster is changed
//     const delegationBeforeRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       MPONDTokenId
//     );
//     const prevClusterDelegationBeforeRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const stakeContractBalanceBeforeRedelegateRequest = await mpond.balanceOf(stakeManagerInstance.address);
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     const delegationAfterRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       MPONDTokenId
//     );
//     const prevClusterDelegationAfterRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const stakeContractBalanceAfterRedelegateRequest = await mpond.balanceOf(stakeManagerInstance.address);
//     // check if the delegations doesn't change when requested, also the balance of stake contract doesn't change
//     expect(delegationBeforeRedelegateRequest).to.equal(delegationAfterRedelegateRequest);
//     expect(prevClusterDelegationBeforeRedelegateRequest).to.equal(prevClusterDelegationAfterRedelegateRequest);
//     expect(stakeContractBalanceBeforeRedelegateRequest).to.equal(stakeContractBalanceAfterRedelegateRequest);
//     await expect(stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress())).to.be.reverted;
//     await skipTime(2);
//     await expect(stakeManagerInstance.redelegateStash(stashId)).to.be.reverted;
//     await expect(stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress())).to.be.reverted;
//     await stakeManagerInstance.redelegateStash(stashId);
//     const delegationAfterRedelegate = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       MPONDTokenId
//     );
//     const prevClusterDelegationAfterRedelegate = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const stakeContractBalanceAfterRedelegate = await mpond.balanceOf(stakeManagerInstance.address);
//     expect((await stakeManagerInstance.stashes(stashId)).delegatedCluster).to.equal(await registeredCluster1.getAddress());
//     expect((await stakeManagerInstance.stashes(stashId)).delegatedCluster).to.equal(await registeredCluster1.getAddress());
//     expect(delegationAfterRedelegate - delegationAfterRedelegateRequest).to.equal(amount);
//     expect(prevClusterDelegationAfterRedelegateRequest - prevClusterDelegationAfterRedelegate).to.equal(amount);
//     expect(stakeContractBalanceAfterRedelegateRequest).to.equal(stakeContractBalanceAfterRedelegate);
//   });

//   it("Redelegate to unregistered cluster", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     // Redelegate to invalid cluster
//     const stashId = await createStash(amount, amount);
//     await expect(stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress())).to.be.reverted;
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster2.getAddress());
//     await skipTime(5);
//     await stakeManagerInstance.redelegateStash(stashId);
//   });

//   it("Redelegate to cluster that became invalid after request", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }

//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     // Redelegate to cluster that was valid when placing request then has unregistered(hence invalid) when applying redelegation
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     await clusterRegistryInstance.connect(registeredCluster1).unregister();
//     await skipTime(23);
//     expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress())).to.be.false;
//     await stakeManagerInstance.redelegateStash(stashId);
//   });

//   it("Redelegate a stash to a unregistering cluster", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }

//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     // Redelegate a stash that is undelegating
//     await clusterRegistryInstance.connect(registeredCluster).unregister();
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     await skipTime(4);
//     const delegationAfterRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       MPONDTokenId
//     );
//     const prevClusterDelegationAfterRedelegateRequest = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const stakeContractBalanceAfterRedelegateRequest = await mpond.balanceOf(stakeManagerInstance.address);
//     await stakeManagerInstance.redelegateStash(stashId);
//     const delegationAfterRedelegate = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster1.getAddress(),
//       MPONDTokenId
//     );
//     const prevClusterDelegationAfterRedelegate = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const stakeContractBalanceAfterRedelegate = await mpond.balanceOf(stakeManagerInstance.address);
//     expect((await stakeManagerInstance.stashes(stashId)).delegatedCluster).to.equal(await registeredCluster1.getAddress());
//     expect(delegationAfterRedelegate - delegationAfterRedelegateRequest).to.equal(amount);
//     expect(prevClusterDelegationAfterRedelegateRequest - prevClusterDelegationAfterRedelegate).to.equal(amount);
//     expect(stakeContractBalanceAfterRedelegateRequest).to.equal(stakeContractBalanceAfterRedelegate);
//     await skipTime(18);
//     expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress())).to.be.false;
//   });

//   it("Redelegate a stash to a unregistered cluster", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     await clusterRegistryInstance.connect(registeredCluster1).unregister();
//     // Register redelegate when cluster is undelegating and apply it when undelegated
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     await skipTime(23);
//     expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress())).to.be.false;
//     await stakeManagerInstance.redelegateStash(stashId);
//   });

//   it("Redelegate stash from an unregistered cluster", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     // Redelegate a stash that is undelegated
//     await clusterRegistryInstance.connect(registeredCluster).unregister();
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     await skipTime(23);
//     expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress())).to.be.false;
//     await stakeManagerInstance.redelegateStash(stashId);
//   });

//   it("Redelegate stash that is undelegating", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);

//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     await stakeManagerInstance.undelegateStash(stashId);
//     await expect(stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress())).to.be.reverted;
//   });

//   it("Redelegate cluster when registered and apply when unregistering", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     // Register redelegate when cluster is registered and apply it when unregistering
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     await clusterRegistryInstance.connect(registeredCluster1).unregister();
//     await skipTime(4);
//     await stakeManagerInstance.redelegateStash(stashId);
//     // cleanup unregistration
//     await skipTime(20);
//   });

//   it("Check if redelegation requests before undelegation are applicable after", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     // Register redelegate to a cluster, undelegate and delegate again to another cluster. Now apply redelegation
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     await stakeManagerInstance.undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME + 2);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     await expect(stakeManagerInstance.redelegateStash(stashId)).to.be.reverted;
//   });

//   it("Check if redelegation request remains active even after usage", async () => {
//     const amount = 1000000;
//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     // Register redelegate to a cluster and apply redelegation, undelegate and delegate again to another cluster. Now apply redelegation again
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     await skipTime(4);
//     await stakeManagerInstance.redelegateStash(stashId);
//     await expect(stakeManagerInstance.redelegateStash(stashId)).to.be.reverted;

//     await skipTime(4);
//     await expect(stakeManagerInstance.redelegateStash(stashId)).to.be.reverted;
//     await stakeManagerInstance.undelegateStash(stashId);
//     await skipTime(UNDELEGATION_WAIT_TIME + 2);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());
//     await expect(stakeManagerInstance.redelegateStash(stashId)).to.be.reverted;
//   });
//   // Redelegate a stash that is undelegating
//   // Redelegate a stash that is undelegated
//   // Redelegate a stash that is undelegated and partially withdrawn
//   // Redelegate a stash that is undelegated and fully withdrawn, hence deleted
//   // Redelegate a stash to the same cluster

//   // Register redelegate when cluster is delegated and apply it after undelegated and delegate again. Now apply redelegation again
//   // Register redelegate when cluster is undelegating and apply it after undelegated and delegate again. Now apply redelegation again.

//   it("create and Delegate POND stash", async () => {
//     const amount = 750000;
//     await pond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);

//     await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress());

//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//   });

//   it("create and Delegate MPOND stash", async () => {
//     const amount = 710000;
//     await mpond.connect(MpondAccount).transfer(addrs[0], amount);
//     await mpond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );

//     await stakeManagerInstance.createStashAndDelegate([MPONDTokenId], [amount], await registeredCluster.getAddress());

//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//   });

//   it("Undelegate POND stash", async () => {
//     const amount = 730000;
//     await pond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);

//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     const balanceBefore = await pond.balanceOf(addrs[0]);
//     await stakeManagerInstance.undelegateStash(stashId);
//     const balanceAfter = await pond.balanceOf(addrs[0]);
//     expect(balanceAfter).to.equal(balanceBefore);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);
//   });

//   it("Undelegate MPOND stash", async () => {
//     const amount = 710000;
//     await mpond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([MPONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     const balanceBefore = await mpond.balanceOf(addrs[0]);
//     await stakeManagerInstance.undelegateStash(stashId);
//     const balanceAfter = await mpond.balanceOf(addrs[0]);
//     expect(balanceAfter).to.equal(balanceBefore);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);
//   });

//   it("Undelegate POND stash that doesn't exists", async () => {
//     const amount = 690000;
//     await pond.approve(stakeManagerInstance.address, amount);
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const stashId = getStashId(receipt.events);
//     await stakeManagerInstance.undelegateStash(stashId);

//     await expect(stakeManagerInstance.undelegateStash(stashId)).to.be.reverted;
//   });

//   it("Undelegate MPOND stash that doesn't exists", async () => {
//     const amount = 680000;
//     await mpond.connect(MpondAccount).transfer(addrs[0], amount);
//     await mpond.approve(stakeManagerInstance.address, amount);
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([MPONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const stashId = getStashId(receipt.events);
//     await stakeManagerInstance.undelegateStash(stashId);

//     await expect(stakeManagerInstance.undelegateStash(stashId)).to.be.reverted;
//   });

//   it("Undelegate POND stash from a deregistering cluster", async () => {
//     const amount = 670000;
//     await pond.approve(stakeManagerInstance.address, amount);
//     await clusterRegistryInstance
//       .connect(deregisteredCluster)
//       .register(ethers.utils.id("NEAR"), 5, deregisteredClusterRewardAddress, deregisteredClusterClientKey);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await clusterRegistryInstance.connect(deregisteredCluster).unregister();
//     await skipTime(5);
//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);
//     await skipTime(24);
//   });

//   it("Undelegate POND stash from a deregistered cluster", async () => {
//     const amount = 670000;
//     await pond.approve(stakeManagerInstance.address, amount);
//     await clusterRegistryInstance
//       .connect(deregisteredCluster)
//       .register(ethers.utils.id("NEAR"), 5, deregisteredClusterRewardAddress, deregisteredClusterClientKey);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await clusterRegistryInstance.connect(deregisteredCluster).unregister();
//     await skipTime(23);

//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);
//   });

//   it("Undelegate MPOND stash from a deregistering cluster", async () => {
//     const amount = 660000;
//     await mpond.connect(MpondAccount).transfer(addrs[0], amount);
//     await mpond.approve(stakeManagerInstance.address, amount);
//     await clusterRegistryInstance
//       .connect(deregisteredCluster)
//       .register(ethers.utils.id("NEAR"), 5, deregisteredClusterRewardAddress, deregisteredClusterClientKey);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([MPONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await clusterRegistryInstance.connect(deregisteredCluster).unregister();
//     await skipTime(5);

//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);
//     await skipTime(24);
//   });

//   it("Undelegate MPOND stash from a deregistered cluster", async () => {
//     const amount = 660000;
//     await mpond.connect(MpondAccount).transfer(addrs[0], amount);
//     await mpond.approve(stakeManagerInstance.address, amount);
//     await clusterRegistryInstance
//       .connect(deregisteredCluster)
//       .register(ethers.utils.id("NEAR"), 5, deregisteredClusterRewardAddress, deregisteredClusterClientKey);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([MPONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await clusterRegistryInstance.connect(deregisteredCluster).unregister();
//     await skipTime(23);

//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);
//   });

//   it("Withdraw POND before wait time", async () => {
//     const amount = 650000;
//     await pond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);

//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);

//     await skipTime(UNDELEGATION_WAIT_TIME - 2);

//     await expect(stakeManagerInstance["withdrawStash(bytes32)"](stashId)).to.be.reverted;
//   });

//   it("Withdraw MPOND before wait time", async () => {
//     const amount = 640000;
//     await mpond.connect(MpondAccount).transfer(addrs[0], amount);
//     await mpond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([MPONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);

//     await skipTime(UNDELEGATION_WAIT_TIME - 2);

//     await expect(stakeManagerInstance["withdrawStash(bytes32)"](stashId)).to.be.reverted;
//   });

//   it("Withdraw POND after wait time", async () => {
//     const amount = 630000;
//     await pond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);

//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), PONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       PONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);

//     await skipTime(UNDELEGATION_WAIT_TIME);

//     const balanceBefore = (await pond.balanceOf(addrs[0])).toString();
//     await stakeManagerInstance["withdrawStash(bytes32)"](stashId);
//     const balanceAfter = (await pond.balanceOf(addrs[0])).toString();
//     const increasedBalance = BN.from(balanceBefore).add(amount);
//     expect(increasedBalance).to.equal(balanceAfter);
//   });

//   it("Withdraw MPOND after wait time", async () => {
//     const amount = 620000;
//     await mpond.connect(MpondAccount).transfer(addrs[0], amount);
//     await mpond.approve(stakeManagerInstance.address, amount);

//     const clusterInitialDelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([MPONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const clusterDelegation = await rewardDelegatorsInstance.getClusterDelegation(await registeredCluster.getAddress(), MPONDTokenId);
//     expect(clusterDelegation - clusterInitialDelegation).to.equal(amount);
//     const stashId = getStashId(receipt.events);

//     await stakeManagerInstance.undelegateStash(stashId);
//     const clusterDelegationAfterUndelegation = await rewardDelegatorsInstance.getClusterDelegation(
//       await registeredCluster.getAddress(),
//       MPONDTokenId
//     );
//     expect(clusterInitialDelegation).to.equal(clusterDelegationAfterUndelegation);

//     await skipTime(UNDELEGATION_WAIT_TIME);

//     const balanceBefore = await mpond.balanceOf(addrs[0]);
//     await stakeManagerInstance["withdrawStash(bytes32)"](stashId);
//     const balanceAfter = await mpond.balanceOf(addrs[0]);

//     expect(balanceAfter.sub(balanceBefore)).to.equal(amount);
//   });

//   it("Redelegate POND stash", async () => {});

//   it("Redelegate MPOND stash", async () => {});

//   it("Create POND stash and split", async () => {
//     const amount = 12000000;
//     await pond.approve(stakeManagerInstance.address, amount);

//     let createStashTx = await (await stakeManagerInstance.createStash([PONDTokenId], [amount])).wait();
//     let stashIndex = await stakeManagerInstance.stashIndex();
//     let splitTx = await (await stakeManagerInstance.splitStash(getStashId(createStashTx.events), [PONDTokenId], [amount - 100])).wait();
//     // new stash id must be equal to keccak256(abi.encodePacked(stashIndex))
//     let newStashID = await ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [stashIndex]));
//     expect(getNewStashId(splitTx.events)).equal(newStashID);

//     // new stash should have amount = amount-100
//     let newStashTokenAmt = await stakeManagerInstance.stashes__amounts(getNewStashId(splitTx.events), PONDTokenId);
//     expect(newStashTokenAmt).equal(amount - 100);

//     // old stash shouhld have 100
//     let oldStashTokenAmt = await stakeManagerInstance.stashes__amounts(getStashId(createStashTx.events), PONDTokenId);
//     expect(oldStashTokenAmt).equal(100);
//   });

//   it("Create two stashes and then merge them", async () => {
//     const amount = 1200;
//     await pond.approve(stakeManagerInstance.address, 10 * amount);

//     const createStash1 = await (await stakeManagerInstance.createStash([PONDTokenId], [3 * amount])).wait();
//     const createStash2 = await (await stakeManagerInstance.createStash([PONDTokenId], [7 * amount])).wait();

//     // merge these two stashes
//     await stakeManagerInstance.mergeStash(getStashId(createStash1.events), getStashId(createStash2.events));

//     // check if the amount is added
//     const mergedAmount = await stakeManagerInstance.stashes__amounts(getStashId(createStash1.events), PONDTokenId);
//     expect(mergedAmount).equal(10 * amount);

//     // check if old stash has nothing
//     const oldAmount = await stakeManagerInstance.stashes__amounts(getStashId(createStash2.events), PONDTokenId);
//     expect(oldAmount).equal(0);
//   });

//   it("Request multiple stash redelegations", async () => {
//     const amount = 1000;
//     await pond.approve(stakeManagerInstance.address, amount);
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const stashId1 = getStashId(receipt.events);

//     await pond.approve(stakeManagerInstance.address, amount);
//     const receipt1 = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const stashId2 = getStashId(receipt1.events);

//     let stash1 = await stakeManagerInstance.stashes(stashId1);
//     let stash2 = await stakeManagerInstance.stashes(stashId2);

//     expect(stash1.delegatedCluster.toString()).equal(await registeredCluster.getAddress());
//     expect(stash1.delegatedCluster.toString()).equal(await registeredCluster.getAddress());

//     // register new cluster
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, clientKey);
//     }

//     // request redelegate multiple stashes to new cluster
//     await expect(stakeManagerInstance.requestStashRedelegations(
//       [stashId1],
//       [await registeredCluster1.getAddress(), await registeredCluster1.getAddress()]
//     )).to.be.reverted;
//     const reqRedelTX = await (
//       await stakeManagerInstance.requestStashRedelegations(
//         [stashId1, stashId2],
//         [await registeredCluster1.getAddress(), await registeredCluster1.getAddress()]
//       )
//     ).wait();
//     expect(reqRedelTX.logs.length).equal(2);
//     expect(reqRedelTX.events[0].event).equal("LockCreated");
//     expect(reqRedelTX.events[1].event).equal("LockCreated");

//     stash1 = await stakeManagerInstance.stashes(stashId1);
//     stash2 = await stakeManagerInstance.stashes(stashId2);

//     expect(stash1.delegatedCluster.toString()).equal(await registeredCluster.getAddress());
//     expect(stash2.delegatedCluster.toString()).equal(await registeredCluster.getAddress());

//     await expect(stakeManagerInstance.redelegateStashes([stashId1, stashId2])).to.be.reverted;
//     await skipTime(4);
//     const redelTX = await (await stakeManagerInstance.redelegateStashes([stashId1, stashId2])).wait();

//     stash1 = await stakeManagerInstance.stashes(stashId1);
//     stash2 = await stakeManagerInstance.stashes(stashId2);

//     // expect(redelTX.logs.length).equal(2);
//     // expect(redelTX.events[0].event).equal("Redelegated");
//     // expect(redelTX.events[1].event).equal("Redelegated");
//     expect(stash1.delegatedCluster.toString()).equal(await registeredCluster1.getAddress());
//     expect(stash2.delegatedCluster.toString()).equal(await registeredCluster1.getAddress());
//   });

//   it("Multiple undelegation", async () => {
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, clientKey);
//     }
//     const amount = 1000;
//     await pond.approve(stakeManagerInstance.address, amount);
//     const receipt1 = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const stashId1 = getStashId(receipt1.events);
//     await pond.approve(stakeManagerInstance.address, amount);
//     const receipt2 = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const stashId2 = getStashId(receipt2.events);
//     let stash1 = await stakeManagerInstance.stashes(stashId1);
//     let stash2 = await stakeManagerInstance.stashes(stashId2);
//     expect(stash1.delegatedCluster.toString()).equal(await registeredCluster.getAddress());
//     expect(stash1.delegatedCluster.toString()).equal(await registeredCluster.getAddress());

//     // undel all the stashes
//     const undelTx = await (await stakeManagerInstance.undelegateStashes([stashId1, stashId2])).wait();
//     // expect(undelTx.logs.length).equal(2);
//     // expect(undelTx.events[0].event).equal("StashUndelegated");
//     // expect(undelTx.events[1].event).equal("StashUndelegated");
//     stash1 = await stakeManagerInstance.stashes(stashId1);
//     stash2 = await stakeManagerInstance.stashes(stashId2);
//     expect(stash1.delegatedCluster.toString()).equal(ADDRESS_ZERO);
//     expect(stash2.delegatedCluster.toString()).equal(ADDRESS_ZERO);
//   });

//   it("Redelegate stash and then cancel redeledation", async () => {
//     const amount = 1000000;

//     // register and delegate
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster1.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster1)
//         .register(ethers.utils.id("NEAR"), 10, registeredCluster1RewardAddress, registeredCluster1ClientKey);
//     }
//     const stashId = await createStash(amount, amount);
//     await stakeManagerInstance.delegateStash(stashId, await registeredCluster.getAddress());

//     // Redelegate to cluster that was valid when placing request then has unregistered(hence invalid) when applying redelegation
//     await stakeManagerInstance.requestStashRedelegation(stashId, await registeredCluster1.getAddress());
//     const redeledationLockSelector = ethers.utils.id("REDELEGATION_LOCK");

//     const lockID = await ethers.utils.keccak256(
//       ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [redeledationLockSelector, stashId])
//     );
//     let lock = await stakeManagerInstance.locks(lockID);

//     // fail if unlock block is 0
//     expect(lock.unlockTime).to.not.equal(0);

//     // cancel redelegation
//     const cancelTx = await (await stakeManagerInstance.cancelRedelegation(stashId)).wait();
//     expect(cancelTx.events[0].event).equal("LockDeleted");
//     lock = await stakeManagerInstance.locks(lockID);
//     expect(lock.unlockTime).equal(0);
//   });

//   it("cancel stash undelegation", async () => {
//     if (!(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress()))) {
//       await clusterRegistryInstance
//         .connect(registeredCluster)
//         .register(ethers.utils.id("DOT"), 5, registeredClusterRewardAddress, registeredClusterClientKey);
//     }

//     const amount = 730000;
//     await pond.approve(stakeManagerInstance.address, amount);
//     const receipt = await (
//       await stakeManagerInstance.createStashAndDelegate([PONDTokenId], [amount], await registeredCluster.getAddress())
//     ).wait();
//     const stashId = getStashId(receipt.events);
//     await stakeManagerInstance.undelegateStash(stashId);

//     // cancel undelegation
//     await expect(stakeManagerInstance.connect(signers[1]).cancelUndelegation(stashId)).to.be.reverted;
//     await skipBlocks(4);

//     const cancelTx = await (await stakeManagerInstance.cancelUndelegation(stashId)).wait();
//     // expect(cancelTx.events[0].event).equal("StashUndelegationCancelled");
//     const stash = await stakeManagerInstance.stashes(stashId);
//     expect(stash.delegatedCluster.toString()).equal(await registeredCluster.getAddress());
//   });

//   it("change Reward Delegators address", async () => {
//     const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
//     const tempRewardDelegatorsInstance = await upgrades.deployProxy(RewardDelegators, {
//       kind: "uups",
//       initializer: false
//     });

//     await expect(stakeManagerInstance.connect(signers[1]).updateRewardDelegators(tempRewardDelegatorsInstance.address)).to.be.reverted;
//     let tx = await (
//       await stakeManagerInstance.connect(stakeManagerOwner).updateRewardDelegators(tempRewardDelegatorsInstance.address)
//     ).wait();
//     expect(await stakeManagerInstance.rewardDelegators()).to.equal(tempRewardDelegatorsInstance.address);

//     //change back to original
//     await stakeManagerInstance.connect(stakeManagerOwner).updateRewardDelegators(rewardDelegatorsInstance.address);
//   });

//   it("update undelegation wait time", async () => {
//     const SELECTOR = await stakeManagerInstance.UNDELEGATION_LOCK_SELECTOR();
//     const undelegationWaitTimeBefore = await stakeManagerInstance.lockWaitTime(SELECTOR);
//     await expect(stakeManagerInstance.connect(signers[1]).updateLockWaitTime(SELECTOR, undelegationWaitTimeBefore + 10)).to.be.reverted;
//     const tx = await (
//       await stakeManagerInstance.connect(stakeManagerOwner).updateLockWaitTime(SELECTOR, undelegationWaitTimeBefore + 10)
//     ).wait();
//     expect(tx.events[0].event).to.equal("LockWaitTimeUpdated");
//     expect(await stakeManagerInstance.lockWaitTime(SELECTOR)).to.equal(undelegationWaitTimeBefore + 10);
//     // change back to original

//     await stakeManagerInstance.connect(stakeManagerOwner).updateLockWaitTime(SELECTOR, undelegationWaitTimeBefore);
//   });

//   it("enable/disable token", async () => {
//     // try to enable already enabled
//     await expect(stakeManagerInstance.connect(stakeManagerOwner).addToken(PONDTokenId, pond.address)).to.be.reverted;

//     // only onwner should be able to disable
//     await expect(stakeManagerInstance.connect(signers[1]).disableToken(PONDTokenId)).to.be.reverted;
//     const tx1 = await (await stakeManagerInstance.connect(stakeManagerOwner).disableToken(PONDTokenId)).wait();
//     expect(tx1.events[0].event).to.equal("RoleRevoked");

//     // only owner should be able to enable
//     await expect(stakeManagerInstance.connect(signers[1]).enableToken(PONDTokenId)).to.be.reverted;
//     const tx2 = await (await stakeManagerInstance.connect(stakeManagerOwner).enableToken(PONDTokenId)).wait();
//     expect(tx2.events[0].event).to.equal("RoleGranted");
//   });

//   it("create, add and withdraw Stash", async () => {
//     let tokenId = PONDTokenId;
//     pond.approve(stakeManagerInstance.address, 300);
//     // await stakeManagerInstance.connect(stakeManagerOwner).addToken(tokenId, pond.address);

//     let tx = await (await stakeManagerInstance.createStash([tokenId], [100])).wait();
//     let stashId = getStashId(tx.events);
//     expect(await stakeManagerInstance.stashes__amounts(stashId, tokenId)).to.equal(100);

//     stakeManagerInstance.addToStash(stashId, [tokenId], [200]);
//     expect(await stakeManagerInstance.stashes__amounts(stashId, tokenId)).to.equal(300);

//     stakeManagerInstance["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [tokenId], [100]);
//     expect(await stakeManagerInstance.stashes__amounts(stashId, tokenId)).to.equal(200);

//     stakeManagerInstance["withdrawStash(bytes32,bytes32[],uint256[])"](stashId, [tokenId], [200]);
//     expect(await stakeManagerInstance.stashes__amounts(stashId, tokenId)).to.equal(0);
//   });

//   async function createStash(mpondAmount: Number, pondAmount: Number) {
//     const tokens = [];
//     const amounts = [];
//     if (mpondAmount != 0) {
//       await mpond.connect(MpondAccount).transfer(addrs[0], mpondAmount);
//       await mpond.approve(stakeManagerInstance.address, mpondAmount);
//       tokens.push(MPONDTokenId);
//       amounts.push(mpondAmount);
//     }
//     if (pondAmount != 0) {
//       await pond.approve(stakeManagerInstance.address, pondAmount);
//       tokens.push(PONDTokenId);
//       amounts.push(pondAmount);
//     }
//     const tx = await (await stakeManagerInstance.createStash(tokens, amounts)).wait();
//     return getStashId(tx.events);
//   }

//   async function skipTime(t: number) {
//     await ethers.provider.send("evm_increaseTime", [t]);
//     await skipBlocks(1);
//   }

//   async function skipBlocks(n: number) {
//     await Promise.all([...Array(n)].map(async (x) => await ethers.provider.send("evm_mine", [])));
//   }

//   function getStashId(events: any[]) {
//     for (let i = 0; i < events.length; i++) {
//       if (events[i].args !== undefined && events[i].args.stashId !== undefined) {
//         return events[i].args.stashId;
//       }
//     }
//   }
//   function getNewStashId(events: any[]) {
//     for (let i = 0; i < events.length; i++) {
//       if (events[i].args !== undefined && events[i].args.toStashId !== undefined) {
//         return events[i].args.toStashId;
//       }
//     }
//   }
// });
