import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { BigNumber as BN } from "bignumber.js";

async function skipBlocks(n: number) {
  await Promise.all([...Array(n)].map(async (x) => await ethers.provider.send("evm_mine", [])));
}

async function skipTime(t: number) {
  await ethers.provider.send("evm_increaseTime", [t]);
}

const ETHHASH = ethers.utils.id("ETH");
const DOTHASH = ethers.utils.id("DOT");
const NEARHASH = ethers.utils.id("NEAR");
const NETWORK_IDS = [ETHHASH, DOTHASH, NEARHASH];
const ETHWEIGHT = 100;
const DOTWEIGHT = 200;
const NEARWEIGHT = 300;
const WEIGHTS = [ETHWEIGHT, DOTWEIGHT, NEARWEIGHT];
const TOTALWEIGHT = ETHWEIGHT + DOTWEIGHT + NEARWEIGHT;

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let epochSelector: Contract;
  let receiverStaking: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pond.address, new BN(10).pow(18).toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);
  });

  it("deploys with initialization disabled", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewards = await ClusterRewards.deploy();

    await expect(clusterRewards.initialize(addrs[1], addrs[2], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000))
      .to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[1], addrs[2], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
      { kind: "uups" }
    );

    expect(await clusterRewards.hasRole(await clusterRewards.DEFAULT_ADMIN_ROLE(), addrs[1])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.CLAIMER_ROLE(), addrs[2])).to.be.true;
    await Promise.all(
      NETWORK_IDS.map(async (nid, idx) => {
        expect(await clusterRewards.rewardWeight(nid)).to.equal(WEIGHTS[idx]);
      })
    );
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(60000);
    expect(await clusterRewards.epochSelector()).to.equal(epochSelector.address);
    expect(await clusterRewards.receiverStaking()).to.equal(receiverStaking.address);
  });

  it("upgrades", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
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
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(60000);
  });

  it("does not upgrade without admin", async function () {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
      { kind: "uups" }
    );
    await expect(upgrades.upgradeProxy(clusterRewards.address, ClusterRewards.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;
  let epochSelector: Contract;
  let receiverStaking: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pond.address, new BN(10).pow(18).toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[1], addrs[2], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
      { kind: "uups" }
    );
  });

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
  let clusterRewards: Contract;
  let DEFAULT_ADMIN_ROLE: string;
  let epochSelector: Contract;
  let receiverStaking: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pond.address, new BN(10).pow(18).toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
      { kind: "uups" }
    );

    DEFAULT_ADMIN_ROLE = await clusterRewards.DEFAULT_ADMIN_ROLE();
  });

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
  let clusterRewards: Contract;
  let CLAIMER_ROLE: string;
  let epochSelector: Contract;
  let receiverStaking: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pond.address, new BN(10).pow(18).toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
      { kind: "uups" }
    );

    CLAIMER_ROLE = await clusterRewards.CLAIMER_ROLE();
  });

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
  let clusterRewards: Contract;
  let epochSelector: Contract;
  let receiverStaking: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pond.address, new BN(10).pow(18).toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
      { kind: "uups" }
    );
  });

  it("admin can add network", async function () {
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT + 400);
  });

  it("admin cannot add existing network", async function () {
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT + 400);

    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400)).to.be.reverted;
  });

  it("admin cannot add network with zero weight", async function () {
    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 0)).to.be.reverted;
  });

  it("non admin cannot add network", async function () {
    await expect(clusterRewards.connect(signers[1]).addNetwork(ethers.utils.id("POLYGON"), 400)).to.be.reverted;
  });

  it("admin can remove network", async function () {
    await clusterRewards.removeNetwork(ethers.utils.id("DOT"));
    expect(await clusterRewards.rewardWeight(ethers.utils.id("DOT"))).to.equal(0);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT - DOTWEIGHT);
  });

  it("admin cannot remove non-existing network", async function () {
    await expect(clusterRewards.removeNetwork(ethers.utils.id("POLYGON"))).to.be.reverted;
  });

  it("non admin cannot remove network", async function () {
    await expect(clusterRewards.connect(signers[1]).removeNetwork(ethers.utils.id("DOT"))).to.be.reverted;
  });
});

describe("ClusterRewards", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;
  let receiverStaking: Contract;
  let epochSelector: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(addrs[0], 5, blockData.timestamp, pond.address, new BN(10).pow(18).toString());

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });

    await receiverStaking.initialize(addrs[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewards = await upgrades.deployProxy(
      ClusterRewards,
      [addrs[0], addrs[1], receiverStaking.address, epochSelector.address, NETWORK_IDS, WEIGHTS, 60000],
      { kind: "uups" }
    );
  });

  it("admin can change network reward", async function () {
    await clusterRewards.changeNetworkReward(ethers.utils.id("DOT"), 400);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("DOT"))).to.equal(400);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT - DOTWEIGHT + 400);
  });

  it("admin cannot change non-existing network reward", async function () {
    await expect(clusterRewards.changeNetworkReward(ethers.utils.id("POLYGON"), 400)).to.be.reverted;
  });

  it("non admin cannot change network reward", async function () {
    await expect(clusterRewards.connect(signers[1]).changeNetworkReward(ethers.utils.id("DOT"), 400)).to.be.reverted;
  });

  it("admin can change rewards per epoch", async function () {
    await clusterRewards.changeRewardPerEpoch(200);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(200);
  });

  it("non admin cannot change rewards per epoch", async function () {
    await expect(clusterRewards.connect(signers[1]).changeRewardPerEpoch(200)).to.be.reverted;
  });
});
