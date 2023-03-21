import { ethers, upgrades, network } from "hardhat";
import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";

import { testERC165 } from "../helpers/erc165";
import { testAdminRole, testRole } from "../helpers/rbac";

import { ClusterRewards, ClusterSelector, Pond, ReceiverStaking } from "../../typechain-types";
import { FuzzedNumber } from "../../utils/fuzzer";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { getClusterRewards, getClusterSelector, getPond, getReceiverStaking } from "../../utils/typechainConvertor";
import { getRandomElementsFromArray } from "../helpers/common";
import { getRandomNumber } from "../../benchmarks/helpers/util";


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

const e9 = BN.from(10).pow(9);
const e16 = BN.from(10).pow(16);
const e18 = BN.from(10).pow(18);
const e20 = BN.from(10).pow(20);
const e22 = BN.from(10).pow(22);

const ETHHASH = ethers.utils.id("ETH");
const DOTHASH = ethers.utils.id("DOT");
const NEARHASH = ethers.utils.id("NEAR");
const NETWORK_IDS = [ETHHASH, DOTHASH, NEARHASH];
const ETHWEIGHT = 100;
const DOTWEIGHT = 150;
const NEARWEIGHT = 250;
const WEIGHTS = [ETHWEIGHT, DOTWEIGHT, NEARWEIGHT];
const TOTALWEIGHT = ETHWEIGHT + DOTWEIGHT + NEARWEIGHT;
const MAX_TICKETS = BN.from(2).pow(16);
const MAX_REWARD = BN.from("242352345636745756867986");
const MAX_TICKETS_1_pc = MAX_TICKETS.div(100);
const MAX_REWARD_1_pc = MAX_REWARD.div(100);
const ETH_REWARD = MAX_REWARD.mul(ETHWEIGHT).div(TOTALWEIGHT);

const tickets = [
  MAX_TICKETS.mul(10).div(100), 
  MAX_TICKETS.mul(20).div(100), 
  MAX_TICKETS.mul(30).div(100), 
  MAX_TICKETS.mul(15).div(100), 
  MAX_TICKETS.sub(MAX_TICKETS.mul(10).div(100).add(MAX_TICKETS.mul(20).div(100)).add(MAX_TICKETS.mul(30).div(100)).add(MAX_TICKETS.mul(15).div(100)))
];

describe("ClusterRewards deploy and init", function () {
  let signers: Signer[];
  let addrs: string[];

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("deploys with initialization disabled", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewards = await ClusterRewards.deploy();

    await expect(
      clusterRewards.initialize(
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("deploys as proxy and initializes", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");

    await expect(upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        [ETHWEIGHT, DOTWEIGHT],
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    )).to.be.revertedWith("CRW:I-Each NetworkId need a corresponding RewardPerEpoch and vice versa");

    await expect(upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    )).to.be.revertedWith("CRW:I-Each NetworkId need a corresponding clusterSelector and vice versa");

    await expect(upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], ethers.constants.AddressZero],
        MAX_REWARD,
      ],
      { kind: "uups" }
    )).to.be.revertedWith("CRW:CN-ClusterSelector must exist");

    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );

    expect(await clusterRewards.hasRole(await clusterRewards.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.CLAIMER_ROLE(), addrs[1])).to.be.true;
    expect(await clusterRewards.rewardWeight(ETHHASH)).to.equal(ETHWEIGHT);
    expect(await clusterRewards.rewardWeight(DOTHASH)).to.equal(DOTWEIGHT);
    expect(await clusterRewards.rewardWeight(NEARHASH)).to.equal(NEARWEIGHT);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(MAX_REWARD);
    expect(await clusterRewards.clusterSelectors(ETHHASH)).to.equal(addrs[11]);
    expect(await clusterRewards.clusterSelectors(DOTHASH)).to.equal(addrs[12]);
    expect(await clusterRewards.clusterSelectors(NEARHASH)).to.equal(addrs[13]);
    expect(await clusterRewards.receiverStaking()).to.equal(addrs[10]);
  });

  it("upgrades", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    await upgrades.upgradeProxy(clusterRewards.address, ClusterRewards, { kind: "uups" });

    expect(await clusterRewards.hasRole(await clusterRewards.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.CLAIMER_ROLE(), addrs[1])).to.be.true;
    expect(await clusterRewards.rewardWeight(ETHHASH)).to.equal(ETHWEIGHT);
    expect(await clusterRewards.rewardWeight(DOTHASH)).to.equal(DOTWEIGHT);
    expect(await clusterRewards.rewardWeight(NEARHASH)).to.equal(NEARWEIGHT);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(MAX_REWARD);
    expect(await clusterRewards.clusterSelectors(ETHHASH)).to.equal(addrs[11]);
    expect(await clusterRewards.clusterSelectors(DOTHASH)).to.equal(addrs[12]);
    expect(await clusterRewards.clusterSelectors(NEARHASH)).to.equal(addrs[13]);
    expect(await clusterRewards.receiverStaking()).to.equal(addrs[10]);
  });

  it("does not upgrade without admin", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    await expect(upgrades.upgradeProxy(clusterRewards.address, ClusterRewards.connect(signers[1]), { kind: "uups" })).to.be.revertedWith("only admin");
  });
});

