import { BigNumber as BN } from "bignumber.js";
import { expect } from "chai";
import { deployMockContract } from "ethereum-waffle";
import { BigNumber, BigNumberish, Contract, Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import { ClusterRewards, ClusterSelector, Pond, ReceiverStaking } from "../../typechain-types";
import { FuzzedNumber } from "../../utils/fuzzer";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { getClusterRewards, getClusterSelector, getPond, getReceiverStaking } from "../../utils/typechainConvertor";
import { getRandomElementsFromArray } from "../helpers/common";

const ETHHASH = ethers.utils.id("ETH");
const DOTHASH = ethers.utils.id("DOT");
const NEARHASH = ethers.utils.id("NEAR");
const NETWORK_IDS = [ETHHASH, DOTHASH, NEARHASH];
const ETHWEIGHT = 100;
const DOTWEIGHT = 200;
const NEARWEIGHT = 300;
const WEIGHTS = [ETHWEIGHT, DOTWEIGHT, NEARWEIGHT];
const TOTALWEIGHT = ETHWEIGHT + DOTWEIGHT + NEARWEIGHT;

const e16 = BigNumber.from(10).pow(16);
const e18 = BigNumber.from(10).pow(18);
const e20 = BigNumber.from(10).pow(20);
const e22 = BigNumber.from(10).pow(22);

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterSelector: ClusterSelector;
  let receiverStaking: ReceiverStaking;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);

    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    clusterSelector = getClusterSelector(clusterSelectorContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("deploys with initialization disabled", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewards = await ClusterRewards.deploy();

    await expect(
      clusterRewards.initialize(
        addrs[1],
        addrs[2],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000
      )
    ).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[1],
        addrs[2],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );

    expect(await clusterRewards.hasRole(await clusterRewards.DEFAULT_ADMIN_ROLE(), addrs[1])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.CLAIMER_ROLE(), addrs[2])).to.be.true;
    await Promise.all(
      NETWORK_IDS.map(async (nid, idx) => {
        expect(await clusterRewards.rewardWeight(nid)).to.equal(WEIGHTS[idx]);
      })
    );
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(60000);
    expect(await clusterRewards.clusterSelectors(DOTHASH)).to.equal(clusterSelector.address);
    expect(await clusterRewards.receiverStaking()).to.equal(receiverStaking.address);
  });

  it("upgrades", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );
    await upgrades.upgradeProxy(clusterRewards.address, ClusterRewards, { kind: "uups" });

    expect(await clusterRewards.hasRole(await clusterRewards.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.CLAIMER_ROLE(), addrs[1])).to.be.true;
    await Promise.all(
      NETWORK_IDS.map(async (nid, idx) => {
        expect(await clusterRewards.rewardWeight(nid)).to.equal(WEIGHTS[idx]);
      })
    );
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(60000);
  });

  it("does not upgrade without admin", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );
    await expect(upgrades.upgradeProxy(clusterRewards.address, ClusterRewards.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: ClusterRewards;
  let clusterSelector: ClusterSelector;
  let receiverStaking: ReceiverStaking;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockData = await ethers.provider.getBlock("latest");

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);

    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    clusterSelector = getClusterSelector(clusterSelectorContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("supports ERC167", async function () {
    const iid = ethers.utils.id("supportsInterface(bytes4)").substr(0, 10);
    expect(await clusterRewards.supportsInterface(iid)).to.be.true;
  });

  it("does not support 0xffffffff", async function () {
    expect(await clusterRewards.supportsInterface("0xffffffff")).to.be.false;
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
    expect(await clusterRewards.supportsInterface(iid)).to.be.true;
  });

  it("supports IAccessControlEnumerable", async function () {
    let interfaces = ["getRoleMember(bytes32,uint256)", "getRoleMemberCount(bytes32)"];
    const iid = makeInterfaceId(interfaces);
    expect(await clusterRewards.supportsInterface(iid)).to.be.true;
  });
});

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: ClusterRewards;
  let DEFAULT_ADMIN_ROLE: string;
  let clusterSelector: ClusterSelector;
  let receiverStaking: ReceiverStaking;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);

    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    clusterSelector = getClusterSelector(clusterSelectorContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);

    DEFAULT_ADMIN_ROLE = await clusterRewards.DEFAULT_ADMIN_ROLE();
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can grant admin role", async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;
  });

  it("non admin cannot grant admin role", async function () {
    await expect(clusterRewards.connect(signers[1]).grantRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can revoke admin role", async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await clusterRewards.revokeRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it("non admin cannot revoke admin role", async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(clusterRewards.connect(signers[2]).revokeRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can renounce own admin role if there are other admins", async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await clusterRewards.connect(signers[1]).renounceRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it("admin cannot renounce own admin role if there are no other admins", async function () {
    await expect(clusterRewards.renounceRole(DEFAULT_ADMIN_ROLE, addrs[0])).to.be.reverted;
  });

  it("admin cannot renounce admin role of other admins", async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(clusterRewards.renounceRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });
});

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: ClusterRewards;
  let CLAIMER_ROLE: string;
  let clusterSelector: ClusterSelector;
  let receiverStaking: ReceiverStaking;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);

    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    clusterSelector = getClusterSelector(clusterSelectorContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);

    CLAIMER_ROLE = await clusterRewards.CLAIMER_ROLE();
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can grant claimer role", async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;
  });

  it("non admin cannot grant claimer role", async function () {
    await expect(clusterRewards.connect(signers[1]).grantRole(CLAIMER_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can revoke claimer role", async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;

    await clusterRewards.revokeRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.false;
  });

  it("non admin cannot revoke claimer role", async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;

    await expect(clusterRewards.connect(signers[2]).revokeRole(CLAIMER_ROLE, addrs[1])).to.be.reverted;
  });

  it("whitelisted signer can renounce own claimer role", async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;

    await clusterRewards.connect(signers[1]).renounceRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.false;
  });
});

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let pond: Pond;
  let clusterRewards: ClusterRewards;
  let clusterSelector: ClusterSelector;
  let receiverStaking: ReceiverStaking;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    let pondContract = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });
    pond = getPond(pondContract.address, signers[0]);

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);

    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD",  pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    clusterSelector = getClusterSelector(clusterSelectorContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can add network", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, newClusterSelector.address);

    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(newClusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT + 400);
  });

  it("admin cannot add existing network", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, newClusterSelector.address);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(newClusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT + 400);

    newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, newClusterSelector.address)).to.be.reverted;
  });

  it("admin can add network with zero weight", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 0, newClusterSelector.address);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(0);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(newClusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);
  });

  it("admin can update network weight to zero", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400, newClusterSelector.address);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(newClusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT + 400);

    await clusterRewards.updateNetwork(ethers.utils.id("POLYGON"), 0, newClusterSelector.address);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(0);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(newClusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT);

    let updatedClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });

    await clusterRewards.updateNetwork(ethers.utils.id("POLYGON"), 400, updatedClusterSelector.address);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.clusterSelectors(ethers.utils.id("POLYGON"))).to.equal(updatedClusterSelector.address);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT + 400);
  });

  it("admin cannot add network with clusterSelector as zero address", async function () {
    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 40, ethers.constants.AddressZero)).to.be.reverted;
  });

  it("non admin cannot add network", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await expect(clusterRewards.connect(signers[1]).addNetwork(ethers.utils.id("POLYGON"), 400, newClusterSelector.address)).to.be.reverted;
  });

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

  it("admin can update receive staking", async () => {
    const anyOtherAddress = getRandomElementsFromArray(addrs, 1)[0];
    await expect(clusterRewards.connect(signers[0]).updateReceiverStaking(anyOtherAddress))
      .to.emit(clusterRewards, "ReceiverStakingUpdated")
      .withArgs(anyOtherAddress);
  });
});

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let pond: Pond;
  let clusterRewards: ClusterRewards;
  let receiverStaking: ReceiverStaking;
  let clusterSelector: ClusterSelector;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    let pondContract = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });
    pond = getPond(pondContract.address, signers[0]);

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);

    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    clusterSelector = getClusterSelector(clusterSelectorContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [
        addrs[0],
        addrs[1],
        receiverStaking.address,
        NETWORK_IDS,
        WEIGHTS,
        [
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
          clusterSelector.address,
          "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        ],
        60000,
      ],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("admin can change network reward", async function () {
    await clusterRewards.updateNetwork(ethers.utils.id("DOT"), 400, clusterSelector.address);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("DOT"))).to.equal(400);
    expect(await clusterRewards.totalRewardWeight()).to.equal(TOTALWEIGHT - DOTWEIGHT + 400);
  });

  it("admin can change network reward", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await clusterRewards.updateNetwork(ethers.utils.id("DOT"), DOTWEIGHT, newClusterSelector.address);
    expect(await clusterRewards.clusterSelectors(DOTHASH)).to.equal(newClusterSelector.address);
  });

  it("admin cannot change non-existing network reward", async function () {
    await expect(clusterRewards.updateNetwork(ethers.utils.id("POLYGON"), 400, clusterSelector.address)).to.be.reverted;
  });

  it("admin cannot change clusterSelector of non-existing network", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await expect(clusterRewards.updateNetwork(ethers.utils.id("POLYGON"), DOTWEIGHT, newClusterSelector.address)).to.be.reverted;
  });

  it("non admin cannot change network reward", async function () {
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let newClusterSelector = await upgrades.deployProxy(ClusterSelector, [
      addrs[0], "0x000000000000000000000000000000000000dEaD", pond.address, new BN(10).pow(18).toString()
    ], {
      kind: "uups",
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH()]
    });
    await expect(clusterRewards.connect(signers[1]).updateNetwork(ethers.utils.id("DOT"), 400, newClusterSelector.address)).to.be.reverted;
  });

  it("admin can change rewards per epoch", async function () {
    await clusterRewards.changeRewardPerEpoch(200);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(200);
  });

  it("non admin cannot change rewards per epoch", async function () {
    await expect(clusterRewards.connect(signers[1]).changeRewardPerEpoch(200)).to.be.reverted;
  });
});

