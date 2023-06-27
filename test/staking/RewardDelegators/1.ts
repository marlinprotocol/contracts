import { expect, util } from "chai";
import { BigNumber, BigNumber as BN, Signer } from "ethers";
import { getAddress } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import {
  ArbGasInfo__factory,
  ClusterRegistry,
  ClusterRewards,
  ClusterSelector,
  MPond,
  Pond,
  ReceiverStaking,
  RewardDelegators,
  StakeManager,
} from "../../../typechain-types";
import { FuzzedAddress } from "../../../utils/fuzzer";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../../utils/testSuite";
import {
  getClusterRegistry,
  getClusterRewards,
  getClusterSelector,
  getMpond,
  getPond,
  getReceiverStaking,
  getRewardDelegators,
  getStakeManager,
} from "../../../utils/typechainConvertor";
import { skipBlocks, skipTime } from "../../helpers/common";
const stakingConfig = require("../../config/staking.json");

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
  let stakeManagerInstance: StakeManager;
  let pondInstance: Pond;
  let mpondInstance: MPond;
  let clusterRewardsInstance: ClusterRewards;
  let clusterRegistryInstance: ClusterRegistry;
  let pondTokenId: String;
  let mpondTokenId: String;

  const networkId = ethers.utils.id("DOT");

  before(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    let pondInstanceContract = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    pondInstance = getPond(pondInstanceContract.address, signers[0]);

    const MPond = await ethers.getContractFactory("MPond");
    let mpondInstanceContract = await upgrades.deployProxy(MPond, { kind: "uups" });
    mpondInstance = getMpond(mpondInstanceContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstanceContract = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    clusterRewardsInstance = getClusterRewards(clusterRewardsInstanceContract.address, signers[0]);

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstanceContract = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    clusterRegistryInstance = getClusterRegistry(clusterRegistryInstanceContract.address, signers[0]);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstanceContract = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    stakeManagerInstance = getStakeManager(stakeManagerInstanceContract.address, signers[0]);

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("deploys with initialization disabled", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await RewardDelegators.deploy();

    await expect(
      rewardDelegators.initialize(
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
        [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
        [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
        [networkId],
        [0]
      )
    ).to.be.reverted;
  });

  it("deploy as proxy and initializes", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
      [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
      [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
      [networkId],
      [0]
    );
    expect(await rewardDelegators.hasRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect([await rewardDelegators.tokenList(0), await rewardDelegators.tokenList(1)]).to.eql([pondTokenId, mpondTokenId]);
  });

  it("upgrades", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
      [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
      [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
      [networkId],
      [0]
    );
    await upgrades.upgradeProxy(rewardDelegators.address, RewardDelegators, { kind: "uups" });
    expect(await rewardDelegators.hasRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect([await rewardDelegators.tokenList(0), await rewardDelegators.tokenList(1)]).to.eql([pondTokenId, mpondTokenId]);

    expect(await rewardDelegators.stakeAddress()).to.be.eq(stakeManagerInstance.address);
    expect(await rewardDelegators.clusterRegistry()).to.be.eq(clusterRegistryInstance.address);
    expect(await rewardDelegators.clusterRewards()).to.be.eq(clusterRewardsInstance.address);
    expect(await rewardDelegators.PONDToken()).to.be.eq(pondInstance.address);

    expect(await rewardDelegators.rewardFactor(pondTokenId)).to.eq(stakingConfig.PondRewardFactor);
    expect(await rewardDelegators.rewardFactor(mpondTokenId)).to.eq(stakingConfig.MPondRewardFactor);
  });

  it("does not upgrade without admin", async () => {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      kind: "uups",
      initializer: false,
    });
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      [pondTokenId, mpondTokenId],
      [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
      [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
      [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
      [networkId],
      [0]
    );
    await expect(
      upgrades.upgradeProxy(rewardDelegators.address, RewardDelegators.connect(signers[1]), {
        kind: "uups",
      })
    ).to.be.reverted;
  });
});

describe("RewardDelegators", function () {
  let signers: Signer[];
  let stakeManagerInstance: StakeManager;
  let pondInstance: Pond;
  let mpondInstance: MPond;
  let clusterRewardsInstance: ClusterRewards;
  let clusterRegistryInstance: ClusterRegistry;
  let rewardDelegators: RewardDelegators;
  let pondTokenId: String;
  let mpondTokenId: String;

  const networkId = ethers.utils.id("DOT");

  before(async () => {
    signers = await ethers.getSigners();

    const Pond = await ethers.getContractFactory("Pond");
    let pondInstanceContract = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    pondInstance = getPond(pondInstanceContract.address, signers[0]);

    const MPond = await ethers.getContractFactory("MPond");
    let mpondInstanceContract = await upgrades.deployProxy(MPond, { kind: "uups" });
    mpondInstance = getMpond(mpondInstanceContract.address, signers[0]);

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstanceContract = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    clusterRewardsInstance = getClusterRewards(clusterRewardsInstanceContract.address, signers[0]);

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstanceContract = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    clusterRegistryInstance = getClusterRegistry(clusterRegistryInstanceContract.address, signers[0]);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstanceContract = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    stakeManagerInstance = getStakeManager(stakeManagerInstanceContract.address, signers[0]);

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegatorsContract = await upgrades.deployProxy(RewardDelegators, {
      kind: "uups",
      initializer: false,
    });
    rewardDelegators = getRewardDelegators(rewardDelegatorsContract.address, signers[0]);

    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      ["" + pondTokenId, "" + mpondTokenId],
      [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
      [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
      [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
      [networkId],
      [0]
    );
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("non owner cannot update PondAddress", async () => {
    const Pond = await ethers.getContractFactory("Pond");
    let pondInstance2 = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    await expect(rewardDelegators.connect(signers[1]).updatePONDAddress(pondInstance2.address)).to.be.reverted;
  });

  it("cannot update PondAddress to 0", async () => {
    await expect(rewardDelegators.updatePONDAddress(ethers.constants.AddressZero)).to.be.reverted;
  });

  it("owner can update PondAddress", async () => {
    const Pond = await ethers.getContractFactory("Pond");
    let pondInstance2 = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    await expect(rewardDelegators.updatePONDAddress(pondInstance2.address)).to.emit(rewardDelegators, "PONDAddressUpdated");
  });

  it("non owner cannot update ClusterRegistry", async () => {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstance2 = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await expect(rewardDelegators.connect(signers[1]).updateClusterRegistry(clusterRegistryInstance2.address)).to.be.reverted;
  });

  it("cannot update ClusterRegistry to 0", async () => {
    await expect(rewardDelegators.updateClusterRegistry(ethers.constants.AddressZero)).to.be.reverted;
  });

  it("owner can update ClusterRegistry", async () => {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstance2 = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    await expect(await rewardDelegators.updateClusterRegistry(clusterRegistryInstance2.address)).to.emit(
      rewardDelegators,
      "ClusterRegistryUpdated"
    );
  });

  it("non owner cannot update ClusterRewards", async () => {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstance2 = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    await expect(rewardDelegators.connect(signers[1]).updateClusterRewards(clusterRewardsInstance2.address)).to.be.reverted;
  });

  it("cannot update ClusterRewards to 0", async () => {
    await expect(rewardDelegators.updateClusterRewards(ethers.constants.AddressZero)).to.be.reverted;
  });

  it("owner can update ClusterRewards", async () => {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstance2 = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    await expect(await rewardDelegators.updateClusterRewards(clusterRewardsInstance2.address)).to.emit(
      rewardDelegators,
      "ClusterRewardsAddressUpdated"
    );
  });

  it("non owner cannot update StakeManager", async () => {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstance2 = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await expect(rewardDelegators.connect(signers[1]).updateStakeAddress(stakeManagerInstance2.address)).to.be.reverted;
  });

  it("cannot update StakeManager to 0", async () => {
    await expect(rewardDelegators.updateStakeAddress(ethers.constants.AddressZero)).to.be.reverted;
  });

  it("owner can update StakeManager", async () => {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstance2 = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    await expect(await rewardDelegators.updateStakeAddress(stakeManagerInstance2.address)).to.emit(rewardDelegators, "StakeAddressUpdated");
  });
});

describe("RewardDelegators", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManagerInstance: StakeManager;
  let pondInstance: Pond;
  let mpondInstance: MPond;
  let clusterRewardsInstance: ClusterRewards;
  let clusterRegistryInstance: ClusterRegistry;
  let rewardDelegators: RewardDelegators;
  let pondTokenId: String;
  let mpondTokenId: String;
  
  const networkId = ethers.utils.id("DOT");

  before(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const Pond = await ethers.getContractFactory("Pond");
    let pondInstanceContract = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    pondInstance = getPond(pondInstanceContract.address, signers[0]);

    const MPond = await ethers.getContractFactory("MPond");
    let mpondInstanceContract = await upgrades.deployProxy(MPond, { kind: "uups" });
    mpondInstance = getMpond(mpondInstanceContract.address, signers[0]);

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstanceContract = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    clusterRewardsInstance = getClusterRewards(clusterRewardsInstanceContract.address, signers[0]);

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstanceContract = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    clusterRegistryInstance = getClusterRegistry(clusterRegistryInstanceContract.address, signers[0]);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstanceContract = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    stakeManagerInstance = getStakeManager(stakeManagerInstanceContract.address, signers[0]);

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegatorsContract = await upgrades.deployProxy(RewardDelegators, {
      kind: "uups",
      initializer: false,
    });
    rewardDelegators = getRewardDelegators(rewardDelegatorsContract.address, signers[0]);
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      ["" + pondTokenId, "" + mpondTokenId],
      [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
      [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
      [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
      [networkId],
      [0]
    );
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("non owner cannot add rewardFactor", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.connect(signers[1]).addRewardFactor(testTokenId, 1)).to.be.reverted;
  });

  it(" cannot add for already existing tokenId", async () => {
    await expect(rewardDelegators.addRewardFactor("" + pondTokenId, stakingConfig.PondRewardFactor)).to.be.reverted;
  });

  it("cannot add 0 reward Factor", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.addRewardFactor(testTokenId, 0)).to.be.reverted;
  });

  it("owner can add rewardFactor", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(await rewardDelegators.addRewardFactor(testTokenId, 1)).to.emit(rewardDelegators, "AddReward");
  });

  it("non owner cannot remove rewardFactor", async () => {
    await expect(rewardDelegators.connect(signers[1]).removeRewardFactor("" + pondTokenId)).to.be.reverted;
  });

  it("cannot remove non existing tokenId", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.removeRewardFactor(testTokenId)).to.be.reverted;
  });

  it("owner can remove rewardFactor", async () => {
    await expect(await rewardDelegators.removeRewardFactor("" + pondTokenId)).to.emit(rewardDelegators, "RemoveReward");
  });

  it("non owner cannot update reward Factor", async () => {
    await expect(rewardDelegators.connect(signers[1]).updateRewardFactor("" + pondTokenId, stakingConfig.PondRewardFactor + 1)).to.be
      .reverted;
  });

  it("cannot update non existing tokenId", async () => {
    let testTokenId = await ethers.utils.keccak256(addrs[0]);
    await expect(rewardDelegators.updateRewardFactor(testTokenId, 1)).to.be.reverted;
  });

  it("cannot update rewardFactor to 0", async () => {
    await expect(rewardDelegators.updateRewardFactor("" + pondTokenId, 0)).to.be.reverted;
  });

  it("owner can update rewardFactor", async () => {
    await expect(await rewardDelegators.updateRewardFactor("" + pondTokenId, stakingConfig.PondRewardFactor + 1)).to.emit(
      rewardDelegators,
      "RewardsUpdated"
    );
  });
});

describe("RewardDelegators", function () {
  let signers: Signer[];
  let addrs: string[];
  let stakeManagerInstance: StakeManager;
  let pondInstance: Pond;
  let mpondInstance: MPond;
  let clusterRewardsInstance: ClusterRewards;
  let clusterRegistryInstance: ClusterRegistry;
  let rewardDelegators: RewardDelegators;

  let clusterSelector: ClusterSelector;

  let pondTokenId: String;
  let mpondTokenId: String;

  let rewardDelegatorsOwner: Signer;

  let registeredCluster: Signer;
  let registeredCluster1: Signer;
  let registeredCluster2: Signer;
  let registeredCluster3: Signer;
  let registeredCluster4: Signer;

  let delegator: Signer;

  let registeredClusterRewardAddress: string;
  let registeredClusterRewardAddress1: string;
  let registeredClusterRewardAddress2: string;
  let registeredClusterRewardAddress3: string;
  let registeredClusterRewardAddress4: string;

  let clientKey1: string;
  let clientKey2: string;
  let clientKey3: string;
  let clientKey4: string;
  let clientKey5: string;

  const networkId = ethers.utils.id("DOT");

  const smallAmount = BigNumber.from(10).pow(20);
  const largeAmount = BigNumber.from(10).pow(23);

  before(async () => {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    rewardDelegatorsOwner = signers[0];

    delegator = signers[19];

    clientKey1 = addrs[17];
    clientKey2 = addrs[18];
    clientKey3 = addrs[5];
    clientKey4 = addrs[12];
    clientKey5 = addrs[15];

    registeredCluster = signers[7];
    registeredCluster1 = signers[8];
    registeredCluster2 = signers[4];
    registeredCluster3 = signers[1];
    registeredCluster4 = signers[9];

    registeredClusterRewardAddress = addrs[16];
    registeredClusterRewardAddress1 = addrs[19];
    registeredClusterRewardAddress2 = addrs[21];
    registeredClusterRewardAddress3 = addrs[22];
    registeredClusterRewardAddress4 = addrs[23];

    const Pond = await ethers.getContractFactory("Pond");
    let pondInstanceContract = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    pondInstance = getPond(pondInstanceContract.address, signers[0]);

    const MPond = await ethers.getContractFactory("MPond");
    let mpondInstanceContract = await upgrades.deployProxy(MPond, { kind: "uups" });
    mpondInstance = getMpond(mpondInstanceContract.address, signers[0]);

    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstanceContract = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    clusterRewardsInstance = getClusterRewards(clusterRewardsInstanceContract.address, signers[0]);

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstanceContract = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    clusterRegistryInstance = getClusterRegistry(clusterRegistryInstanceContract.address, signers[0]);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstanceContract = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    stakeManagerInstance = getStakeManager(stakeManagerInstanceContract.address, signers[0]);

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegatorsContract = await upgrades.deployProxy(RewardDelegators, {
      kind: "uups",
      initializer: false,
    });
    rewardDelegators = getRewardDelegators(rewardDelegatorsContract.address, signers[0]);
    await rewardDelegators.initialize(
      stakeManagerInstance.address,
      clusterRewardsInstance.address,
      clusterRegistryInstance.address,
      pondInstance.address,
      ["" + pondTokenId, "" + mpondTokenId],
      [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
      [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
      [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
      [networkId],
      [0]
    );

    const lockWaitTimes = [20, 21, 22];
    await clusterRegistryInstance.initialize([lockWaitTimes[0], lockWaitTimes[1], lockWaitTimes[2]], rewardDelegators.address);

    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), await delegator.getAddress());
    await pondInstance.transfer(await delegator.getAddress(), largeAmount);
    await mpondInstance.transfer(await delegator.getAddress(), smallAmount);

    const blockData = await ethers.provider.getBlock("latest");

    const arbGasInfo = await new ArbGasInfo__factory(signers[0]).deploy()
    // Todo: Check and change the value accordingly
    await arbGasInfo.setPrices(1000, 1000, 1000)
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(
      ClusterSelector,
      [addrs[0], rewardDelegators.address],
      {
        kind: "uups",
        // Todo: Check and change the values accordingly
        constructorArgs: [blockData.timestamp, 4 * 3600, arbGasInfo.address, '100000', '100000'],
      }
    );
    clusterSelector = getClusterSelector(clusterSelectorContract.address, signers[0]);

    await clusterRewardsInstance.initialize(
      addrs[0],
      rewardDelegators.address,
      "0x000000000000000000000000000000000000dEaD", // receiver staking address not used here
      [networkId, ethers.utils.id("MATIC"), ethers.utils.id("ETH")],
      [100, 100, 100],
      [
        clusterSelector.address,
        "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
        "0x000000000000000000000000000000000000dEaD", // invalid epoch selector
      ],
      stakingConfig.rewardPerEpoch
    );

    await clusterRewardsInstance.grantRole(await clusterRewardsInstance.DEFAULT_ADMIN_ROLE(), await signers[0].getAddress());

    await stakeManagerInstance.initialize(
      ["" + pondTokenId, "" + mpondTokenId],
      [pondInstance.address, mpondInstance.address],
      [false, true],
      rewardDelegators.address,
      5,
      stakingConfig.undelegationWaitTime
    );

    await rewardDelegators
      .connect(signers[0])
      .grantRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), await rewardDelegatorsOwner.getAddress());
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("Check Interface", async () => {
    expect(await rewardDelegators.supportsInterface("0x00001111")).to.be.false;
  });

  it("Check Revoke role", async () => {
    const anotherAdmin = FuzzedAddress.random();

    await rewardDelegators.connect(rewardDelegatorsOwner).grantRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), anotherAdmin);

    await rewardDelegators
      .connect(rewardDelegatorsOwner)
      .revokeRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), await rewardDelegatorsOwner.getAddress());

    expect(await rewardDelegators.hasRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), await rewardDelegatorsOwner.getAddress())).to.be
      .false;
  });

  it("Update weight", async () => {
    await expect(rewardDelegators.connect(rewardDelegatorsOwner).updateTokenWeights(networkId, 120, 200))
      .to.emit(rewardDelegators, "TokenWeightsUpdated")
      .withArgs(networkId, 120, 200);
  });

  it("if cluster selector doesnt exist for changes to clusterDelegation", async () => {
    const commission = 5;
    await clusterRegistryInstance.connect(registeredCluster).register(networkId, commission, registeredClusterRewardAddress, clientKey1);
    await clusterRegistryInstance.connect(registeredCluster1).register(networkId, commission, registeredClusterRewardAddress1, clientKey2);
    await clusterRegistryInstance.connect(registeredCluster2).register(networkId, commission, registeredClusterRewardAddress2, clientKey3);
    await clusterRegistryInstance.connect(registeredCluster3).register(ethers.utils.id("RANDOM"), commission, registeredClusterRewardAddress3, clientKey4);
    await clusterRegistryInstance.connect(registeredCluster4).register(ethers.utils.id("RANDOM"), commission, registeredClusterRewardAddress4, clientKey5);
    
    const fakeClusterRegistry = signers[10];
    await rewardDelegators.updateClusterRegistry(await fakeClusterRegistry.getAddress());

    // TODO: Write assertions
    await rewardDelegators.connect(fakeClusterRegistry).updateClusterDelegation(await registeredCluster1.getAddress(), networkId);

    await rewardDelegators.connect(fakeClusterRegistry).updateClusterDelegation(await registeredCluster3.getAddress(), networkId);

    await rewardDelegators.connect(fakeClusterRegistry).removeClusterDelegation(await registeredCluster4.getAddress(), ethers.utils.id("RANDOM"));

    await rewardDelegators.connect(fakeClusterRegistry).removeClusterDelegation(await registeredCluster1.getAddress(), networkId);
  })

  it("refresh cluster delegation", async () => {
    // Check For Correct Update Case
    const commission = 5;

    await clusterRegistryInstance.connect(registeredCluster).register(networkId, commission, registeredClusterRewardAddress, clientKey1);
    await clusterRegistryInstance.connect(registeredCluster1).register(networkId, commission, registeredClusterRewardAddress1, clientKey2);
    await clusterRegistryInstance.connect(registeredCluster2).register(networkId, commission, registeredClusterRewardAddress2, clientKey3);
    await clusterRegistryInstance.connect(registeredCluster3).register(networkId, commission, registeredClusterRewardAddress3, clientKey4);
    await clusterRegistryInstance.connect(registeredCluster4).register(networkId, commission, registeredClusterRewardAddress4, clientKey5);

    const smallAmount1 = smallAmount.div(5);
    const largeAmount1 = largeAmount.div(5);

    await pondInstance.connect(delegator).approve(stakeManagerInstance.address, largeAmount);
    await mpondInstance.connect(delegator).approve(stakeManagerInstance.address, smallAmount);

    await stakeManagerInstance
      .connect(delegator)
      .createStashAndDelegate(["" + pondTokenId, "" + mpondTokenId], [largeAmount1, smallAmount1], await registeredCluster.getAddress());

    const clusterAddress = await registeredCluster.getAddress();

    expect(await rewardDelegators.getClusterDelegation(clusterAddress, "" + pondTokenId)).to.eq(largeAmount1);
    expect(await rewardDelegators.getClusterDelegation(clusterAddress, "" + mpondTokenId)).to.eq(smallAmount1);

    await expect(
      rewardDelegators.connect(rewardDelegatorsOwner).refreshClusterDelegation(networkId, [await registeredCluster.getAddress()])
    ).to.emit(rewardDelegators, "RefreshClusterDelegation");

    await expect(rewardDelegators.connect(rewardDelegatorsOwner).updateThresholdForSelection(networkId, 1000)).to.emit(
      rewardDelegators,
      "ThresholdForSelectionUpdated"
    );

    // when random address is refreshed, the event should not be emitted
    await expect(
      rewardDelegators.connect(rewardDelegatorsOwner).refreshClusterDelegation(networkId, [await registeredCluster1.getAddress()])
    ).to.not.emit(rewardDelegators, "RefreshClusterDelegation");
  });

  it("update threshold for selection", async () => {
    const threshold = 12;
    await expect(rewardDelegators.connect(rewardDelegatorsOwner).updateThresholdForSelection(networkId, threshold))
      .to.emit(rewardDelegators, "ThresholdForSelectionUpdated")
      .withArgs(networkId, threshold);
  });

  it("undelegate stash", async () => {
    const commission = 5;

    await clusterRegistryInstance.connect(registeredCluster).register(networkId, commission, registeredClusterRewardAddress, clientKey1);

    const smallAmount1 = smallAmount.div(5);
    const largeAmount1 = largeAmount.div(5);

    await pondInstance.connect(delegator).approve(stakeManagerInstance.address, largeAmount);
    await mpondInstance.connect(delegator).approve(stakeManagerInstance.address, smallAmount);

    const receipt = await stakeManagerInstance
      .connect(delegator)
      .createStashAndDelegate(["" + pondTokenId, "" + mpondTokenId], [largeAmount1, smallAmount1], await registeredCluster.getAddress());

    const events = (await receipt.wait()).events
      ?.filter((a) => a.address.toLowerCase() == stakeManagerInstance.address.toLowerCase())
      .filter((a) => a.event == "StashCreated");

    if (events && events.length > 0) {
      const stashId = (events[0].args as any[])[0];

      await stakeManagerInstance.connect(delegator).undelegateStash(stashId);
    } else {
      throw new Error("event expected");
    }
  });
});