testERC165(
  "ClusterRegistry erc165",
  async function (signers: Signer[], addrs: string[]) {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        addrs[10],
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    let clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
    return clusterRewards;
  },
  {
    IAccessControl: [
      "hasRole(bytes32,address)",
      "getRoleAdmin(bytes32)",
      "grantRole(bytes32,address)",
      "revokeRole(bytes32,address)",
      "renounceRole(bytes32,address)",
    ],
    IAccessControlEnumerable: ["getRoleMember(bytes32,uint256)", "getRoleMemberCount(bytes32)"],
  }
);

testAdminRole("ClusterRewards admin role", async function (signers: Signer[], addrs: string[]) {
  const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
  let clusterRewardsContract = await upgrades.deployProxy(
    ClusterRewards,
    [
      addrs[0],
      addrs[1],
      addrs[10],
      NETWORK_IDS,
      WEIGHTS,
      [addrs[11], addrs[12], addrs[13]],
      MAX_REWARD,
    ],
    { kind: "uups" }
  );
  let clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  return clusterRewards;
});

testRole("ClusterRegistry claimer role", async function (signers: Signer[], addrs: string[]) {
  const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
  let clusterRewardsContract = await upgrades.deployProxy(
    ClusterRewards,
    [
      addrs[0],
      addrs[1],
      addrs[10],
      NETWORK_IDS,
      WEIGHTS,
      [addrs[11], addrs[12], addrs[13]],
      MAX_REWARD,
    ],
    { kind: "uups" }
  );
  let clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  return clusterRewards;
}, "CLAIMER_ROLE");

let startTime = Math.floor(Date.now()/1000) + 100000;

describe("ClusterRewards add network", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let clusterRewards: ClusterRewards;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can add network", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, clusterSelector.address);

    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(clusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT + 400);
  });

  it("admin can add network with zero weight", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 0, clusterSelector.address);

    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(0);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(clusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);
  });

  it("admin cannot add existing network", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await expect(clusterRewards.addNetwork(ethers.utils.id("ETH"), 400, clusterSelector.address)).to.be.revertedWith("CRW:AN-Network already exists");
  });

  it("admin cannot add network with invalid cluster selector", async function () {
    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, ethers.constants.AddressZero)).to.be.revertedWith("CRW:AN-ClusterSelector must exist");
  });

  it("admin cannot add network if start time does not match", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime+1);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, clusterSelector.address)).to.be.revertedWith("CRW:AN-start time inconsistent");
  });

  it("admin cannot add network if epoch length does not match", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(901);

    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, clusterSelector.address)).to.be.revertedWith("CRW:AN-epoch length inconsistent");
  });

  it("non admin cannot add network", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await expect(clusterRewards.connect(signers[1]).addNetwork(ethers.utils.id("POLYGON"), 400, clusterSelector.address)).to.be.revertedWith("only admin");
  });
});

