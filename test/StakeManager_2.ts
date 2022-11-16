import { ethers, upgrades, network } from "hardhat";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";
const appConfig = require("../app-config");

const UNDELEGATION_WAIT_TIME = 604800;
const REDELEGATION_WAIT_TIME = 21600;
// const REWARD_PER_EPOCH = appConfig.staking.rewardPerEpoch;
const REWARD_PER_EPOCH = BN.from(10).pow(21).mul(35);

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
  let invalidReceivers: Signer[];
  let ethClusters: Signer[];
  let dotClusters: Signer[];
  let maticClusters: Signer[];

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

  let ethClusterAddresses: string[];
  let dotClusterAddresses: string[];
  let maticClusterAddresses: string[];

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
    invalidReceivers = signers.slice(300, 310); // 10 invalid receivers

    ethClusters = clusters;
    dotClusters = signers.slice(335, 350);
    maticClusters = signers.slice(320, 335);

    clusterAddresses = await Promise.all(clusters.map((a) => a.getAddress()));
    delegatorAddresss = await Promise.all(delegators.map((a) => a.getAddress()));
    receiverAddresses = await Promise.all(receivers.map((a) => a.getAddress()));

    ethClusterAddresses = clusterAddresses;
    dotClusterAddresses = await Promise.all(dotClusters.map((a) => a.getAddress()));
    maticClusterAddresses = await Promise.all(maticClusters.map((a) => a.getAddress()));

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
      constructorArgs: [blockData.timestamp, 4 * 3600, pond.address],
      kind: "uups",
      initializer: false,
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(await epochSelectorAdmin.getAddress(), 5, blockData.timestamp, pond.address, BN.from(10).pow(20).toString());
    await receiverStaking.initialize(await receiverStakingAdmin.getAddress());

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

      const clusterAddresses: string[] = [...ethClusterAddresses, ...dotClusterAddresses, ...maticClusterAddresses];
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

    async function populateEpochReward() {
      await pond.connect(pondHoldingAddress).transfer(rewardDelegators.address, REWARD_PER_EPOCH);
    }

    async function receiverDeposit(receiver: Signer, amount: BN) {
      await pond.connect(receiver).approve(receiverStaking.address, amount);
      await receiverStaking.connect(receiver).deposit(amount); //n
    }

    async function issueTicketsForClusters(
      receiver: Signer,
      networkIds: string[],
      clustersToIssueTicketsTo: string[],
      weights: BN[],
      currentEpoch: string
    ): Promise<[BN[], BN[], BN[]]> {
      let currentPlusOne = BN.from(currentEpoch).add(1).toString();
      await epochSelector.connect(epochSelectorAdmin).selectClusters(); // these clusters are selected in currentPlusOne epoch

      const clusterCommisionReceived: BN[] = [];
      for (let index = 0; index < clustersToIssueTicketsTo.length; index++) {
        const element = clustersToIssueTicketsTo[index];
        clusterCommisionReceived.push(await pond.balanceOf(element));
      }

      await skipEpoch();
      await skipEpoch();

      for (let index = 0; index < networkIds.length; index++) {
        const networkId = networkIds[index];
        await clusterRewards.connect(receiver)["issueTickets(bytes32,uint256,address[],uint256[])"](networkId, currentPlusOne, clustersToIssueTicketsTo, weights);
      }

      const pondRewardsPerShare: BN[] = [];
      const mpondRewardsPerShare: BN[] = [];

      for (let index = 0; index < clustersToIssueTicketsTo.length; index++) {
        const cluster = clustersToIssueTicketsTo[index];
        await rewardDelegators._updateRewards(cluster);
        pondRewardsPerShare.push(await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId));
        mpondRewardsPerShare.push(await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId));
      }

      for (let index = 0; index < clustersToIssueTicketsTo.length; index++) {
        const element = clustersToIssueTicketsTo[index];
        const clusterNewBalance = await pond.balanceOf(element);
        clusterCommisionReceived[index] = clusterNewBalance.sub(clusterCommisionReceived[index]);
      }

      return [pondRewardsPerShare, mpondRewardsPerShare, clusterCommisionReceived];
    }

    async function withdrawRewards(delegatorsList: string[], clustersToClaimRewardFrom: string[]): Promise<BN[]> {
      const delegatorRewardsRecevied: BN[] = [];

      for (let index = 0; index < delegatorsList.length; index++) {
        const delegatorAddress = delegatorsList[index];
        const balanceBefore = await pond.balanceOf(delegatorAddress);
        await rewardDelegators["withdrawRewards(address,address[])"](delegatorAddress, clustersToClaimRewardFrom);
        const balanceAfter = await pond.balanceOf(delegatorAddress);
        delegatorRewardsRecevied.push(balanceAfter.sub(balanceBefore));
      }

      return delegatorRewardsRecevied;
    }

    describe("All Network, with different commissions", async () => {
      beforeEach(async () => {
        for (let index = 0; index < clusters.length; index++) {
          const ethCluster = ethClusters[index];
          const dotCluster = dotClusters[index];
          const maticCluster = maticClusters[index];

          const commision = index + 1;
          await clusterRegistry.connect(ethCluster).register(supportedNetworkIds[0], commision, ethClusterAddresses[index], ethClusterAddresses[index]);
          await pond.connect(ethCluster).approve(stakeManager.address, minPondToUse.toString());
          await mpond.connect(ethCluster).approve(stakeManager.address, minMPondToUse.toString());
          await stakeManager
            .connect(ethCluster)
            .createStashAndDelegate([pondTokenId, mpondTokenId], [minPondToUse.toString(), minMPondToUse.toString()], ethClusterAddresses[index]);

          await clusterRegistry.connect(dotCluster).register(supportedNetworkIds[1], commision, dotClusterAddresses[index], dotClusterAddresses[index]);
          await pond.connect(dotCluster).approve(stakeManager.address, minPondToUse.toString());
          await mpond.connect(dotCluster).approve(stakeManager.address, minMPondToUse.toString());
          await stakeManager
            .connect(dotCluster)
            .createStashAndDelegate([pondTokenId, mpondTokenId], [minPondToUse.toString(), minMPondToUse.toString()], dotClusterAddresses[index]);

          await clusterRegistry.connect(maticCluster).register(supportedNetworkIds[2], commision, maticClusterAddresses[index], maticClusterAddresses[index]);
          await pond.connect(maticCluster).approve(stakeManager.address, minPondToUse.toString());
          await mpond.connect(maticCluster).approve(stakeManager.address, minMPondToUse.toString());
          await stakeManager
            .connect(maticCluster)
            .createStashAndDelegate([pondTokenId, mpondTokenId], [minPondToUse.toString(), minMPondToUse.toString()], maticClusterAddresses[index]);
        }
        await skipEpoch();
      });

      it("Check Delegatios", async () => {
        const clustersToVerify = [...ethClusterAddresses, ...dotClusterAddresses, ...maticClusterAddresses];
        for (let index = 0; index < clustersToVerify.length; index++) {
          const cluster = clustersToVerify[index];
          const totalPondDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
          const totalMPondDelegation = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
          expect(totalMPondDelegation).gt(0);
          expect(totalPondDelegation).gt(0);
        }
      });
    });

    describe("Only ETH Delegations, All Commissions equal", async () => {
      beforeEach(async () => {
        for (let index = 0; index < clusters.length; index++) {
          const cluster = clusters[index];
          const commision = 15;

          await clusterRegistry.connect(cluster).register(supportedNetworkIds[0], commision, clusterAddresses[index], clusterAddresses[index]);
        }
        await populateEpochReward();
      });

      describe("5 clusters, All Equal Delegations (by delegators)", async function () {
        const totalClusters = 5;
        const delegatorsToUse = 20;

        beforeEach(async () => {
          for (let index = 0; index < delegatorsToUse; index++) {
            const delegator = delegators[index];
            const clusterToDelegate = clusterAddresses[index % totalClusters];

            await pond.connect(delegator).approve(stakeManager.address, minPondToUse.toString());
            await mpond.connect(delegator).approve(stakeManager.address, minMPondToUse.toString());
            await stakeManager.connect(delegator).createStashAndDelegate([pondTokenId, mpondTokenId], [minPondToUse.toString(), minMPondToUse.toString()], clusterToDelegate);
          }
        });

        it("Check Delegatios", async () => {
          const clustersToVerify = clusterAddresses.slice(0, totalClusters);
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

          for (let index = 0; index < totalClusters; index++) {
            expect(clusters.includes(clusterAddresses[index])).to.be.true;
          }

          for (let index = totalClusters; index < clusterAddresses.length; index++) {
            const cluster = clusterAddresses[index];
            expect(clusters.includes(cluster)).to.be.false;
          }
        });

        it("Only 1 receiver, all cluster should get equal reward", async () => {
          const receiver = receivers[0];
          let equiWeightedTickets = BN.from(10).pow(18).div(totalClusters);
          const weights = [equiWeightedTickets, equiWeightedTickets, equiWeightedTickets, equiWeightedTickets, equiWeightedTickets];
          await receiverDeposit(receiver, minPondToUseByReceiver);
          await skipEpoch();
          let currentEpoch = (await epochSelector.getCurrentEpoch()).toString();
          const [pondRewards, mpondRewards] = await issueTicketsForClusters(receiver, [supportedNetworkIds[0]], clusterAddresses.slice(0, totalClusters), weights, currentEpoch);

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

        it("Only 1 receiver, tickets ratio 1:2:3:4:5", async () => {
          const receiver = receivers[0];
          let fration = BN.from(10).pow(18).div(15);
          const weights = [fration.mul(1), fration.mul(2), fration.mul(3), fration.mul(4), fration.mul(5)];
          await receiverDeposit(receiver, minPondToUseByReceiver);
          await skipEpoch();
          let currentEpoch = (await epochSelector.getCurrentEpoch()).toString();

          const [pondRewards, mpondRewards] = await issueTicketsForClusters(receiver, [supportedNetworkIds[0]], clusterAddresses.slice(0, totalClusters), weights, currentEpoch);

          // console.log(pondRewards.map((a) => a.toString()));
          // console.log(mpondRewards.map((a) => a.toString()));

          const scaler = BN.from(10).pow(18);
          for (let index = 0; index < pondRewards.length; index++) {
            const element = pondRewards[index];
            expect(element).gt(0);
            expect(element.mul(scaler).div(pondRewards[0])).to.be.eq(scaler.mul(index + 1));
          }

          for (let index = 0; index < mpondRewards.length; index++) {
            const element = mpondRewards[index];
            expect(element).gt(0);
            expect(element.mul(scaler).div(mpondRewards[0])).to.be.eq(scaler.mul(index + 1));
          }
        });

        it("Only 1 receiver, tickets ratio 0:0:0:0:1", async () => {
          const receiver = receivers[0];
          let fration = BN.from(10).pow(18);
          const zero = BN.from(0);
          const weights = [zero, zero, zero, zero, fration];
          await receiverDeposit(receiver, minPondToUseByReceiver);
          await skipEpoch();
          let currentEpoch = (await epochSelector.getCurrentEpoch()).toString();
          const [pondRewards, mpondRewards] = await issueTicketsForClusters(receiver, [supportedNetworkIds[0]], clusterAddresses.slice(0, totalClusters), weights, currentEpoch);

          // console.log(pondRewards.map((a) => a.toString()));
          // console.log(mpondRewards.map((a) => a.toString()));

          for (let index = 0; index < pondRewards.length - 1; index++) {
            const element = pondRewards[index];
            expect(element).eq(0);
          }
          expect(pondRewards[pondRewards.length - 1]).gt(0);

          for (let index = 0; index < mpondRewards.length - 1; index++) {
            const element = mpondRewards[index];
            expect(element).eq(0);
          }
          expect(mpondRewards[mpondRewards.length - 1]).gt(0);
        });

        describe("Failure Cases", async () => {
          it("Submit tickets to unselected cluster", async () => {
            const receiver = receivers[0];
            const fraction = BN.from(10).pow(18);
            await receiverDeposit(receiver, minPondToUseByReceiver);
            await skipEpoch();
            let currentEpoch = (await epochSelector.getCurrentEpoch()).toString();
            await expect(issueTicketsForClusters(receiver, [supportedNetworkIds[0]], [clusterAddresses[5]], [fraction], currentEpoch)).to.be.revertedWith(
              "Invalid cluster to issue ticket"
            );
          });

          it("Invalid Receiver can't submit tickets", async () => {
            const receiver = invalidReceivers[0];
            const fraction = BN.from(10).pow(18);
            await skipEpoch();
            await skipEpoch();
            await skipEpoch();

            let currentEpoch = (await epochSelector.getCurrentEpoch()).toNumber();

            await expect(
              clusterRewards.connect(receiver)["issueTickets(bytes32,uint256,address[],uint256[])"](supportedNetworkIds[0], currentEpoch, [clusterAddresses[0]], [fraction])
            ).to.be.revertedWith("CRW:IT-Not eligible to issue tickets");
          });
        });

        it("1 receiver, ticket ratio 1:1:1:1:1, all delegator get equal rewards, totalReward < rewardPerEpoch", async () => {
          const receiver = receivers[0];
          let equiWeightedTickets = BN.from(10).pow(18).div(totalClusters);
          const weights = [equiWeightedTickets, equiWeightedTickets, equiWeightedTickets, equiWeightedTickets, equiWeightedTickets];
          await receiverDeposit(receiver, minPondToUseByReceiver);
          await skipEpoch();
          let currentEpoch = (await epochSelector.getCurrentEpoch()).toString();
          const [, , clusterCommisionReceived] = await issueTicketsForClusters(receiver, [supportedNetworkIds[0]], clusterAddresses.slice(0, totalClusters), weights, currentEpoch);

          const delegatorRewardsRecevied = await withdrawRewards(delegatorAddresss.slice(0, delegatorsToUse), clusterAddresses.slice(0, totalClusters));
          // console.log(delegatorRewardsRecevied.map(a => a.toString()));
          expect(delegatorRewardsRecevied.every((a) => a.gt(0))).to.be.true;
          expect(delegatorRewardsRecevied.every((a) => a.eq(delegatorRewardsRecevied[0]))).to.be.true;

          const totalPondDistributed = [...delegatorRewardsRecevied, ...clusterCommisionReceived].reduce((prev, val) => prev.add(val), BN.from(0));
          const totalExpectedRewardToBeDistributed = REWARD_PER_EPOCH.mul(supportedNetworksWeights[0]).div(100);

          expect(totalPondDistributed).lt(totalExpectedRewardToBeDistributed);
          expect(totalExpectedRewardToBeDistributed).is.closeTo(totalPondDistributed, 10);
        });

        it("2 Receiver Stake 1:2, Tickets: 1:1 to their respective cluster, delegator reward should be 1:2", async () => {
          const [receiver1, receiver2] = getRandomElementsFromArray(receivers, 2);
          const [clusterAddress1, clusterAddress2] = getRandomElementsFromArray(clusterAddresses, 5);

          await receiverDeposit(receiver1, minPondToUseByReceiver.div(2));
          await receiverDeposit(receiver2, minPondToUseByReceiver);
          const fraction = BN.from(10).pow(18);
          await skipEpoch();
          let currentEpoch = (await epochSelector.getCurrentEpoch()).toString();

          const [, , clusterCommisionReceived1] = await issueTicketsForClusters(receiver1, [supportedNetworkIds[0]], [clusterAddress1], [fraction], currentEpoch);
          const [, , clusterCommisionReceived2] = await issueTicketsForClusters(receiver2, [supportedNetworkIds[0]], [clusterAddress2], [fraction], currentEpoch);

          const delegatorRewardsRecevied = await withdrawRewards(delegatorAddresss.slice(0, delegatorsToUse), [clusterAddress1, clusterAddress2]);

          const totalPondDistributed = [...delegatorRewardsRecevied, ...[...clusterCommisionReceived1, ...clusterCommisionReceived2]].reduce(
            (prev, val) => prev.add(val),
            BN.from(0)
          );
          const totalExpectedRewardToBeDistributed = REWARD_PER_EPOCH.mul(supportedNetworksWeights[0]).div(100);

          expect(totalPondDistributed).lt(totalExpectedRewardToBeDistributed);
          expect(totalExpectedRewardToBeDistributed).is.closeTo(totalPondDistributed, 10);
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

function getRandomElementsFromArray<T>(array: T[], noOfElements: number): T[] {
  if (array.length < noOfElements) {
    throw Error("Insuff Elements in array");
  }

  return array.sort(() => 0.5 - Math.random()).slice(0, noOfElements);
}