describe("RewardDelegators Deployment (These tests should be run serially)", function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistryInstance: ClusterRegistry;
  let pondInstance: Pond;
  let mpondInstance: MPond;
  let rewardDelegatorsInstance: RewardDelegators;
  let clusterRewardsInstance: ClusterRewards;
  let stakeManagerInstance: StakeManager;
  let testTokenInstance: Pond;
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
  let delegator: Signer;
  let mpondAccount: Signer;
  let clientKey1: string;
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

  let clusterSelectorInstance: ClusterSelector;

  let receiverStaking: ReceiverStaking;
  let receiverStaker: Signer;
  let receiverStakerAddress: string;
  let receiverSigner: Signer;
  let receiverSigningKey: string;

  const networkId = ethers.utils.id("DOT");

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    mpondAccount = signers[2];
    delegator = signers[3];
    delegator3 = signers[5];
    delegator4 = signers[12];
    rewardDelegatorsOwner = signers[0];
    delegator1 = signers[17];
    delegator2 = signers[18];
    receiverStaker = signers[20];
    receiverStakerAddress = addrs[20];
    receiverSigner = signers[10];
    receiverSigningKey = addrs[10];

    clientKey1 = addrs[17];
    clientKey2 = addrs[18];
    clientKey3 = addrs[5];
    clientKey4 = addrs[12];
    clientKey5 = addrs[15];

    registeredCluster = signers[7];
    registeredCluster1 = signers[8];
    registeredCluster2 = signers[4];
    registeredCluster3 = signers[1];
    registeredCluster4 = signers[9];

    registeredClusterRewardAddress = addrs[16];
    registeredClusterRewardAddress1 = addrs[19];
    registeredClusterRewardAddress2 = addrs[21];
    registeredClusterRewardAddress3 = addrs[22];
    registeredClusterRewardAddress4 = addrs[23];
  });

  it("deploys with initialization disabled", async function () {
    const Pond = await ethers.getContractFactory("Pond");
    let pondInstanceContract = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    pondInstance = getPond(pondInstanceContract.address, signers[0]);

    const MPond = await ethers.getContractFactory("MPond");
    let mpondInstanceContract = await upgrades.deployProxy(MPond, { kind: "uups" });
    mpondInstance = getMpond(mpondInstanceContract.address, signers[0]);

    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), await mpondAccount.getAddress());
    await mpondInstance.transfer(await mpondAccount.getAddress(), BN.from(3000).e18());
    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstanceContract = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    stakeManagerInstance = getStakeManager(stakeManagerInstanceContract.address, signers[0]);

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstanceContract = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    clusterRegistryInstance = getClusterRegistry(clusterRegistryInstanceContract.address, signers[0]);

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    let rewardDelegatorsInstanceContract = await RewardDelegators.deploy();
    rewardDelegatorsInstance = getRewardDelegators(rewardDelegatorsInstanceContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstanceContract = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    clusterRewardsInstance = getClusterRewards(clusterRewardsInstanceContract.address, signers[0]);

    await expect(
      rewardDelegatorsInstance.initialize(
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
        [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
        [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
        [networkId],
        [0]
      )
    ).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    const rewardDelegatorsInstanceContract = await upgrades.deployProxy(
      RewardDelegators,
      [
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [pondTokenId, mpondTokenId],
        [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
        [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
        [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation],
        [networkId],
        // Todo: Check if this value acceptable
        [0]
      ],
      { kind: "uups" }
    );
    rewardDelegatorsInstance = getRewardDelegators(rewardDelegatorsInstanceContract.address, signers[0]);
    const lockWaitTimes = [20, 21, 22];
    await clusterRegistryInstance.initialize([lockWaitTimes[0], lockWaitTimes[1], lockWaitTimes[2]], rewardDelegatorsInstance.address);

    await stakeManagerInstance.initialize(
      [pondTokenId, mpondTokenId],
      [pondInstance.address, mpondInstance.address],
      [false, true],
      rewardDelegatorsInstance.address,
      5,
      stakingConfig.undelegationWaitTime
    );

    const blockData = await ethers.provider.getBlock("latest");
    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pondInstance.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);

    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    const arbGasInfo = await new ArbGasInfo__factory(signers[0]).deploy()
    // Todo: Check and change the value accordingly
    await arbGasInfo.setPrices(1000, 1000, 1000)

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0],
      rewardDelegatorsInstance.address
    ], {
      kind: "uups",
      // Todo: Check and change the values accordingly
      constructorArgs: [await receiverStaking.START_TIME(), await receiverStaking.EPOCH_LENGTH(), arbGasInfo.address, '1000000', '1000000']
    });
    clusterSelectorInstance = getClusterSelector(clusterSelectorContract.address, signers[0]);

    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    await clusterRewardsInstance.initialize(
      addrs[0],
      rewardDelegatorsInstance.address,
      receiverStaking.address,
      [ethers.utils.id("DOT"), ethers.utils.id("MATIC"), ethers.utils.id("ETH")],
      [100, 100, 100],
      [
        clusterSelectorInstance.address,
        "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
        "0x000000000000000000000000000000000000dEaD", // invalid cluster selector
      ],
      stakingConfig.rewardPerEpoch
    );

    await pondInstance.transfer(clusterRewardsInstance.address, stakingConfig.rewardPerEpoch * 100);
    // initialize contract and check if all variables are correctly set(including admin)
    expect(await stakeManagerInstance.lockWaitTime(await stakeManagerInstance.UNDELEGATION_LOCK_SELECTOR())).to.equal(
      stakingConfig.undelegationWaitTime
    );

    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 61]);
    await ethers.provider.send("evm_mine", []);
  });

  it("upgrades", async function () {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    await upgrades.upgradeProxy(rewardDelegatorsInstance.address, RewardDelegators.connect(rewardDelegatorsOwner), {
      kind: "uups",
    });
  });

  it("does not upgrade without admin", async function () {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    await expect(
      upgrades.upgradeProxy(rewardDelegatorsInstance.address, RewardDelegators.connect(signers[1]), {
        kind: "uups",
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

    await skipBlocks(ethers, 10); // skip blocks to ensure feedData has enough time diff between them.

    let pondToUse = BigNumber.from(10).pow(18).mul(1000000).toString(); // 1 million pond

    await pondInstance.transfer(receiverStakerAddress, pondToUse);
    await pondInstance.connect(receiverStaker).approve(receiverStaking.address, pondToUse);
    await receiverStaking.connect(receiverStaker).depositAndSetSigner(pondToUse, receiverSigningKey);

    let [epoch, clusters] = await mineTillGivenClusterIsSelected(clusterSelectorInstance, registeredCluster, false);

    const tickets: BigNumber[] = [];
    for (let i = 0; i < clusters.length; i++) {
      let value = BigNumber.from(0);
      if (clusters[i] == (await registeredCluster.getAddress()).toLowerCase()) value = BigNumber.from(2).pow(16);
      tickets.push(value);
    }

    await ethers.provider.send("evm_increaseTime", [4 * 60 * 61]);
    await ethers.provider.send("evm_mine", []);

    await clusterRewardsInstance.connect(receiverSigner)["issueTickets(bytes32,uint24,uint16[])"](ethers.utils.id("DOT"), epoch, tickets);

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
    await pondInstance.transfer(rewardDelegatorsInstance.address, stakingConfig.rewardPerEpoch * 100);
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

    let [epoch, clusters] = (await mineTillGivenClusterIsSelected(clusterSelectorInstance, registeredCluster1, false));

    const tickets: BigNumber[] = [];
    for (let i = 0; i < clusters.length; i++) {
      let value = BigNumber.from(0);
      if (clusters[i] == (await registeredCluster1.getAddress()).toLowerCase()) value = BigNumber.from(2).pow(16);
      tickets.push(value);
    }

    await clusterRewardsInstance.connect(receiverSigner)["issueTickets(bytes32,uint24,uint16[])"](ethers.utils.id("DOT"), epoch, tickets);

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    const cluster1Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster1.getAddress());
    // const cluster2Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster2.getAddress());

    // expect(cluster1Reward).to.equal(Math.round((((10 + 2) / (10 + 2 + 4 + 2)) * stakingConfig.rewardPerEpoch) / 3));
    // expect(cluster2Reward).to.equal(Math.round((((4 + 2) / (10 + 2 + 4 + 2)) * stakingConfig.rewardPerEpoch) / 3));

    // issue tickets have no link with total delegations to cluster, hence skipping it.
    expect(cluster1Reward).to.eq((stakingConfig.rewardPerEpoch/3).toFixed(0));

    // do some delegations for both users to the cluster
    // rewards for one user is withdraw - this reward should be as per the time of oracle feed
    let PondBalance1Before = await pondInstance.balanceOf(await delegator1.getAddress());
    await delegate(delegator1, [await registeredCluster1.getAddress(), await registeredCluster2.getAddress()], [0, 4], [2000000, 0]);
    let PondBalance1After = await pondInstance.balanceOf(await delegator1.getAddress());
    let accPondRewardPerShare = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster1.getAddress(), pondTokenId);
    let accMPondRewardPerShare = await rewardDelegatorsInstance.getAccRewardPerShare(await registeredCluster1.getAddress(), mpondTokenId);
    // substract 1 from the delegator rewards according to contract changes?
    // expect(PondBalance1After.sub(PondBalance1Before)).to.equal(Math.round(stakingConfig.rewardPerEpoch * 1 / 3 * (2.0 / 3 * 1 / 2 + 1.0 / 3 * 1 / 2) - 1)); // TODO
    // feed data again to the oracle
    // await feedData([registeredCluster, registeredCluster1, registeredCluster2, registeredCluster3, registeredCluster4]);
    // // do some delegations for both users to the cluster
    // let PondBalance2Before = await PONDInstance.balanceOf(delegator2);
    // await delegate(delegator2, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);PondBalance1Before
    // let PondBalance2After = await PONDInstance.balanceOf(delegator2);
    // console.log(PondBalance2After.sub(PondBalance2Before).toString(), stakingConfig.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5)));
    // assert(PondBalance2After.sub(PondBalance2Before).toString() == parseInt(stakingConfig.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5))));
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

    let [epoch, clusters] = await mineTillGivenClusterIsSelected(clusterSelectorInstance, registeredCluster3, false);

    const tickets: BigNumber[] = [];
    for (let i = 0; i < clusters.length; i++) {
      let value = BigNumber.from(0);
      if (clusters[i] == (await registeredCluster3.getAddress()).toLowerCase()) value = BigNumber.from(2).pow(16);
      tickets.push(value);
    }

    console.log({ tickets });

    await clusterRewardsInstance.connect(receiverSigner)["issueTickets(bytes32,uint24,uint16[])"](ethers.utils.id("DOT"), epoch, tickets);

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    const clusterReward = await clusterRewardsInstance.clusterRewards(await registeredCluster3.getAddress());
    console.log("clusterReward", clusterReward.toString());
    // const clusterCommission = Math.ceil((Number(clusterReward) / 100) * commission);

    const delegatorOldBalance = await pondInstance.balanceOf(await delegator3.getAddress());
    expect(Number(delegatorOldBalance)).to.equal(0);
    await rewardDelegatorsInstance
      .connect(delegator3)
      ["withdrawRewards(address,address[])"](await delegator3.getAddress(), [await registeredCluster3.getAddress()]);
    const delegatorNewBalance = await pondInstance.balanceOf(await delegator3.getAddress());
    expect(Number(delegatorNewBalance)).to.equal(527);
  });

  it("reinitialize contract then delegate and withdraw rewards for single token", async () => {
    // deploy pond and mpond tokens
    const Pond = await ethers.getContractFactory("Pond");
    const pondInstanceContract = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    pondInstance = getPond(pondInstanceContract.address, signers[0]);

    const MPond = await ethers.getContractFactory("MPond");
    let mpondInstanceContract = await upgrades.deployProxy(MPond, { kind: "uups" });
    mpondInstance = getMpond(mpondInstanceContract.address, signers[0]);
    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), await mpondAccount.getAddress());
    await mpondInstance.transfer(await mpondAccount.getAddress(), BN.from(3000).e18());
    pondTokenId = ethers.utils.keccak256(pondInstance.address);
    mpondTokenId = ethers.utils.keccak256(mpondInstance.address);

    // deploy a test erc20 token

    let testTokenInstanceContract = await upgrades.deployProxy(Pond, ["TestToken", "TEST"], { kind: "uups" });
    testTokenInstance = getPond(testTokenInstanceContract.address, signers[0]);
    const testTokenId = ethers.utils.keccak256(testTokenInstance.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    let stakeManagerInstanceContract = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });
    stakeManagerInstance = getStakeManager(stakeManagerInstanceContract.address, signers[0]);

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    let clusterRegistryInstanceContract = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });
    clusterRegistryInstance = getClusterRegistry(clusterRegistryInstanceContract.address, signers[0]);

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    let clusterRewardsInstanceContract = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });
    clusterRewardsInstance = getClusterRewards(clusterRewardsInstanceContract.address, signers[0]);

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");

    let rewardDelegatorsInstanceContract = await upgrades.deployProxy(
      RewardDelegators,
      [
        stakeManagerInstance.address,
        clusterRewardsInstance.address,
        clusterRegistryInstance.address,
        pondInstance.address,
        [testTokenId],
        [100],
        [1],
        [1],
        [networkId],
        [0]
      ],
      { kind: "uups" }
    );
    rewardDelegatorsInstance = getRewardDelegators(rewardDelegatorsInstanceContract.address, signers[0]);

    await clusterRegistryInstance.initialize([lockWaitTimes[0], lockWaitTimes[1], lockWaitTimes[2]], rewardDelegatorsInstance.address);

    const blockData = await ethers.provider.getBlock("latest");

    const arbGasInfo = await new ArbGasInfo__factory(signers[0]).deploy()
    // Todo: Check and change the value accordingly
    await arbGasInfo.setPrices(1000, 1000, 1000)

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      addrs[0],
      rewardDelegatorsInstance.address,
    ], {
      kind: "uups",
      // Todo: Check and change the values accordingly
      constructorArgs: [blockData.timestamp, 4*60*60, arbGasInfo.address, '100000', '100000']
    });
    clusterSelectorInstance = getClusterSelector(clusterSelectorContract.address, signers[0]);

    await rewardDelegatorsInstance.connect(signers[0]).updateClusterRewards(clusterRewardsInstance.address);

    await stakeManagerInstance.initialize(
      [testTokenId],
      [testTokenInstance.address],
      [false, true],
      rewardDelegatorsInstance.address,
      5,
      stakingConfig.undelegationWaitTime
    );

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    let receiverStakingContract = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600, pondInstance.address],
      kind: "uups",
      initializer: false,
    });
    receiverStaking = getReceiverStaking(receiverStakingContract.address, signers[0]);
    await receiverStaking.initialize(addrs[0], "Receiver POND", "rPOND");

    await clusterRewardsInstance.initialize(
      addrs[0],
      rewardDelegatorsInstance.address,
      receiverStaking.address,
      [ethers.utils.id("DOT")],
      [100],
      [clusterSelectorInstance.address],
      stakingConfig.rewardPerEpoch
    );

    await mpondInstance.grantRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address);
    expect(await mpondInstance.hasRole(await mpondInstance.WHITELIST_ROLE(), stakeManagerInstance.address)).to.be.true;

    await pondInstance.transfer(clusterRewardsInstance.address, stakingConfig.rewardPerEpoch * 100);

    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 61]);
    await ethers.provider.send("evm_mine", []);

    await registerCluster(
      10,
      clusterRegistryInstance,
      registeredCluster4,
      registeredClusterRewardAddress1,
      ethers.utils.id("DOT"),
      clientKey5
    );

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
    await delegateToken(delegator1, [await registeredCluster4.getAddress()], [BigNumber.from(10).pow(18).mul(1)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster4.getAddress()], [BigNumber.from(10).pow(18).mul(2).mul(1)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster3.getAddress()], [BigNumber.from(10).pow(18).mul(2)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster3.getAddress()], [BigNumber.from(10).pow(18).mul(2).mul(2)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster2.getAddress()], [BigNumber.from(10).pow(18).mul(3)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster2.getAddress()], [BigNumber.from(10).pow(18).mul(2).mul(3)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster1.getAddress()], [BigNumber.from(10).pow(18).mul(4)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster1.getAddress()], [BigNumber.from(10).pow(18).mul(2).mul(4)], testTokenInstance);

    await delegateToken(delegator1, [await registeredCluster.getAddress()], [BigNumber.from(10).pow(18).mul(5)], testTokenInstance);
    await delegateToken(delegator2, [await registeredCluster.getAddress()], [BigNumber.from(10).pow(18).mul(2).mul(5)], testTokenInstance);

    await skipBlocks(ethers, 10);

    // cluster reward

    let pondToUse = BigNumber.from(10).pow(18).mul(1000000).toString(); // 1 million pond

    await pondInstance.transfer(receiverStakerAddress, pondToUse);
    await pondInstance.connect(receiverStaker).approve(receiverStaking.address, pondToUse);
    await receiverStaking.connect(receiverStaker).depositAndSetSigner(pondToUse, await receiverSigner.getAddress()); // 1 million pond

    let [epoch, clusters] = await mineTillGivenClusterIsSelected(clusterSelectorInstance, registeredCluster4, false);

    const tickets: BigNumber[] = [];
    for (let i = 0; i < clusters.length; i++) {
      let value = BigNumber.from(0);
      if (clusters[i] == (await registeredCluster.getAddress()).toLowerCase()) value = BigNumber.from(2).pow(16);
      tickets.push(value);
    }

    await clusterRewardsInstance.connect(receiverSigner)["issueTickets(bytes32,uint24,uint16[])"](ethers.utils.id("DOT"), epoch, tickets);

    // await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    // await ethers.provider.send("evm_mine", []);

    // const cluster4Reward = await clusterRewardsInstance.clusterRewards(await registeredCluster4.getAddress());
    // expect(cluster4Reward).to.equal(10000);

    // // transfer POND for rewards
    // await pondInstance.transfer(rewardDelegatorsInstance.address, stakingConfig.rewardPerEpoch * 100);
    // await rewardDelegatorsInstance
    //   .connect(delegator1)
    //   ["withdrawRewards(address,address)"](await delegator1.getAddress(), await registeredCluster4.getAddress());

    // // delegator reward
    // const delegator1AfterBalance = await pondInstance.balanceOf(await delegator1.getAddress());
    // expect(await delegator1AfterBalance).to.equal(3000);
  });

  it("Add, remove and update reward Factor", async () => {
    const testTokenId = ethers.utils.id("testTokenId");
    // only owner can add the reward factor
    await expect(rewardDelegatorsInstance.connect(signers[1]).addRewardFactor(testTokenId, 10)).to.be.reverted;
    await expect(await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).addRewardFactor(testTokenId, 10)).to.emit(
      rewardDelegatorsInstance,
      "AddReward"
    );

    // only owner can update the reward factor
    await expect(rewardDelegatorsInstance.connect(signers[1]).updateRewardFactor(testTokenId, 100)).to.be.reverted;
    await expect(await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateRewardFactor(testTokenId, 100)).to.emit(
      rewardDelegatorsInstance,
      "RewardsUpdated"
    );

    // only owner can remove the reward factor
    await expect(rewardDelegatorsInstance.connect(signers[1]).removeRewardFactor(testTokenId)).to.be.reverted;
    await expect(await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).removeRewardFactor(testTokenId)).to.emit(
      rewardDelegatorsInstance,
      "RemoveReward"
    );
  });

  it("update stake address", async () => {
    const StakeManager = await ethers.getContractFactory("StakeManager");
    const tempStakeManagerInstance = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updateStakeAddress(tempStakeManagerInstance.address)).to.be.reverted;
    await expect(
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateStakeAddress(tempStakeManagerInstance.address)
    ).to.emit(rewardDelegatorsInstance, "StakeAddressUpdated");

    //change back to original
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateStakeAddress(stakeManagerInstance.address);
  });

  it("update clusterReward address", async () => {
    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    const tempCLusterRewardInstance = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updateClusterRewards(tempCLusterRewardInstance.address)).to.be.reverted;
    await expect(
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRewards(tempCLusterRewardInstance.address)
    ).to.emit(rewardDelegatorsInstance, "ClusterRewardsAddressUpdated");

    //change back to original
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRewards(clusterRewardsInstance.address);
  });

  it("update clusterRegistry address", async () => {
    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    const tempCLusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updateClusterRegistry(tempCLusterRegistryInstance.address)).to.be.reverted;
    await expect(
      await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRegistry(tempCLusterRegistryInstance.address)
    ).to.emit(rewardDelegatorsInstance, "ClusterRegistryUpdated");

    //change back to original
    await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updateClusterRegistry(clusterRegistryInstance.address);
  });

  it("update POND address", async () => {
    const Pond = await ethers.getContractFactory("Pond");
    const tempPondInstance = await upgrades.deployProxy(Pond, { kind: "uups", initializer: false });

    await expect(rewardDelegatorsInstance.connect(signers[1]).updatePONDAddress(tempPondInstance.address)).to.be.reverted;
    await expect(await rewardDelegatorsInstance.connect(rewardDelegatorsOwner).updatePONDAddress(tempPondInstance.address)).to.emit(
      rewardDelegatorsInstance,
      "PONDAddressUpdated"
    );

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

  async function delegateToken(delegator: Signer, clusters: string[], tokenAmounts: any[], tokenInstance: Pond) {
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
    clusterSelector: ClusterSelector,
    registeredCluster: Signer,
    print: boolean,
    iter = 0
  ): Promise<[ currentEpoch: number, clusters: string[] ]> {
    let currentEpoch = (await clusterSelector.getCurrentEpoch()).toNumber();

    let registeredClusterAddress = (await registeredCluster.getAddress()).toLowerCase();
    for (;;) {
      let clusters = (await clusterSelector.getClusters(currentEpoch)) as string[];
      if (print) {
        console.log({ iter, clusters, currentEpoch });
      }
      clusters = clusters.map((a) => a.toLowerCase());

      if (clusters.includes(registeredClusterAddress)) {
        await ethers.provider.send("evm_increaseTime", [4 * 60 * 61]);
        await ethers.provider.send("evm_mine", []);
        return [currentEpoch, clusters];
      } else {
        await ethers.provider.send("evm_increaseTime", [4 * 60 * 61]);
        await ethers.provider.send("evm_mine", []);

        await clusterSelector.connect(registeredCluster).selectClusters();
        currentEpoch = BigNumber.from(currentEpoch.toString()).add(1).toNumber();
      }
      iter++;
    }
  }
});

async function registerCluster(
  commission: number,
  clusterRegistryInstance: ClusterRegistry,
  registeredCluster: Signer,
  registeredClusterRewardAddress: string,
  networkId: string,
  clientKey1: string
) {
  await clusterRegistryInstance.connect(registeredCluster).register(networkId, commission, registeredClusterRewardAddress, clientKey1);
}