describe("ClusterRewards", function () {
  let clusterRewards: ClusterRewards;
  let signers: Signer[] = [];
  let addrs: string[] = [];

  let receiverStaking: Contract;
  let es1: Contract;
  let es2: Contract;
  let es3: Contract;

  let epochNumbersToUse: number[] = [1, 2, 3, 4, 5]; // keep this is ascending order for tests to run

  let clustersToSelect: number = 5;

  let ethClusters: Signer[] = [];
  let dotClusters: Signer[] = [];
  let nearClusters: Signer[] = [];

  let ethClusterAddresses: string[];
  let dotClusterAddresses: string[];
  let nearClusterAddresses: string[];

  let receiver: Signer;
  let claimer: Signer;

  let totalRewardsPerEpoch = FuzzedNumber.randomInRange(e16.mul(5), e18.mul(10));

  before(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    claimer = signers[1];

    const ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await deployMockContract(signers[0], ReceiverStaking.interface.format());

    const ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    es1 = await deployMockContract(signers[0], ClusterSelector.interface.format());
    es2 = await deployMockContract(signers[0], ClusterSelector.interface.format());
    es3 = await deployMockContract(signers[0], ClusterSelector.interface.format());

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsContract = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, NETWORK_IDS, WEIGHTS, [es1.address, es2.address, es3.address], totalRewardsPerEpoch],
      { kind: "uups" }
    );
    clusterRewards = getClusterRewards(clusterRewardsContract.address, signers[0]);

    ethClusters = signers.slice(350, 365);
    dotClusters = signers.slice(335, 350);
    nearClusters = signers.slice(320, 335);

    ethClusterAddresses = await Promise.all(ethClusters.map((a) => a.getAddress()));
    dotClusterAddresses = await Promise.all(dotClusters.map((a) => a.getAddress()));
    nearClusterAddresses = await Promise.all(nearClusters.map((a) => a.getAddress()));

    for (let index = 0; index < epochNumbersToUse.length; index++) {
      const element = epochNumbersToUse[index];
      await es1.mock.getClusters.withArgs(element).returns(getRandomElementsFromArray(ethClusterAddresses, clustersToSelect));
      await es2.mock.getClusters.withArgs(element).returns(getRandomElementsFromArray(dotClusterAddresses, clustersToSelect));
      await es3.mock.getClusters.withArgs(element).returns(getRandomElementsFromArray(nearClusterAddresses, clustersToSelect));
    }

    receiver = signers[13]; // can be any number not used

    for (let index = 0; index < epochNumbersToUse.length; index++) {
      const element = epochNumbersToUse[index];
      await receiverStaking.mock.getEpochInfo
        .withArgs(element)
        .returns(FuzzedNumber.randomInRange(e18, e20), epochNumbersToUse[epochNumbersToUse.length - 1]);

      await receiverStaking.mock.balanceOfSignerAt
        .withArgs(await receiver.getAddress(), element)
        .returns(FuzzedNumber.randomInRange(e18, e20), await receiver.getAddress());
    }
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("Issue tickets single epoch", async () => {
    const receiverAddress = await receiver.getAddress();
    const epoch = getRandomElementsFromArray(epochNumbersToUse.slice(0, 4), 1)[0]; // exclude last epoch
    const tickets = [FuzzedNumber.randomInRange(e16, e18)];

    // uint256 _index = _epoch/256;
    // uint256 _pos = _epoch%256;
    // uint256 _issuedFlags = ticketsIssued[_receiver][_index];
    // ticketsIssued[_receiver][_index] = _issuedFlags | 2**(255-_pos);

    const flagsBefore = await getFlagData(clusterRewards.connect(receiver), receiverAddress, epoch);
    await clusterRewards.connect(receiver)["issueTickets(bytes32,uint256,uint256[])"](ETHHASH, epoch, tickets);
    const flagsAfter = await getFlagData(clusterRewards.connect(receiver), receiverAddress, epoch);

    const pos = BigNumber.from(epoch).mod(256);
    const expectedFlagsAfter = flagsBefore.add(BigNumber.from(2).pow(BigNumber.from(255).sub(pos)));

    expect(expectedFlagsAfter).to.eq(flagsAfter);
  });

  it("Should Fail: Issue tickets multiple times in same epoch", async () => {
    const epoch = getRandomElementsFromArray(epochNumbersToUse.slice(0, 4), 1)[0]; // exclude last epoch
    const tickets = [FuzzedNumber.randomInRange(e16, e18)];

    await clusterRewards.connect(receiver)["issueTickets(bytes32,uint256,uint256[])"](ETHHASH, epoch, tickets);

    await expect(clusterRewards.connect(receiver)["issueTickets(bytes32,uint256,uint256[])"](ETHHASH, epoch, tickets)).to.be.reverted;
  });

  it("Issue tickets multiple epochs and claim", async () => {
    const numberOfEpochs = 3; //
    const epochs = getRandomElementsFromArray(epochNumbersToUse.slice(0, 4), numberOfEpochs);
    const tickets = [
      [
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
      ],
      [
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
      ],
      [
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
        FuzzedNumber.randomInRange(e16, e18).div(5),
      ],
    ];

    await clusterRewards.connect(receiver)["issueTickets(bytes32,uint256[],uint256[][])"](NEARHASH, epochs, tickets);

    for (let index = 0; index < nearClusterAddresses.length; index++) {
      const element = nearClusterAddresses[index];
      const prevReward = await clusterRewards.clusterRewards(element);
      await clusterRewards.connect(claimer).claimReward(element);

      if (prevReward.gt(1)) {
        const newReward = await clusterRewards.clusterRewards(element);
        expect(newReward).eq(1);
      }
    }
  });

  it("Issue Tickets (aggregate)", async () => {
    const ticket = FuzzedNumber.randomInRange(e16, e18);

    const epoch = getRandomElementsFromArray(epochNumbersToUse.slice(0, 4), 1)[0]; // exclude last epoch
    const abiCode = new ethers.utils.AbiCoder();
    // bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, keccak256(abi.encode(_epoch, _signedTicket.tickets))));

    const epoch_tickets = abiCode.encode(["bytes32", "uint256", "uint256[]"], [ETHHASH, epoch, [ticket]]);
    const hashOf_epoch_tickets = ethers.utils.keccak256(epoch_tickets);
    // console.log({hashOf_epoch_tickets: BigNumber.from(hashOf_epoch_tickets).toString()});
    console.log({ hashOf_epoch_tickets });
    const arraifiedHash = ethers.utils.arrayify(hashOf_epoch_tickets);
    const signature = await receiver.signMessage(arraifiedHash);

    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    const ticketDataToSubmit = [
      {
        tickets: [ticket],
        v,
        r,
        s,
      },
    ];

    await clusterRewards
      .connect(claimer)
      ["issueTickets(bytes32,uint256,(uint256[],uint8,bytes32,bytes32)[])"](ETHHASH, epoch, ticketDataToSubmit);
  });

  it("Should Fail: Replay tickets", async () => {
    const ticket = FuzzedNumber.randomInRange(e16, e18);

    const epoch = getRandomElementsFromArray(epochNumbersToUse.slice(0, 4), 1)[0]; // exclude last epoch
    const abiCode = new ethers.utils.AbiCoder();
    // bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, keccak256(abi.encode(_epoch, _signedTicket.tickets))));

    const epoch_tickets = abiCode.encode(["bytes32", "uint256", "uint256[]"], [ETHHASH, epoch, [ticket]]);
    const hashOf_epoch_tickets = ethers.utils.keccak256(epoch_tickets);
    // console.log({hashOf_epoch_tickets: BigNumber.from(hashOf_epoch_tickets).toString()});
    console.log({ hashOf_epoch_tickets });
    const arraifiedHash = ethers.utils.arrayify(hashOf_epoch_tickets);
    const signature = await receiver.signMessage(arraifiedHash);

    const r = signature.slice(0, 66);
    const s = "0x" + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    const ticketDataToSubmit = [
      {
        tickets: [ticket],
        v,
        r,
        s,
      },
    ];

    await clusterRewards
      .connect(claimer)
      ["issueTickets(bytes32,uint256,(uint256[],uint8,bytes32,bytes32)[])"](ETHHASH, epoch, ticketDataToSubmit);

    const someOtherEpoch = FuzzedNumber.randomInRange(epoch + 1, epoch + 100);
    await expect(
      clusterRewards
        .connect(claimer)
        ["issueTickets(bytes32,uint256,(uint256[],uint8,bytes32,bytes32)[])"](ETHHASH, someOtherEpoch, ticketDataToSubmit)
    ).to.be.reverted;
  });

  it("Check Feed", async () => {
    const cluster = getRandomElementsFromArray(nearClusterAddresses, 1)[0];
    const payout = FuzzedNumber.randomInRange("1000000000", "100000000000");
    const admin = signers[0];
    const FEEDER_ROLE = await clusterRewards.FEEDER_ROLE();
    await clusterRewards.connect(admin).grantRole(FEEDER_ROLE, await admin.getAddress());

    const epoch = getRandomElementsFromArray(epochNumbersToUse.slice(0, 4), 1)[0]; // exclude last epoch

    await receiverStaking.mock.START_TIME.returns(1111111); // any block time stamp
    await expect(clusterRewards.connect(admin).feed(NEARHASH, [cluster], [payout], epoch))
      .to.emit(clusterRewards, "ClusterRewarded")
      .withArgs(NEARHASH);
  });
});

async function getFlagData(clusterRewards: ClusterRewards, receiver: string, epoch: BigNumberish): Promise<BigNumber> {
  // uint256 _index = _epoch/256;
  // uint256 _pos = _epoch%256;
  // uint256 _issuedFlags = ticketsIssued[_receiver][_index];
  // ticketsIssued[_receiver][_index] = _issuedFlags | 2**(255-_pos);

  const index = BigNumber.from(epoch).div(256);
  // const pos = BigNumber.from(epoch).mod(256);

  const flags = await clusterRewards.ticketsIssued(receiver, index);

  return flags;
}