describe("ClusterRewards cluster selector", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let clusterRewards: ClusterRewards;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can update cluster selector", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await clusterRewards.updateNetwork(ethers.utils.id("ETH"), ETHWEIGHT, clusterSelector.address);

    expect(await clusterRewards.rewardWeight(ethers.utils.id("ETH"))).to.equal(ETHWEIGHT);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("ETH"))).to.equal(clusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);
  });

  it("admin cannot update cluster selector to zero", async function () {
    await expect(clusterRewards.updateNetwork(ethers.utils.id("ETH"), ETHWEIGHT, ethers.constants.AddressZero)).to.be.revertedWith("CRW:UN-ClusterSelector must exist");
  });

  it("admin cannot update cluster selector if start time does not match", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime+1);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await expect(clusterRewards.updateNetwork(ethers.utils.id("ETH"), ETHWEIGHT, clusterSelector.address)).to.be.revertedWith("CRW:UN-start time inconsistent");
  });

  it("admin cannot update cluster selector if epoch length does not match", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(901);

    await expect(clusterRewards.updateNetwork(ethers.utils.id("ETH"), ETHWEIGHT, clusterSelector.address)).to.be.revertedWith("CRW:UN-epoch length inconsistent");
  });

  it("admin can update reward weight", async function () {
    await clusterRewards.updateNetwork(ethers.utils.id("ETH"), 400, addrs[11]);

    expect(await clusterRewards.rewardWeight(ethers.utils.id("ETH"))).to.equal(400);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("ETH"))).to.equal(addrs[11]);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT + 400 - ETHWEIGHT);
  });

  it("admin can update reward weight to zero", async function () {
    await clusterRewards.updateNetwork(ethers.utils.id("ETH"), 0, addrs[11]);

    expect(await clusterRewards.rewardWeight(ethers.utils.id("ETH"))).to.equal(0);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("ETH"))).to.equal(addrs[11]);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT - ETHWEIGHT);
  });

  it("admin cannot update cluster selector and weight for non existent network", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await expect(clusterRewards.updateNetwork(ethers.utils.id("POLYGON"), ETHWEIGHT, clusterSelector.address)).to.be.revertedWith("CRW:UN-Network doesnt exist");
  });

  it("non admin cannot update cluster selector", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await expect(clusterRewards.connect(signers[1]).updateNetwork(ethers.utils.id("ETH"), ETHWEIGHT, clusterSelector.address)).to.be.revertedWith("only admin");
  });

  it("non admin cannot update weight", async function () {
    await expect(clusterRewards.connect(signers[1]).updateNetwork(ethers.utils.id("ETH"), 400, addrs[11])).to.be.revertedWith("only admin");
  });

  it("non admin cannot update cluster selector and weight", async function () {
    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());
    await clusterSelector.mock.START_TIME.returns(startTime);
    await clusterSelector.mock.EPOCH_LENGTH.returns(900);

    await expect(clusterRewards.connect(signers[1]).updateNetwork(ethers.utils.id("ETH"), 400, clusterSelector.address)).to.be.revertedWith("only admin");
  });
});

describe("ClusterRewards remove network", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let clusterRewards: ClusterRewards;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can remove network", async function () {
    await clusterRewards.removeNetwork(ethers.utils.id("DOT"));
    expect(await clusterRewards.rewardWeight(ethers.utils.id("DOT"))).to.equal(0);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("DOT"))).to.equal(ethers.constants.AddressZero);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT - DOTWEIGHT);
  });

  it("admin cannot remove non-existing network", async function () {
    await expect(clusterRewards.removeNetwork(ethers.utils.id("POLYGON"))).to.be.reverted;
  });

  it("non admin cannot remove network", async function () {
    await expect(clusterRewards.connect(signers[1]).removeNetwork(ethers.utils.id("DOT"))).to.be.reverted;
  });
});

describe("ClusterRewards update global vars", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let clusterRewards: ClusterRewards;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can update receiver staking", async function () {
    await clusterRewards.updateReceiverStaking(addrs[10]);
    expect(await clusterRewards.receiverStaking()).to.equal(addrs[10]);
  });

  it("non admin cannot update receiver staking", async function () {
    await expect(clusterRewards.connect(signers[1]).updateReceiverStaking(addrs[10])).to.be.reverted;
  });

  it("admin can update reward per epoch", async function () {
    await clusterRewards.changeRewardPerEpoch(30000);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(30000);
  });

  it("non admin cannot update reward per epoch", async function () {
    await expect(clusterRewards.connect(signers[1]).changeRewardPerEpoch(30000)).to.be.reverted;
  });

  it("admin can update reward wait time", async function () {
    await clusterRewards.updateRewardWaitTime(30000);
    expect(await clusterRewards.rewardDistributionWaitTime()).to.equal(30000);
  });

  it("non admin cannot update reward wait time", async function () {
    await expect(clusterRewards.connect(signers[1]).updateRewardWaitTime(30000)).to.be.reverted;
  });
});

