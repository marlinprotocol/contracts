import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";
const appConfig = require("../app-config");

const UNDELEGATION_WAIT_TIME = 604800;
const REDELEGATION_WAIT_TIME = 21600;
const REWARD_PER_EPOCH = appConfig.staking.rewardPerEpoch;
// const REWARD_PER_EPOCH = BN.from(10).pow(21).mul(35);

describe("StakeManager 2", function () {
  let signers: Signer[];

  let snapshot: any;

  let pond: Contract;
  let mpond: Contract;

  let pondTokenId: string;
  let mpondTokenId: string;

  let stakeManager: Contract;
  let rewardDelegators: Contract;
  let clusterRewards: Contract;
  let clusterRegistry: Contract;
  let receiverStaking: Contract;
  let epochSelector: Contract;

  //users
  let clusterRewardsAdmin: Signer;
  let stakeManagerGateway: Signer;
  let epochSelectorAdmin: Signer;
  let stakeManagerAdmin: Signer;
  let receiverStakingAdmin: Signer;
  let mpondWhiteListedAddress: Signer;
  let pondHoldingAddress: Signer;
  let rewardDelegatorAdmin: Signer;

  let clusters: Signer[];
  let delegators: Signer[];
  let receivers: Signer[];

  //networks data
  const supportedNetworks = ["ETH", "DOT", "MATIC"];
  const supportedNetworksWeights = [50, 30, 20];
  const supportedNetworkIds = supportedNetworks.map((a) => ethers.utils.id(a));
  const lockWaitTimes = [20, 21, 22];

  // derived data;
  let clusterAddresses: string[];
  let delegatorAddresss: string[];
  let receiverAddresses: string[];
  let epochDuration: number;

  async function skipEpoch() {
    await skipTime(epochDuration);
    await skipTime(1); // extra 1 second for safety
  }

  before(async function () {
    signers = await ethers.getSigners();

    clusterRewardsAdmin = signers[1];
    stakeManagerGateway = signers[2];
    epochSelectorAdmin = signers[3];
    stakeManagerAdmin = signers[4];
    receiverStakingAdmin = signers[5];
    mpondWhiteListedAddress = signers[6];
    pondHoldingAddress = signers[7];
    rewardDelegatorAdmin = signers[8];

    clusters = signers.slice(20, 35); // 15 clusters
    delegators = signers.slice(35, 110); // 75 delegators
    receivers = signers.slice(150, 300); // 150 receivers

    clusterAddresses = await Promise.all(clusters.map((a) => a.getAddress()));
    delegatorAddresss = await Promise.all(delegators.map((a) => a.getAddress()));
    receiverAddresses = await Promise.all(receivers.map((a) => a.getAddress()));

    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    await pond.transfer(await pondHoldingAddress.getAddress(), BN.from(10).pow(18).mul("10000000000"));

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    pondTokenId = ethers.utils.keccak256(pond.address);
    mpondTokenId = ethers.utils.keccak256(mpond.address);

    const StakeManager = await ethers.getContractFactory("StakeManager");
    stakeManager = await upgrades.deployProxy(StakeManager, { kind: "uups", initializer: false });

    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    rewardDelegators = await upgrades.deployProxy(RewardDelegators, {
      constructorArgs: [pondTokenId, mpondTokenId],
      kind: "uups",
      initializer: false,
    });

    const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
    clusterRewards = await upgrades.deployProxy(ClusterRewards, { kind: "uups", initializer: false });

    const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
    clusterRegistry = await upgrades.deployProxy(ClusterRegistry, { kind: "uups", initializer: false });

    await clusterRegistry.initialize(lockWaitTimes);

    let ReceiverStaking = await ethers.getContractFactory("ReceiverStaking");
    receiverStaking = await upgrades.deployProxy(ReceiverStaking, {
      constructorArgs: [blockData.timestamp, 4 * 3600],
      kind: "uups",
      initializer: false,
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(
      await epochSelectorAdmin.getAddress(),
      5,
      blockData.timestamp,
      pond.address,
      BN.from(10).pow(20).toString()
    );
    await receiverStaking.initialize(pond.address, await receiverStakingAdmin.getAddress());

    await clusterRewards.initialize(
      await clusterRewardsAdmin.getAddress(),
      rewardDelegators.address,
      receiverStaking.address,
      epochSelector.address,
      supportedNetworkIds,
      supportedNetworksWeights,
      REWARD_PER_EPOCH
    );

    await rewardDelegators
      .connect(rewardDelegatorAdmin)
      .initialize(
        stakeManager.address,
        clusterRewards.address,
        clusterRegistry.address,
        pond.address,
        [pondTokenId, mpondTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
      );

    await stakeManager
      .connect(stakeManagerAdmin)
      .initialize(
        [pondTokenId, mpondTokenId],
        [pond.address, mpond.address],
        [false, true],
        rewardDelegators.address,
        REDELEGATION_WAIT_TIME,
        UNDELEGATION_WAIT_TIME,
        await stakeManagerGateway.getAddress()
      );

    // derivations
    let UPDATER_ROLE = await epochSelector.UPDATER_ROLE();
    epochDuration = BN.from(await epochSelector.EPOCH_LENGTH()).toNumber();

    //post deployment operations
    await mpond.grantRole(await mpond.WHITELIST_ROLE(), stakeManager.address);
    await mpond.grantRole(await mpond.WHITELIST_ROLE(), await mpondWhiteListedAddress.getAddress());
    await mpond.transfer(await mpondWhiteListedAddress.getAddress(), await mpond.totalSupply());

    await rewardDelegators.connect(rewardDelegatorAdmin).updateEpochSelector(epochSelector.address);
    await epochSelector.connect(epochSelectorAdmin).grantRole(UPDATER_ROLE, rewardDelegators.address);
  });

  beforeEach(async () => {
    snapshot = await network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  afterEach(async () => {
    await network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });

  describe("Check Initialization", async function () {
    it("Stake Manager", async () => {
      const DEFAULT_ADMIN_ROLE = await stakeManager.DEFAULT_ADMIN_ROLE();

      const REDELEGATION_LOCK = ethers.utils.id("REDELEGATION_LOCK");
      const UNDELEGATION_LOCK = ethers.utils.id("UNDELEGATION_LOCK");
      const DELEGATABLE_TOKEN_ROLE = ethers.utils.id("DELEGATABLE_TOKEN_ROLE");

      expect(await stakeManager.hasRole(DEFAULT_ADMIN_ROLE, await stakeManagerAdmin.getAddress())).to.be.true;
      expect(await stakeManager.lockWaitTime(REDELEGATION_LOCK)).to.equal(REDELEGATION_WAIT_TIME);
      expect(await stakeManager.lockWaitTime(UNDELEGATION_LOCK)).to.equal(UNDELEGATION_WAIT_TIME);
      expect(await stakeManager.rewardDelegators()).to.equal(rewardDelegators.address);
      expect(await stakeManager.tokenList(0)).to.eq(pondTokenId);
      expect(await stakeManager.tokenList(1)).to.eq(mpondTokenId);
      expect(await stakeManager.tokens(pondTokenId)).to.eq(pond.address);
      expect(await stakeManager.tokens(mpondTokenId)).to.eq(mpond.address);

      expect(await stakeManager.hasRole(DELEGATABLE_TOKEN_ROLE, pond.address)).to.be.false;
      expect(await stakeManager.hasRole(DELEGATABLE_TOKEN_ROLE, mpond.address)).to.be.true;
    });

    it("Reward Delegators", async () => {
      expect(await rewardDelegators.stakeAddress()).to.be.eq(stakeManager.address);
      expect(await rewardDelegators.clusterRegistry()).to.be.eq(clusterRegistry.address);
      expect(await rewardDelegators.clusterRewards()).to.be.eq(clusterRewards.address);
      expect(await rewardDelegators.PONDToken()).to.be.eq(pond.address);
      expect(await rewardDelegators.tokenList(0)).to.eq(pondTokenId);
      expect(await rewardDelegators.tokenList(1)).to.eq(mpondTokenId);

      expect(await rewardDelegators.rewardFactor(pondTokenId)).to.eq(appConfig.staking.PondRewardFactor);
      expect(await rewardDelegators.rewardFactor(mpondTokenId)).to.eq(appConfig.staking.MPondRewardFactor);
    });

    it("Cluster Rewards", async () => {
      const DEFAULT_ADMIN_ROLE = await clusterRewards.DEFAULT_ADMIN_ROLE();
      const CLAIMER_ROLE = await clusterRewards.CLAIMER_ROLE();

      expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, await clusterRewardsAdmin.getAddress())).to.be.true;
      expect(await clusterRewards.hasRole(CLAIMER_ROLE, rewardDelegators.address)).to.be.true;
      expect(await clusterRewards.epochSelector()).to.be.eq(epochSelector.address);
      expect(await clusterRewards.receiverStaking()).to.be.eq(receiverStaking.address);

      expect(supportedNetworkIds.length).eq(supportedNetworksWeights.length);
      for (let index = 0; index < supportedNetworkIds.length; index++) {
        const networkId = supportedNetworkIds[index];
        const networkWeight = supportedNetworksWeights[index];
        expect(await clusterRewards.rewardWeight(networkId)).to.be.eq(networkWeight);
      }

      expect(await clusterRewards.totalRewardsPerEpoch()).to.be.eq(REWARD_PER_EPOCH);
    });
  });

  describe("Simulation", async () => {
    const minMPondToUse = BN.from(10).pow(18).div(2);
    const maxMPondToUse = BN.from(10).pow(19);

    const minPondToUse = minMPondToUse.mul("1000000");
    const maxPondToUse = maxMPondToUse.mul("10000000");

    const minPondToUseByReceiver = BN.from(10).pow(16);
    const maxPondToUseByReeiver = BN.from(10).pow(20);

    async function populateBalances() {
      await mpond.grantRole(ethers.utils.id("WHITELIST_ROLE"), await mpondWhiteListedAddress.getAddress());

      for (let index = 0; index < clusterAddresses.length; index++) {
        const clusterAddress = clusterAddresses[index];
        await mpond.connect(mpondWhiteListedAddress).transfer(clusterAddress, random(minMPondToUse, maxMPondToUse));
        await pond.connect(pondHoldingAddress).transfer(clusterAddress, random(minPondToUse, maxPondToUse));
      }

      for (let index = 0; index < delegatorAddresss.length; index++) {
        const delegatorAddress = delegatorAddresss[index];
        await mpond.connect(mpondWhiteListedAddress).transfer(delegatorAddress, random(minMPondToUse, maxMPondToUse));
        await pond.connect(pondHoldingAddress).transfer(delegatorAddress, random(minPondToUse, maxPondToUse));
      }

      for (let index = 0; index < receiverAddresses.length; index++) {
        const receiver = receiverAddresses[index];
        await pond.connect(pondHoldingAddress).transfer(receiver, random(minPondToUseByReceiver, maxPondToUseByReeiver));
      }
    }

    beforeEach(async () => {
      await populateBalances();
    });

    it("Ensure Balances", async () => {
      for (let index = 0; index < clusterAddresses.length; index++) {
        const cluster = clusterAddresses[index];
        const mpondBalance = await mpond.balanceOf(cluster);
        expect(mpondBalance).gt(0);
        const pondBalance = await pond.balanceOf(cluster);
        expect(pondBalance).gt(0);
      }

      for (let index = 0; index < delegatorAddresss.length; index++) {
        const delegatorAddress = delegatorAddresss[index];
        const mpondBalance = await mpond.balanceOf(delegatorAddress);
        expect(mpondBalance).gt(0);
        const pondBalance = await pond.balanceOf(delegatorAddress);
        expect(pondBalance).gt(0);
      }
    });

    async function issueTicketsForClusters(
      receiver: Signer,
      networkIds: string[],
      clustersToIssueTicketsTo: string[],
      weights: BN[]
    ): Promise<[BN[], BN[]]> {
      await pond.connect(pondHoldingAddress).transfer(rewardDelegators.address, REWARD_PER_EPOCH);
      await pond.connect(receiver).approve(receiverStaking.address, minPondToUseByReceiver);
      await receiverStaking.connect(receiver).deposit(minPondToUseByReceiver); //n
      await skipEpoch();

      let currentEpoch = (await epochSelector.getCurrentEpoch()).toString(); // n + 1
      let currentPlusOne = BN.from(currentEpoch).add(1).toString(); // n + 2
      await epochSelector.connect(epochSelectorAdmin).selectClusters(); // for n+2

      await skipEpoch();

      for (let index = 0; index < networkIds.length; index++) {
        const networkId = networkIds[index];
        await clusterRewards
          .connect(receiver)
          ["issueTickets(bytes32,uint256,address[],uint256[])"](networkId, currentPlusOne, clustersToIssueTicketsTo, weights);
      }

      const pondRewardsPerShare: BN[] = [];
      const mpondRewardsPerShare: BN[] = [];

      for (let index = 0; index < clustersToIssueTicketsTo.length; index++) {
        const cluster = clustersToIssueTicketsTo[index];
        await rewardDelegators._updateRewards(cluster);
        pondRewardsPerShare.push(await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId));
        mpondRewardsPerShare.push(await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId));
      }

      return [pondRewardsPerShare, mpondRewardsPerShare];
    }

    describe("Only ETH Delegations, All Commissions equal", async () => {
      beforeEach(async () => {
        for (let index = 0; index < clusters.length; index++) {
          const cluster = clusters[index];
          const commision = 0;

          await clusterRegistry
            .connect(cluster)
            .register(supportedNetworkIds[0], commision, clusterAddresses[index], clusterAddresses[index]);
        }
      });

      describe("5 clusters, All Equal Delegations", async function () {
        const totalClusters = 5;
        const delegatorsToUse = 20;

        beforeEach(async () => {
          for (let index = 0; index < delegatorsToUse; index++) {
            const delegator = delegators[index];
            const clusterToDelegate = clusterAddresses[index % totalClusters];

            await pond.connect(delegator).approve(stakeManager.address, minPondToUse.toString());
            await mpond.connect(delegator).approve(stakeManager.address, minMPondToUse.toString());
            await stakeManager
              .connect(delegator)
              .createStashAndDelegate([pondTokenId, mpondTokenId], [minPondToUse.toString(), minMPondToUse.toString()], clusterToDelegate);
          }
        });

        it("Check Delegatios", async () => {
          const clustersToVerify = clusterAddresses.slice(0, 5);
          for (let index = 0; index < clustersToVerify.length; index++) {
            const cluster = clustersToVerify[index];
            const totalPondDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
            const totalMPondDelegation = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
            expect(totalMPondDelegation).gt(0);
            expect(totalPondDelegation).gt(0);
          }
        });

        it("All 5 clusters should be selected", async () => {
          let currentEpoch = (await epochSelector.getCurrentEpoch()).toString();
          let nextEpoch = BN.from(currentEpoch).add(1).toString();

          await epochSelector.connect(epochSelectorAdmin).selectClusters();
          await skipEpoch();

          let clusters = (await epochSelector.getClusters(nextEpoch)) as string[];

          expect(clusters.includes(clusterAddresses[0])).to.be.true;
          expect(clusters.includes(clusterAddresses[1])).to.be.true;
          expect(clusters.includes(clusterAddresses[2])).to.be.true;
          expect(clusters.includes(clusterAddresses[3])).to.be.true;
          expect(clusters.includes(clusterAddresses[4])).to.be.true;

          for (let index = 5; index < clusterAddresses.length; index++) {
            const cluster = clusterAddresses[index];
            expect(clusters.includes(cluster)).to.be.false;
          }
        });

        it("Only 1 receiver, all cluster should get equal reward", async () => {
          const receiver = receivers[0];
          let equiWeightedTickets = BN.from(10).pow(18).div(5);
          const weights = [equiWeightedTickets, equiWeightedTickets, equiWeightedTickets, equiWeightedTickets, equiWeightedTickets];
          const [pondRewards, mpondRewards] = await issueTicketsForClusters(
            receiver,
            [supportedNetworkIds[0]],
            clusterAddresses.slice(0, 5),
            weights
          );

          for (let index = 0; index < pondRewards.length - 1; index++) {
            const element = pondRewards[index];
            expect(element).gt(0);
            expect(element).to.be.eq(pondRewards[index + 1]);
          }

          for (let index = 0; index < mpondRewards.length - 1; index++) {
            const element = mpondRewards[index];
            expect(element).gt(0);
            expect(element).to.be.eq(mpondRewards[index + 1]);
          }
        });

        it.only("Only 1 receiver, tickets ratio 1:2:3:4:5", async () => {
          const receiver = receivers[0];
          let fration = BN.from(10).pow(18).div(15);
          const weights = [fration.mul(1), fration.mul(2), fration.mul(3), fration.mul(4), fration.mul(5)];

          const [pondRewards, mpondRewards] = await issueTicketsForClusters(
            receiver,
            [supportedNetworkIds[0]],
            clusterAddresses.slice(0, 5),
            weights
          );

          console.log(pondRewards.map(a => a.toString()));
          console.log(mpondRewards.map(a => a.toString()));
          
          const scaler = BN.from(10).pow(18);
          for (let index = 0; index < pondRewards.length ; index++) {
            const element = pondRewards[index];
            expect(element).gt(0);
            expect(element.mul(scaler).div(pondRewards[0])).to.be.eq(scaler.mul(index + 1));
          }

          for (let index = 0; index < mpondRewards.length ; index++) {
            const element = mpondRewards[index];
            expect(element).gt(0);
            expect(element.mul(scaler).div(mpondRewards[0])).to.be.eq(scaler.mul(index + 1));
          }
        });
      });
    });
  });
});

function random(min: BN | string, max: BN | string): string {
  const randomizer = ethers.BigNumber.from(ethers.utils.randomBytes(32));
  return randomizer.mod(BN.from(max).sub(min)).add(min).toString();
}

async function skipTime(t: number) {
  await ethers.provider.send("evm_increaseTime", [t]);
  await skipBlocks(1);
}

async function skipBlocks(n: number) {
  await Promise.all([...Array(n)].map(async (x) => await ethers.provider.send("evm_mine", [])));
}