describe("ClusterRewards feed rewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let clusterRewards: ClusterRewards;
  const FEED_REWARD = BN.from("200000").mul(e18);
  const FEEDER_REWARD_1_pc = FEED_REWARD.mul(ETHWEIGHT).div(TOTALWEIGHT).div(100).mul(24*60*60).div(900);

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [addrs[11], addrs[12], addrs[13]],
        FEED_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);

    await clusterRewards.grantRole(clusterRewards.FEEDER_ROLE(), addrs[2]);
    await clusterRewards.updateRewardWaitTime(43200);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("feeder can feed rewards before start time", async function () {
    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(50)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(50));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));
  });

  it("feeder can feed rewards after start time", async function () {
    await skipToTimestamp(startTime + 10);

    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(50)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(50));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));
  });

  it("feeder can feed rewards till 1 day after switching time", async function () {
    await skipToTimestamp(startTime + 33*86400 + 85000);

    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(50)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(50));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));
  });

  it("feeder cannot feed rewards after 1 day after switching time", async function () {
    await skipToTimestamp(startTime + 33*86400 + 90000);

    await expect(clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(50)], 1)).to.be.revertedWith("CRW:F-Invalid method");
  });

  it("feeder cannot feed rewards exceeding total", async function () {
    await expect(clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22], addrs[23]], [e16.mul(10), e16.mul(50), (e16.mul(40)).add(e16.div(100))], 1)).to.be.revertedWith("CRW:F-Reward Distributed  cant  be more  than totalRewardPerEpoch");
  });

  it("feeder can feed rewards in multiple parts", async function () {
    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21]], [e16.mul(10)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(0);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(10));

    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[22]], [e16.mul(50)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(50));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));
  });

  it("feeder cannot feed rewards in multiple parts exceeding total", async function () {
    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21]], [e16.mul(10)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(0);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(10));

    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[22]], [e16.mul(50)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(50));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));

    await expect(clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[23]], [e16.mul(41)], 1)).to.be.revertedWith("CRW:F-Reward Distributed  cant  be more  than totalRewardPerEpoch");
  });

  it("feeder cannot feed rewards again before wait time", async function () {
    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(50)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(50));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));

    await expect(clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(10)], 2)).to.be.revertedWith("CRW:F-Cant distribute reward for new epoch within such short interval");
    await skipTime(40000);
    await expect(clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(10)], 2)).to.be.revertedWith("CRW:F-Cant distribute reward for new epoch within such short interval");
  });

  it("feeder can feed rewards again after wait time", async function () {
    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(50)], 1);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(10));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(50));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));

    await expect(clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(10)], 2)).to.be.revertedWith("CRW:F-Cant distribute reward for new epoch within such short interval");
    await skipTime(40000);
    await expect(clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(10)], 2)).to.be.revertedWith("CRW:F-Cant distribute reward for new epoch within such short interval");
    await skipTime(5000);
    await clusterRewards.connect(signers[2]).feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(10)], 2);

    expect(await clusterRewards.clusterRewards(addrs[21])).to.equal(FEEDER_REWARD_1_pc.mul(20));
    expect(await clusterRewards.clusterRewards(addrs[22])).to.equal(FEEDER_REWARD_1_pc.mul(60));
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(FEEDER_REWARD_1_pc.mul(60));
    expect(await clusterRewards.rewardDistributedPerEpoch(2)).to.equal(FEEDER_REWARD_1_pc.mul(20));
  });

  it("non feeder cannot feed rewards", async function () {
    await expect(clusterRewards.feed(ETHHASH, [addrs[21], addrs[22]], [e16.mul(10), e16.mul(50)], 1)).to.be.revertedWith("only feeder");
  });
});

describe("ClusterRewards submit tickets", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let ethSelector: Contract;
  let clusterRewards: ClusterRewards;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    ethSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [ethSelector.address, addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);

    await clusterRewards.grantRole(clusterRewards.FEEDER_ROLE(), addrs[2]);
    await clusterRewards.updateRewardWaitTime(43200);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it.skip("delete me", async () => {
    await ethSelector.mock.NUMBER_OF_CLUSTERS_TO_SELECT.returns(5);
    let networkId = ethers.utils.id("ETH");
    let epochNumber = getRandomNumber(BN.from(20000)).toNumber();
    let noOfEpochs = 96;
    let tickets: number[][] = [];
    let rawTicketInfo = networkId + epochNumber.toString(16).padStart(8, '0');
    for(let i=0; i<noOfEpochs*4; i++) {
      let j: number = parseInt((i/4)+"");
      let k: number = i%4;
      if(!tickets[j]) tickets[j] = [];
      tickets[j][k] = parseInt((Math.random()*13000)+"");
      rawTicketInfo = rawTicketInfo+tickets[j][k].toString(16).padStart(4, '0');
    }
    console.log(rawTicketInfo)
    const data = await clusterRewards._parseTicketInfo(rawTicketInfo);
    console.log(tickets);
    expect(data.networkId).to.equal(networkId);
    expect(data.fromEpoch).to.equal(epochNumber);
    expect(data.noOfEpochs).to.equal(noOfEpochs);
    tickets.map((e, i) => {
      e.map((ele, j) => {
        expect(tickets[i][j]).to.equal(data.tickets[i][j], `epoch ${i} ticket ${j} not equal`);
      });
    });
  });

  it("staker can submit tickets before switch with zero rewards", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, 2, tickets.slice(0, -1));

    expect(await clusterRewards.isTicketsIssued(addrs[4], 2)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], 2)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.equal(0);

    await skipToTimestamp(startTime + 34*86400);

    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[6], 2).returns(50, addrs[7]);

    await clusterRewards.connect(signers[6])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, 2, tickets.slice(0, -1));

    expect(await clusterRewards.isTicketsIssued(addrs[7], 2)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[6], 2)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.equal(0);
  });

  it("staker can submit tickets after switch with non zero rewards", async function () {
    const epochWithRewards = 33*86400/900 + 2;
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards).returns(500, epochWithRewards + 2);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);
    let receiverRewards1 = tickets.map((e) => ETH_REWARD.mul(50).mul(e).div(500).div(MAX_TICKETS));

    await skipToTimestamp(startTime + 34*86400);

    await clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards, tickets.slice(0, -1));

    expect(await clusterRewards.isTicketsIssued(addrs[4], epochWithRewards)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], epochWithRewards)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.be.closeTo(receiverRewards1[0], 1);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.be.closeTo(receiverRewards1[1], 1);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.be.closeTo(receiverRewards1[2], 1);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.be.closeTo(receiverRewards1[3], 1);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.be.closeTo(receiverRewards1[4], 1);

    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards + 2).returns(25, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards + 2).returns(125, epochWithRewards + 3);
    await ethSelector.mock.getClusters.returns([addrs[35], addrs[34], addrs[33], addrs[32], addrs[31]]);
    let receiverRewards2 = tickets.map((e) => ETH_REWARD.mul(25).mul(e).div(125).div(MAX_TICKETS));

    await clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards + 2, tickets.slice(0, -1));

    expect(await clusterRewards.isTicketsIssued(addrs[4], epochWithRewards + 2)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], epochWithRewards + 2)).to.be.false;
    expect((await clusterRewards.clusterRewards(addrs[31]))).to.be.closeTo((receiverRewards1[0]).add(receiverRewards2[4]), 2);
    expect((await clusterRewards.clusterRewards(addrs[32]))).to.be.closeTo((receiverRewards1[1]).add(receiverRewards2[3]), 2);
    expect((await clusterRewards.clusterRewards(addrs[33]))).to.be.closeTo((receiverRewards1[2]).add(receiverRewards2[2]), 2);
    expect((await clusterRewards.clusterRewards(addrs[34]))).to.be.closeTo((receiverRewards1[3]).add(receiverRewards2[1]), 2);
    expect((await clusterRewards.clusterRewards(addrs[35]))).to.be.closeTo((receiverRewards1[4]).add(receiverRewards2[0]), 2);
  });

  it("staker cannot submit tickets multiple times for the same epoch", async function () {
    const epochWithRewards = 33*86400/900 + 2;
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards).returns(500, epochWithRewards + 2);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);
    let receiverRewards1 = tickets.map((e) => ETH_REWARD.mul(50).mul(e).div(500).div(MAX_TICKETS));

    await skipToTimestamp(startTime + 34*86400);

    await clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards, tickets.slice(0, -1));

    expect(await clusterRewards.isTicketsIssued(addrs[4], epochWithRewards)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], epochWithRewards)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.be.closeTo(receiverRewards1[0], 1);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.be.closeTo(receiverRewards1[1], 1);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.be.closeTo(receiverRewards1[2], 1);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.be.closeTo(receiverRewards1[3], 1);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.be.closeTo(receiverRewards1[4], 1);

    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards + 2).returns(25, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards + 2).returns(125, epochWithRewards + 3);
    await ethSelector.mock.getClusters.returns([addrs[35], addrs[34], addrs[33], addrs[32], addrs[31]]);

    await expect(clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards, tickets.slice(0, -1))).to.be.revertedWith("CRW:IPRT-Tickets already issued");
  });

  it("staker cannot submit tickets for future epochs", async function () {
    const epochWithRewards = 33*86400/900 + 5;
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards).returns(500, epochWithRewards);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    await expect(clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards, tickets.slice(0, -1))).to.be.revertedWith("CRW:IT-Epoch not completed");
  });

  it.skip("staker cannot submit partial tickets", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    await expect(clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, 2, [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS_1_pc.mul(24)])).to.be.revertedWith("CRW:IPRT-Total ticket count invalid");
  });

  it("staker cannot submit excess tickets", async function () {
    const epochWithRewards = 33*86400/900 + 2;
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards).returns(500, epochWithRewards + 3);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    await expect(clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24[],uint16[][])"](ETHHASH, [epochWithRewards], [[MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(41)]])).to.be.revertedWith("CRW:IPRT-Total ticket count invalid");
    await expect(clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24[],uint16[][])"](ETHHASH, [], [[MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS_1_pc.mul(26)]])).to.be.revertedWith("CRW:MIT-invalid inputs");
  });

  it("staker cannot submit tickets over maximum", async function () {
    const epochWithRewards = 33*86400/900 + 2;
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards).returns(500, epochWithRewards + 3);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    // reverted because of overflow in args
    await expect(clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards, [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS.add(1)])).to.be.revertedWith("");
  });
});

describe.skip("ClusterRewards submit signed tickets", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let ethSelector: Contract;
  let clusterRewards: ClusterRewards;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    ethSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [ethSelector.address, addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);

    await clusterRewards.grantRole(clusterRewards.FEEDER_ROLE(), addrs[2]);
    await clusterRewards.updateRewardWaitTime(43200);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("staker can submit signed tickets before switch with zero rewards", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    const signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 2, tickets],
    ))));
    const ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, ticketsSigned);

    expect(await clusterRewards.isTicketsIssued(addrs[4], 2)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], 2)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.equal(0);
  });

  it("staker can submit signed tickets after switch with non zero rewards", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);
    let receiverRewards1 = tickets.map((e) => ETH_REWARD.mul(50).mul(e).div(500).div(MAX_TICKETS));

    await skipToTimestamp(startTime + 34*86400);

    let signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 2, tickets],
    ))));
    let ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, ticketsSigned);

    expect(await clusterRewards.isTicketsIssued(addrs[4], 2)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], 2)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.be.closeTo(receiverRewards1[0], 1);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.be.closeTo(receiverRewards1[1], 1);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.be.closeTo(receiverRewards1[2], 1);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.be.closeTo(receiverRewards1[3], 1);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.be.closeTo(receiverRewards1[4], 1);

    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 4).returns(25, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(4).returns(125, 5);
    await ethSelector.mock.getClusters.returns([addrs[35], addrs[34], addrs[33], addrs[32], addrs[31]]);
    let receiverRewards2 = tickets.map((e) => ETH_REWARD.mul(25).mul(e).div(125).div(MAX_TICKETS));

    signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 4, tickets],
    ))));
    ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 4, ticketsSigned);

    expect(await clusterRewards.isTicketsIssued(addrs[4], 4)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], 4)).to.be.false;
    expect((await clusterRewards.clusterRewards(addrs[31]))).to.be.closeTo((receiverRewards1[0]).add(receiverRewards2[4]), 2);
    expect((await clusterRewards.clusterRewards(addrs[32]))).to.be.closeTo((receiverRewards1[1]).add(receiverRewards2[3]), 2);
    expect((await clusterRewards.clusterRewards(addrs[33]))).to.be.closeTo((receiverRewards1[2]).add(receiverRewards2[2]), 2);
    expect((await clusterRewards.clusterRewards(addrs[34]))).to.be.closeTo((receiverRewards1[3]).add(receiverRewards2[1]), 2);
    expect((await clusterRewards.clusterRewards(addrs[35]))).to.be.closeTo((receiverRewards1[4]).add(receiverRewards2[0]), 2);
  });

  it("staker cannot submit signed tickets multiple times for the same epoch", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);
    let receiverRewards1 = tickets.map((e) => ETH_REWARD.mul(50).mul(e).div(500).div(MAX_TICKETS));

    await skipToTimestamp(startTime + 34*86400);

    let signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 2, tickets],
    ))));
    let ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, ticketsSigned);

    expect(await clusterRewards.isTicketsIssued(addrs[4], 2)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], 2)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.be.closeTo(receiverRewards1[0], 1);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.be.closeTo(receiverRewards1[1], 1);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.be.closeTo(receiverRewards1[2], 1);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.be.closeTo(receiverRewards1[3], 1);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.be.closeTo(receiverRewards1[4], 1);

    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 4).returns(25, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(4).returns(125, 5);
    await ethSelector.mock.getClusters.returns([addrs[35], addrs[34], addrs[33], addrs[32], addrs[31]]);

    signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 2, tickets],
    ))));
    ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await expect(clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, ticketsSigned)).to.be.revertedWith("CRW:IPRT-Tickets already issued");
  });

  it("staker cannot submit signed tickets for future epochs", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 5).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(5).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    let signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 5, tickets],
    ))));
    let ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await expect(clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 5, ticketsSigned)).to.be.revertedWith("CRW:SIT-Epoch not completed");
  });

  it("staker cannot submit partial tickets", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    let signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 2, [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS_1_pc.mul(24)]],
    ))));
    let tickets = [
      {
        tickets: [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS_1_pc.mul(24)],
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await expect(clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, tickets)).to.be.revertedWith("CRW:IPRT-Total ticket count invalid");
  });

  it("staker cannot submit excess tickets", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    let signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 2, [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS_1_pc.mul(26)]],
    ))));
    let tickets = [
      {
        tickets: [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS_1_pc.mul(26)],
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await expect(clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, tickets)).to.be.revertedWith("CRW:IPRT-Total ticket count invalid");
  });

  it("staker cannot submit signed tickets over maximum", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    let signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint24[]"],
      [ETHHASH, 2, [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS.add(1)]],
    ))));
    let tickets = [
      {
        tickets: [MAX_TICKETS_1_pc.mul(10), MAX_TICKETS_1_pc.mul(20), MAX_TICKETS_1_pc.mul(30), MAX_TICKETS_1_pc.mul(15), MAX_TICKETS.add(1)],
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    // reverted because of overflow in args
    await expect(clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, tickets)).to.be.revertedWith("");
  });

  it("staker cannot submit missigned tickets", async function () {
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], 2).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(2).returns(500, 5);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);

    await skipToTimestamp(startTime + 34*86400);

    let signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 3, tickets],
    ))));
    let ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16),
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await expect(clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, ticketsSigned)).to.be.reverted;

    signature = await signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "uint16[]"],
      [ETHHASH, 2, tickets],
    ))));
    ticketsSigned = [
      {
        tickets: tickets,
        v: parseInt(signature.slice(130, 132), 16) - 5,
        r: signature.slice(0, 66),
        s: "0x" + signature.slice(66, 130),
      },
    ];
    await expect(clusterRewards.connect(signers[15])["issueTickets(bytes32,uint24,(uint16[],uint8,bytes32,bytes32)[])"](ETHHASH, 2, ticketsSigned)).to.be.reverted;
  });
});

describe("ClusterRewards claim rewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let receiverStaking: Contract;
  let ethSelector: Contract;
  let clusterRewards: ClusterRewards;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());
    await receiverStaking.mock.START_TIME.returns(startTime);
    await receiverStaking.mock.EPOCH_LENGTH.returns(900);

    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    ethSelector = await deployMockContract(signers[0], ClusterSelector.interface.format());

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [ethSelector.address, addrs[12], addrs[13]],
        MAX_REWARD,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);

    await clusterRewards.grantRole(clusterRewards.FEEDER_ROLE(), addrs[2]);
    await clusterRewards.updateRewardWaitTime(43200);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("claimer can claim rewards", async function () {
    const epochWithRewards = 33*86400/900 + 2;
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards).returns(500, epochWithRewards + 3);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);
    let receiverRewards1 = tickets.map((e) => ETH_REWARD.mul(50).mul(e).div(500).div(MAX_TICKETS));

    await skipToTimestamp(startTime + 34*86400);
    await clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards, tickets.slice(0, -1));

    expect(await clusterRewards.isTicketsIssued(addrs[4], epochWithRewards)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], epochWithRewards)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.be.closeTo(receiverRewards1[0], 1);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.be.closeTo(receiverRewards1[1], 1);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.be.closeTo(receiverRewards1[2], 1);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.be.closeTo(receiverRewards1[3], 1);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.be.closeTo(receiverRewards1[4], 1);

    expect(await clusterRewards.connect(signers[1]).callStatic.claimReward(addrs[33])).to.be.closeTo(receiverRewards1[2].sub(1), 1);
    await clusterRewards.connect(signers[1]).claimReward(addrs[33]);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.equal(1);
    expect(await clusterRewards.connect(signers[1]).callStatic.claimReward(addrs[31])).to.be.closeTo(receiverRewards1[0].sub(1), 1);
    await clusterRewards.connect(signers[1]).claimReward(addrs[31]);
    expect(await clusterRewards.clusterRewards(addrs[31])).to.equal(1);
    expect(await clusterRewards.connect(signers[1]).callStatic.claimReward(addrs[35])).to.be.closeTo(receiverRewards1[4].sub(1), 1);
    await clusterRewards.connect(signers[1]).claimReward(addrs[35]);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.equal(1);
    expect(await clusterRewards.connect(signers[1]).callStatic.claimReward(addrs[34])).to.be.closeTo(receiverRewards1[3].sub(1), 1);
    await clusterRewards.connect(signers[1]).claimReward(addrs[34]);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.equal(1);
    expect(await clusterRewards.connect(signers[1]).callStatic.claimReward(addrs[32])).to.be.closeTo(receiverRewards1[1].sub(1), 1);
    await clusterRewards.connect(signers[1]).claimReward(addrs[32]);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.equal(1);
    expect(await clusterRewards.connect(signers[1]).callStatic.claimReward(addrs[36])).to.equal(0);
    await clusterRewards.connect(signers[1]).claimReward(addrs[36]);
    expect(await clusterRewards.clusterRewards(addrs[36])).to.equal(0);
  });

  it("non claimer cannot claim rewards", async function () {
    const epochWithRewards = 33*86400/900 + 2;
    await receiverStaking.mock.balanceOfSignerAt.reverts();
    await receiverStaking.mock.balanceOfSignerAt.withArgs(addrs[5], epochWithRewards).returns(50, addrs[4]);
    await receiverStaking.mock.getEpochInfo.reverts();
    await receiverStaking.mock.getEpochInfo.withArgs(epochWithRewards).returns(500, epochWithRewards + 3);
    await ethSelector.mock.getClusters.returns([addrs[31], addrs[32], addrs[33], addrs[34], addrs[35]]);
    let receiverRewards1 = tickets.map((e) => ETH_REWARD.mul(50).mul(e).div(500).div(MAX_TICKETS));

    await skipToTimestamp(startTime + 34*86400);
    await clusterRewards.connect(signers[5])["issueTickets(bytes32,uint24,uint16[])"](ETHHASH, epochWithRewards, tickets.slice(0, -1));

    expect(await clusterRewards.isTicketsIssued(addrs[4], epochWithRewards)).to.be.true;
    expect(await clusterRewards.isTicketsIssued(addrs[5], epochWithRewards)).to.be.false;
    expect(await clusterRewards.clusterRewards(addrs[31])).to.be.closeTo(receiverRewards1[0], 1);
    expect(await clusterRewards.clusterRewards(addrs[32])).to.be.closeTo(receiverRewards1[1], 1);
    expect(await clusterRewards.clusterRewards(addrs[33])).to.be.closeTo(receiverRewards1[2], 1);
    expect(await clusterRewards.clusterRewards(addrs[34])).to.be.closeTo(receiverRewards1[3], 1);
    expect(await clusterRewards.clusterRewards(addrs[35])).to.be.closeTo(receiverRewards1[4], 1);

    await expect(clusterRewards.claimReward(addrs[33])).to.be.revertedWith(`AccessControl: account ${addrs[0].toLowerCase()} is missing role ${await clusterRewards.CLAIMER_ROLE()}`);
  });
});

