import { expect, util } from "chai";
import { deployMockContract, MockContract } from "ethereum-waffle";
import { BigNumber as BN, Contract, Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import {
  ClusterRegistry,
  ClusterRewards,
  ClusterSelector,
  MPond,
  Pond,
  ReceiverStaking,
  RewardDelegators,
  StakeManager,
} from "../../typechain-types";
import { FuzzedNumber } from "../../utils/fuzzer";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import {
  getClusterRegistry,
  getClusterRewards,
  getClusterSelector,
  getMpond,
  getPond,
  getReceiverStaking,
  getRewardDelegators,
  getStakeManager,
} from "../../utils/typechainConvertor";
import { impersonate, setBalance, skipBlocks, skipTime } from "../helpers/common";
import { testERC165 } from "../helpers/erc165";
import { testAdminRole, testRole } from "../helpers/rbac";
const stakingConfig = require("../config/staking.json");

const START_DELAY = 100000;
const startTime = Math.floor(Date.now()/1000) + START_DELAY;

const e14 = ethers.utils.parseEther("0.0001");
const e16 = ethers.utils.parseEther("0.01");
const e18 = ethers.utils.parseEther("1");
const e20 = ethers.utils.parseEther("100");
const e22 = ethers.utils.parseEther("10000");
const e30 = ethers.utils.parseEther("1000000000000");

describe("RewardDelegators init and upgrades", function () {
    let signers: Signer[];
    let addrs: string[];
  
    before(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map((a) => a.getAddress()));
    });
  
    takeSnapshotBeforeAndAfterEveryTest(async () => {});
  
    it("deploys with initialization disabled", async () => {
        const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
        let rewardDelegators = await RewardDelegators.deploy();
    
        await expect(
            rewardDelegators.initialize(
                addrs[10],
                addrs[9],
                addrs[8],
                addrs[7],
                [ethers.utils.id(addrs[7]), ethers.utils.id(addrs[6])],
                [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
                [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
                [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
            )
        ).to.be.reverted;
    });
  
    it("deploys as proxy and initializes", async function () {
        const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
        const rewardDelegatorsUntyped: Contract = await upgrades.deployProxy(RewardDelegators, {
            kind: "uups",
            initializer: false,
        });
        const rewardDelegators: RewardDelegators = getRewardDelegators(rewardDelegatorsUntyped.address, signers[0]);

        const fakeStakeManagerAddr = addrs[10];
        const fakeClusterRewardsAddr = addrs[9];
        const fakeClusterRegistryAddr = addrs[8];
        const fakePond = addrs[7];
        const fakeMPond = addrs[6];
        const pondTokenId = ethers.utils.id(fakePond);
        const mpondTokenId = ethers.utils.id(fakeMPond);
        const initializationTx = expect(rewardDelegators.initialize(
            fakeStakeManagerAddr,
            fakeClusterRewardsAddr,
            fakeClusterRegistryAddr,
            fakePond,
            [pondTokenId, mpondTokenId],
            [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
            [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
            [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
        ))
        await initializationTx.to.emit(rewardDelegators, "AddReward").withArgs(pondTokenId, stakingConfig.PondRewardFactor);
        await initializationTx.to.emit(rewardDelegators, "AddReward").withArgs(mpondTokenId, stakingConfig.MPondRewardFactor);
        await initializationTx.to.emit(rewardDelegators, "TokenWeightsUpdated").withArgs(pondTokenId, stakingConfig.PondWeightForThreshold, stakingConfig.PondWeightForDelegation);
        await initializationTx.to.emit(rewardDelegators, "TokenWeightsUpdated").withArgs(mpondTokenId, stakingConfig.MPondWeightForThreshold, stakingConfig.MPondWeightForDelegation);

        expect(await rewardDelegators.stakeAddress()).to.equal(fakeStakeManagerAddr);
        expect(await rewardDelegators.clusterRegistry()).to.equal(fakeClusterRegistryAddr);
        expect(await rewardDelegators.clusterRewards()).to.equal(fakeClusterRewardsAddr);
        expect(await rewardDelegators.PONDToken()).to.equal(fakePond);
        expect(await rewardDelegators.rewardFactor(pondTokenId)).to.equal(stakingConfig.PondRewardFactor);
        expect(await rewardDelegators.rewardFactor(mpondTokenId)).to.equal(stakingConfig.MPondRewardFactor);
        const [pondWeightForDelegation, pondWeightForThreshold] = await rewardDelegators.tokenWeights(pondTokenId);
        expect([pondWeightForDelegation.toNumber(), pondWeightForThreshold.toNumber()]).to.eql([parseInt(stakingConfig.PondWeightForThreshold), parseInt(stakingConfig.PondWeightForDelegation)]);
        const [mpondWeightForDelegation, mpondWeightForThreshold] = await rewardDelegators.tokenWeights(mpondTokenId);
        expect([mpondWeightForDelegation.toNumber(), mpondWeightForThreshold.toNumber()]).to.eql([parseInt(stakingConfig.MPondWeightForThreshold), parseInt(stakingConfig.MPondWeightForDelegation)]);
        expect([
            (await rewardDelegators.tokenIndex(pondTokenId)).toNumber(), 
            (await rewardDelegators.tokenIndex(mpondTokenId)).toNumber()]
        ).to.eql([0, 1]);
        expect([await rewardDelegators.tokenList(0), await rewardDelegators.tokenList(1)]).to.eql([pondTokenId, mpondTokenId]);
        expect(await rewardDelegators.hasRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });
  
    it("upgrades", async function () {
        const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
        const rewardDelegatorsUntyped: Contract = await upgrades.deployProxy(RewardDelegators, {
            kind: "uups",
            initializer: false,
        });
        const rewardDelegators: RewardDelegators = getRewardDelegators(rewardDelegatorsUntyped.address, signers[0]);
        
        const fakeStakeManagerAddr = addrs[10];
        const fakeClusterRewardsAddr = addrs[9];
        const fakeClusterRegistryAddr = addrs[8];
        const fakePond = addrs[7];
        const fakeMPond = addrs[6];
        const pondTokenId = ethers.utils.id(fakePond);
        const mpondTokenId = ethers.utils.id(fakeMPond);
        const initializationTx = expect(rewardDelegators.initialize(
            fakeStakeManagerAddr,
            fakeClusterRewardsAddr,
            fakeClusterRegistryAddr,
            fakePond,
            [pondTokenId, mpondTokenId],
            [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
            [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
            [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
        ))
        await initializationTx.to.emit(rewardDelegators, "AddReward").withArgs(pondTokenId, stakingConfig.PondRewardFactor);
        await initializationTx.to.emit(rewardDelegators, "AddReward").withArgs(mpondTokenId, stakingConfig.MPondRewardFactor);
        await initializationTx.to.emit(rewardDelegators, "TokenWeightsUpdated").withArgs(pondTokenId, stakingConfig.PondWeightForThreshold, stakingConfig.PondWeightForDelegation);
        await initializationTx.to.emit(rewardDelegators, "TokenWeightsUpdated").withArgs(mpondTokenId, stakingConfig.MPondWeightForThreshold, stakingConfig.MPondWeightForDelegation);

        const originalImplemetationAddress = await upgrades.erc1967.getImplementationAddress(rewardDelegators.address);
        await upgrades.upgradeProxy(rewardDelegators, RewardDelegators, { kind: "uups" });
        expect(originalImplemetationAddress).to.not.equal(await upgrades.erc1967.getImplementationAddress(rewardDelegators.address));
        
        expect(await rewardDelegators.stakeAddress()).to.equal(fakeStakeManagerAddr);
        expect(await rewardDelegators.clusterRegistry()).to.equal(fakeClusterRegistryAddr);
        expect(await rewardDelegators.clusterRewards()).to.equal(fakeClusterRewardsAddr);
        expect(await rewardDelegators.PONDToken()).to.equal(fakePond);
        expect(await rewardDelegators.rewardFactor(pondTokenId)).to.equal(stakingConfig.PondRewardFactor);
        expect(await rewardDelegators.rewardFactor(mpondTokenId)).to.equal(stakingConfig.MPondRewardFactor);
        const [pondWeightForDelegation, pondWeightForThreshold] = await rewardDelegators.tokenWeights(pondTokenId);
        expect([pondWeightForDelegation.toNumber(), pondWeightForThreshold.toNumber()]).to.eql([stakingConfig.PondWeightForThreshold.toNumber(), stakingConfig.PondWeightForDelegation.toNumber()]);
        const [mpondWeightForDelegation, mpondWeightForThreshold] = await rewardDelegators.tokenWeights(mpondTokenId);
        expect([mpondWeightForDelegation.toNumber(), mpondWeightForThreshold.toNumber()]).to.eql([stakingConfig.MPondWeightForThreshold.toNumber(), stakingConfig.MPondWeightForDelegation.toNumber()]);
        expect([
            (await rewardDelegators.tokenIndex(pondTokenId)).toNumber(), 
            (await rewardDelegators.tokenIndex(mpondTokenId)).toNumber()]
        ).to.eql([0, 1]);
        expect([await rewardDelegators.tokenList(0), await rewardDelegators.tokenList(1)]).to.eql([pondTokenId, mpondTokenId]);
        expect(await rewardDelegators.hasRole(await rewardDelegators.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });
  
    it("does not upgrade without admin", async () => {
        const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
        const rewardDelegatorsUntyped: Contract = await upgrades.deployProxy(RewardDelegators, {
            kind: "uups",
            initializer: false,
        });
        const rewardDelegators: RewardDelegators = getRewardDelegators(rewardDelegatorsUntyped.address, signers[0]);
        
        const fakeStakeManagerAddr = addrs[10];
        const fakeClusterRewardsAddr = addrs[9];
        const fakeClusterRegistryAddr = addrs[8];
        const fakePond = addrs[7];
        const fakeMPond = addrs[6];
        const pondTokenId = ethers.utils.id(fakePond);
        const mpondTokenId = ethers.utils.id(fakeMPond);
        const initializationTx = expect(rewardDelegators.initialize(
            fakeStakeManagerAddr,
            fakeClusterRewardsAddr,
            fakeClusterRegistryAddr,
            fakePond,
            [pondTokenId, mpondTokenId],
            [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
            [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
            [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
        ))
        await initializationTx.to.emit(rewardDelegators, "AddReward").withArgs(pondTokenId, stakingConfig.PondRewardFactor);
        await initializationTx.to.emit(rewardDelegators, "AddReward").withArgs(mpondTokenId, stakingConfig.MPondRewardFactor);
        await initializationTx.to.emit(rewardDelegators, "TokenWeightsUpdated").withArgs(pondTokenId, stakingConfig.PondWeightForThreshold, stakingConfig.PondWeightForDelegation);
        await initializationTx.to.emit(rewardDelegators, "TokenWeightsUpdated").withArgs(mpondTokenId, stakingConfig.MPondWeightForThreshold, stakingConfig.MPondWeightForDelegation);

        await upgrades.upgradeProxy(rewardDelegators.address, RewardDelegators, { kind: "uups" });
  
        await expect(upgrades.upgradeProxy(rewardDelegators.address, RewardDelegators.connect(signers[1]) ,{ kind: "uups" })).to.be.reverted;
    });
});

testERC165("ReceiverStaking ERC165", async function (signers: Signer[], addrs: string[]) {
        const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
        const rewardDelegatorsUntyped: Contract = await upgrades.deployProxy(RewardDelegators, {
            kind: "uups",
            initializer: false,
        });
        const rewardDelegators: RewardDelegators = getRewardDelegators(rewardDelegatorsUntyped.address, signers[0]);

        const fakeStakeManagerAddr = addrs[10];
        const fakeClusterRewardsAddr = addrs[9];
        const fakeClusterRegistryAddr = addrs[8];
        const fakePond = addrs[7];
        const fakeMPond = addrs[6];
        const pondTokenId = ethers.utils.id(fakePond);
        const mpondTokenId = ethers.utils.id(fakeMPond);
        await rewardDelegators.initialize(
            fakeStakeManagerAddr,
            fakeClusterRewardsAddr,
            fakeClusterRegistryAddr,
            fakePond,
            [pondTokenId, mpondTokenId],
            [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
            [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
            [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
        );
        return rewardDelegators;
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
    }
);
  
testAdminRole("ReceiverStaking Admin role", async function (signers: Signer[], addrs: string[]) {
    const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
    const rewardDelegatorsUntyped: Contract = await upgrades.deployProxy(RewardDelegators, {
        kind: "uups",
        initializer: false,
    });
    const rewardDelegators: RewardDelegators = getRewardDelegators(rewardDelegatorsUntyped.address, signers[0]);

    const fakeStakeManagerAddr = addrs[10];
    const fakeClusterRewardsAddr = addrs[9];
    const fakeClusterRegistryAddr = addrs[8];
    const fakePond = addrs[7];
    const fakeMPond = addrs[6];
    const pondTokenId = ethers.utils.id(fakePond);
    const mpondTokenId = ethers.utils.id(fakeMPond);
    await rewardDelegators.initialize(
        fakeStakeManagerAddr,
        fakeClusterRewardsAddr,
        fakeClusterRegistryAddr,
        fakePond,
        [pondTokenId, mpondTokenId],
        [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
        [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
        [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
    );
    return rewardDelegators;
});

describe("RewardDelegators global var updates", function () {
    let signers: Signer[];
    let addrs: string[];

    let rewardDelegators: RewardDelegators;
    let pondTokenId: string;
    let mpondTokenId: string;
  
    before(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map((a) => a.getAddress()));
        const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
        const rewardDelegatorsUntyped: Contract = await upgrades.deployProxy(RewardDelegators, {
            kind: "uups",
            initializer: false,
        });
        rewardDelegators = getRewardDelegators(rewardDelegatorsUntyped.address, signers[0]);

        const fakeStakeManagerAddr = addrs[10];
        const fakeClusterRewardsAddr = addrs[9];
        const fakeClusterRegistryAddr = addrs[8];
        const fakePond = addrs[7];
        const fakeMPond = addrs[6];
        pondTokenId = ethers.utils.id(fakePond);
        mpondTokenId = ethers.utils.id(fakeMPond);
        await rewardDelegators.initialize(
            fakeStakeManagerAddr,
            fakeClusterRewardsAddr,
            fakeClusterRegistryAddr,
            fakePond,
            [pondTokenId, mpondTokenId],
            [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
            [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
            [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
        );
        return rewardDelegators;
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
        await expect(await rewardDelegators.updateStakeAddress(stakeManagerInstance2.address)).to.emit(
            rewardDelegators, 
            "StakeAddressUpdated"
        );
    });

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
        await expect(rewardDelegators.connect(signers[1]).updateRewardFactor("" + pondTokenId, stakingConfig.PondRewardFactor + 1))
            .to.be.reverted;
    });

    it("cannot update non existing tokenId", async () => {
        let testTokenId = await ethers.utils.keccak256(addrs[0]);
        await expect(rewardDelegators.updateRewardFactor(testTokenId, 1)).to.be.reverted;
    });

    it("cannot update rewardFactor to 0", async () => {
        await expect(rewardDelegators.updateRewardFactor("" + pondTokenId, 0)).to.be.reverted;
    });

    it("owner can update rewardFactor", async () => {
        await expect(await rewardDelegators.updateRewardFactor("" + pondTokenId, stakingConfig.PondRewardFactor + 1))
        .to.emit(
            rewardDelegators,
            "RewardsUpdated"
        );
    });
});

describe("RewardDelegators ", function () {
    let signers: Signer[];
    let addrs: string[];

    let registeredClusters: Signer[];
    let registeredClusterRewardAddresses: string[];
    let clientKeys: string[];
    let delegators: Signer[];

    let rewardDelegators: RewardDelegators;
    let fakeStakeManager: MockContract;
    let imperonatedStakeManager: Signer;
    let fakeClusterRewards: MockContract;
    let fakeClusterRegistry: MockContract;

    let pond: Pond;
    let pondTokenId: string;
    let mpondTokenId: string;

    let fakeClusterSelectors: Record<string, MockContract> = {};
  
    before(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map((a) => a.getAddress()));

        registeredClusters = signers.slice(20, 30);
        registeredClusterRewardAddresses = addrs.slice(30, 40);
        clientKeys = addrs.slice(40, 50);
        delegators = signers.slice(50, 60);

        const RewardDelegators = await ethers.getContractFactory("RewardDelegators");
        const rewardDelegatorsUntyped: Contract = await upgrades.deployProxy(RewardDelegators, {
            kind: "uups",
            initializer: false,
        });
        rewardDelegators = getRewardDelegators(rewardDelegatorsUntyped.address, signers[0]);

        const StakeManager = await ethers.getContractFactory("StakeManager");
        // setting address while deploying mock is not yet implemented in ethereum-waffle yet
        fakeStakeManager = await deployMockContract(signers[9], StakeManager.interface.format());
        imperonatedStakeManager = await impersonate(ethers, fakeStakeManager.address);
        // mocking receive function is not implemented in ethereum-waffle yet
        await setBalance(ethers, fakeStakeManager.address, e18);
        const ClusterRewards = await ethers.getContractFactory("ClusterRewards");
        fakeClusterRewards = await deployMockContract(signers[8], ClusterRewards.interface.format());
        const ClusterRegistry = await ethers.getContractFactory("ClusterRegistry");
        fakeClusterRegistry = await deployMockContract(signers[7], ClusterRegistry.interface.format());
        const Pond = await ethers.getContractFactory("Pond");
        const pondUntyped = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
        pond = getPond(pondUntyped.address, signers[0]);
        const fakeMPond = addrs[6];
        pondTokenId = ethers.utils.id(pond.address);
        mpondTokenId = ethers.utils.id(fakeMPond);
        await rewardDelegators.initialize(
            fakeStakeManager.address,
            fakeClusterRewards.address,
            fakeClusterRegistry.address,
            pond.address,
            [pondTokenId, mpondTokenId],
            [stakingConfig.PondRewardFactor, stakingConfig.MPondRewardFactor],
            [stakingConfig.PondWeightForThreshold, stakingConfig.MPondWeightForThreshold],
            [stakingConfig.PondWeightForDelegation, stakingConfig.MPondWeightForDelegation]
        );

        await pond.transfer(rewardDelegators.address, ethers.utils.parseEther("100000"));
        
        const clusterSelector = await ethers.getContractFactory("ClusterSelector");
        fakeClusterSelectors["ETH"] = await deployMockContract(signers[5], clusterSelector.interface.format());
        await fakeClusterRewards.mock.clusterSelectors.withArgs(ethers.utils.id("ETH")).returns(fakeClusterSelectors["ETH"].address);
        fakeClusterSelectors["DOT"] = await deployMockContract(signers[4], clusterSelector.interface.format());
        await fakeClusterRewards.mock.clusterSelectors.withArgs(ethers.utils.id("DOT")).returns(fakeClusterSelectors["DOT"].address);
    });

    takeSnapshotBeforeAndAfterEveryTest(async () => {});

    // NOTE: Reward factor doesn't do anything rn

    it("delegate to cluster single token", async () => {
        const delegator = await delegators[0].getAddress();
        const delegator1 = await delegators[1].getAddress();
        const cluster = await registeredClusters[FuzzedNumber.randomInRange(0, registeredClusters.length).toNumber()].getAddress();
        const rewardAddress = registeredClusterRewardAddresses[FuzzedNumber.randomInRange(0, registeredClusterRewardAddresses.length).toNumber()];
        const networkId = ethers.utils.id("ETH");

        let rewardAmount = FuzzedNumber.randomInRange(100000, 500000);
        let commission = FuzzedNumber.randomInRange(0, 100);
        await fakeClusterRewards.mock.claimReward.withArgs(cluster).returns(rewardAmount);
        await fakeClusterRegistry.mock.getRewardInfo.withArgs(cluster).returns(commission, rewardAddress);
        await fakeClusterRegistry.mock.getNetwork.withArgs(cluster).returns(networkId);
        // TODO: only upsert with `cluster` as arg are accepted
        await fakeClusterSelectors["ETH"].mock.upsert.returns();

        // ----------------- Give reward when previous total delegation and user has no prev rewards ---------------
        const amount1 = FuzzedNumber.randomInRange(e16, e18);
        await expect(rewardDelegators.delegate(delegator, cluster, [pondTokenId], [amount1]))
            .to.be.revertedWith("RD:OS-only stake contract can invoke");

        let clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        let delegationInit = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        let rewardPerShare =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(delegator, cluster, [pondTokenId], [amount1]))
            .to.changeTokenBalances(
                pond, 
                [rewardDelegators, rewardAddress, delegator], 
                [-(commission.mul(rewardAmount).div(100)), commission.mul(rewardAmount).div(100), 0]
            );
        let clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        let delegation = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        let rewardPerShare1 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount1));
        expect(delegation).to.equal(delegationInit.add(amount1));
        // as there is only pond token all reward  is given to pond token
        expect(rewardPerShare1.sub(rewardPerShare)).to.equal(0);

        // ----------------- Give reward when previous total delegation is non 0 and user has no prev rewards ---------------
        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        let clusterCommission = commission.mul(rewardAmount).div(100);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(delegator1, cluster, [pondTokenId], [amount1]))
            .to.changeTokenBalances(
                pond, 
                [rewardDelegators, rewardAddress, delegator1], 
                [-clusterCommission, clusterCommission, 0]
            );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        const rewardPerShare2 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount1));
        expect(delegation).to.equal(delegationInit.add(amount1));
        // as there is only pond token all reward  is given to pond token
        expect(rewardPerShare2.sub(rewardPerShare1)).to.equal(rewardAmount.sub(clusterCommission).mul(e30).div(clusterDelegationInit));

        // ----------------- Gives reward when previous delegation is non 0 and user has prev rewards, no new rewards for cluster ---------------
        await fakeClusterRewards.mock.claimReward.withArgs(cluster).returns(0);

        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        let delegatorCurrentReward = rewardPerShare2.sub(rewardPerShare).mul(delegationInit).div(e30);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(delegator, cluster, [pondTokenId], [amount1]))
            .to.changeTokenBalances(
                pond, 
                [rewardDelegators, rewardAddress, delegator], 
                [-delegatorCurrentReward, 0, delegatorCurrentReward]
            );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        const rewardPerShare3 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount1));
        expect(delegation).to.equal(delegationInit.add(amount1));
        expect(rewardPerShare3).to.equal(rewardPerShare2);

        // ----------------- Give new rewards to cluster ---------------
        const rewardAmount1 = rewardAmount.mul(2).div(3);
        await fakeClusterRewards.mock.claimReward.withArgs(cluster).returns(rewardAmount1);
        clusterCommission = rewardAmount1.mul(commission).div(100);
        await expect(rewardDelegators._updateRewards(cluster)).to.changeTokenBalances(
            pond,
            [rewardDelegators, rewardAddress, delegator, delegator1],
            [-clusterCommission, clusterCommission, 0, 0]
        );
        const rewardPerShare4 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);

        expect(rewardPerShare4.sub(rewardPerShare3)).to.equal(rewardAmount1.sub(clusterCommission).mul(e30).div(clusterDelegation));

        // ----------------- Gives reward when previous delegation is non 0 and user has prev rewards, new rewards for cluster ---------------
        const amount2 = FuzzedNumber.randomInRange(100000, 500000);

        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        let delegator1CurrentReward = rewardPerShare4.sub(rewardPerShare2).mul(delegationInit).div(e30);
        clusterCommission = rewardAmount1.mul(commission).div(100);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(delegator1, cluster, [pondTokenId], [amount2]))
            .to.changeTokenBalances(
                pond,
                [rewardDelegators, rewardAddress, delegator1], 
                [-(delegator1CurrentReward.add(clusterCommission)), clusterCommission, delegator1CurrentReward]
            );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        const rewardPerShare5 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount2));
        expect(delegation).to.equal(delegationInit.add(amount2));
        expect(rewardPerShare5.sub(rewardPerShare4)).to.equal(rewardAmount1.sub(clusterCommission).mul(e30).div(clusterDelegationInit));

        // ----------------- Gives reward when previous delegation is non 0 and user has prev rewards, new rewards for cluster,0 commission ---------------
        await fakeClusterRegistry.mock.getRewardInfo.withArgs(cluster).returns(0, rewardAddress);

        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        delegatorCurrentReward = rewardPerShare5.sub(rewardPerShare3).mul(delegationInit).div(e30);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(delegator, cluster, [pondTokenId], [amount2]))
            .to.changeTokenBalances(
                pond, 
                [rewardDelegators, rewardAddress, delegator], 
                [-(delegatorCurrentReward), 0, delegatorCurrentReward]
            );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        const rewardPerShare6 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount2));
        expect(delegation).to.equal(delegationInit.add(amount2));
        expect(rewardPerShare6.sub(rewardPerShare5)).to.equal(rewardAmount1.mul(e30).div(clusterDelegationInit));
    });

    it("delegate to cluster multiple tokens", async () => {
        const delegator = await delegators[0].getAddress();
        const delegator1 = await delegators[1].getAddress();
        const cluster = await registeredClusters[FuzzedNumber.randomInRange(0, registeredClusters.length).toNumber()].getAddress();
        const rewardAddress = registeredClusterRewardAddresses[FuzzedNumber.randomInRange(0, registeredClusterRewardAddresses.length).toNumber()];
        const networkId = ethers.utils.id("ETH");

        let rewardAmount = FuzzedNumber.randomInRange(100000, 500000);
        let commission = FuzzedNumber.randomInRange(0, 100);
        await fakeClusterRewards.mock.claimReward.withArgs(cluster).returns(rewardAmount);
        await fakeClusterRegistry.mock.getRewardInfo.withArgs(cluster).returns(commission, rewardAddress);
        await fakeClusterRegistry.mock.getNetwork.withArgs(cluster).returns(networkId);
        // TODO: only upsert with `cluster` as arg are accepted
        await fakeClusterSelectors["ETH"].mock.upsert.returns();

        // ----------------- Give reward when previous total delegation and user has no prev rewards ---------------
        const amount1 = FuzzedNumber.randomInRange(e16, e18);
        const mpondAmount1 = FuzzedNumber.randomInRange(e16, e18);
        await expect(rewardDelegators.delegate(delegator, cluster, [pondTokenId, mpondTokenId], [amount1, mpondAmount1]))
            .to.be.revertedWith("RD:OS-only stake contract can invoke");

        let clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        let mpondClusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        let delegationInit = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        let mpondDelegationInit = await rewardDelegators.getDelegation(cluster, delegator, mpondTokenId);
        let rewardPerShare =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        let mpondRewardPerShare =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(
            delegator, 
            cluster, 
            [pondTokenId, mpondTokenId], 
            [amount1, mpondAmount1])
        ).to.changeTokenBalances(
            pond, 
            [rewardDelegators, rewardAddress, delegator], 
            [-(commission.mul(rewardAmount).div(100)), commission.mul(rewardAmount).div(100), 0]
        );
        let clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        let mpondClusterDelegation = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        let delegation = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        let mpondDelegation = await rewardDelegators.getDelegation(cluster, delegator, mpondTokenId);
        let rewardPerShare1 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        let mpondRewardPerShare1 =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount1));
        expect(mpondClusterDelegation).to.equal(mpondClusterDelegationInit.add(mpondAmount1));
        expect(delegation).to.equal(delegationInit.add(amount1));
        expect(mpondDelegation).to.equal(mpondDelegationInit.add(mpondAmount1));
        expect(rewardPerShare1.sub(rewardPerShare)).to.equal(0);
        expect(mpondRewardPerShare1.sub(mpondRewardPerShare)).to.equal(0);

        // ----------------- Give reward when previous total delegation is non 0 and user has no prev rewards ---------------
        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        mpondDelegationInit = await rewardDelegators.getDelegation(cluster, delegator1, mpondTokenId);
        rewardPerShare =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        mpondRewardPerShare =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);
        let clusterCommission = commission.mul(rewardAmount).div(100);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(
            delegator1, 
            cluster, 
            [pondTokenId, mpondTokenId], 
            [amount1, mpondAmount1])
        ).to.changeTokenBalances(
            pond, 
            [rewardDelegators, rewardAddress, delegator1], 
            [-clusterCommission, clusterCommission, 0]
        );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegation = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        mpondDelegation = await rewardDelegators.getDelegation(cluster, delegator1, mpondTokenId);
        const rewardPerShare2 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        const mpondRewardPerShare2 =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount1));
        expect(mpondClusterDelegation).to.equal(mpondClusterDelegationInit.add(mpondAmount1));
        expect(delegation).to.equal(delegationInit.add(amount1));
        expect(mpondDelegation).to.equal(mpondDelegationInit.add(mpondAmount1));
        expect(rewardPerShare2.sub(rewardPerShare1)).to.equal(rewardAmount.sub(clusterCommission).mul(e30).div(2).div(clusterDelegationInit));
        expect(mpondRewardPerShare2.sub(mpondRewardPerShare1)).to.equal(rewardAmount.sub(clusterCommission).mul(e30).div(2).div(mpondClusterDelegationInit));

        // ----------------- Gives reward when previous delegation is non 0 and user has prev rewards, no new rewards for cluster ---------------
        await fakeClusterRewards.mock.claimReward.withArgs(cluster).returns(0);

        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        mpondDelegationInit = await rewardDelegators.getDelegation(cluster, delegator, mpondTokenId);
        let delegatorCurrentReward = rewardPerShare2.sub(rewardPerShare).mul(delegationInit).div(e30);
        let delegatorCurrentRewardMpond = mpondRewardPerShare2.sub(mpondRewardPerShare).mul(mpondDelegationInit).div(e30);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(
            delegator, 
            cluster, 
            [pondTokenId, mpondTokenId], 
            [amount1, mpondAmount1])
        ).to.changeTokenBalances(
            pond, 
            [rewardDelegators, rewardAddress, delegator], 
            [-delegatorCurrentReward.add(delegatorCurrentRewardMpond), 0, delegatorCurrentReward.add(delegatorCurrentRewardMpond)]
        );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegation = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        mpondDelegation = await rewardDelegators.getDelegation(cluster, delegator, mpondTokenId);
        const rewardPerShare3 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        const mpondRewardPerShare3 =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount1));
        expect(mpondClusterDelegation).to.equal(mpondClusterDelegationInit.add(mpondAmount1));
        expect(delegation).to.equal(delegationInit.add(amount1));
        expect(mpondDelegation).to.equal(mpondDelegationInit.add(mpondAmount1));
        expect(rewardPerShare3.sub(rewardPerShare2)).to.equal(0);
        expect(mpondRewardPerShare3.sub(mpondRewardPerShare2)).to.equal(0);

        // ----------------- Give new rewards to cluster ---------------
        const rewardAmount1 = rewardAmount.mul(2).div(3);
        await fakeClusterRewards.mock.claimReward.withArgs(cluster).returns(rewardAmount1);
        clusterCommission = rewardAmount1.mul(commission).div(100);
        await expect(rewardDelegators._updateRewards(cluster)).to.changeTokenBalances(
            pond,
            [rewardDelegators, rewardAddress, delegator, delegator1],
            [-clusterCommission, clusterCommission, 0, 0]
        );
        const rewardPerShare4 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        const mpondRewardPerShare4 =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);

        expect(rewardPerShare4.sub(rewardPerShare3)).to.equal(rewardAmount1.sub(clusterCommission).mul(e30).div(2).div(clusterDelegation));
        expect(mpondRewardPerShare4.sub(mpondRewardPerShare3)).to.equal(rewardAmount1.sub(clusterCommission).mul(e30).div(2).div(mpondClusterDelegation));

        // ----------------- Gives reward when previous delegation is non 0 and user has prev rewards, new rewards for cluster ---------------
        const amount2 = FuzzedNumber.randomInRange(100000, 500000);
        const mpondAmount2 = FuzzedNumber.randomInRange(100, 500);

        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        mpondDelegationInit = await rewardDelegators.getDelegation(cluster, delegator1, mpondTokenId);
        let delegator1CurrentReward = rewardPerShare4.sub(rewardPerShare2).mul(delegationInit).div(e30);
        let delegator1CurrentRewardMpond = mpondRewardPerShare4.sub(mpondRewardPerShare2).mul(mpondDelegationInit).div(e30);
        clusterCommission = rewardAmount1.mul(commission).div(100);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(
            delegator1, 
            cluster, 
            [pondTokenId, mpondTokenId], 
            [amount2, mpondAmount2])
        ).to.changeTokenBalances(
            pond, 
            [rewardDelegators, rewardAddress, delegator1], 
            [-delegator1CurrentReward.add(delegator1CurrentRewardMpond).add(clusterCommission), clusterCommission, delegator1CurrentReward.add(delegator1CurrentRewardMpond)]
        );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegation = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator1, pondTokenId);
        mpondDelegation = await rewardDelegators.getDelegation(cluster, delegator1, mpondTokenId);
        const rewardPerShare5 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        const mpondRewardPerShare5 =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount2));
        expect(mpondClusterDelegation).to.equal(mpondClusterDelegationInit.add(mpondAmount2));
        expect(delegation).to.equal(delegationInit.add(amount2));
        expect(mpondDelegation).to.equal(mpondDelegationInit.add(mpondAmount2));
        expect(rewardPerShare5.sub(rewardPerShare4)).to.equal(rewardAmount1.sub(clusterCommission).mul(e30).div(2).div(clusterDelegationInit));
        expect(mpondRewardPerShare5.sub(mpondRewardPerShare4)).to.equal(rewardAmount1.sub(clusterCommission).mul(e30).div(2).div(mpondClusterDelegation));

        // ----------------- Gives reward when previous delegation is non 0 and user has prev rewards, new rewards for cluster,0 commission ---------------
        await fakeClusterRegistry.mock.getRewardInfo.withArgs(cluster).returns(0, rewardAddress);

        clusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegationInit = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegationInit = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        mpondDelegationInit = await rewardDelegators.getDelegation(cluster, delegator, mpondTokenId);
        delegatorCurrentReward = rewardPerShare5.sub(rewardPerShare3).mul(delegationInit).div(e30);
        delegatorCurrentRewardMpond = mpondRewardPerShare5.sub(mpondRewardPerShare3).mul(mpondDelegationInit).div(e30);
        await expect(rewardDelegators.connect(imperonatedStakeManager).delegate(
            delegator, 
            cluster, 
            [pondTokenId, mpondTokenId], 
            [amount2, mpondAmount2])
        ).to.changeTokenBalances(
            pond, 
            [rewardDelegators, rewardAddress, delegator], 
            [-delegatorCurrentReward.add(delegatorCurrentRewardMpond), 0, delegatorCurrentReward.add(delegatorCurrentRewardMpond)]
        );
        clusterDelegation = await rewardDelegators.getClusterDelegation(cluster, pondTokenId);
        mpondClusterDelegation = await rewardDelegators.getClusterDelegation(cluster, mpondTokenId);
        delegation = await rewardDelegators.getDelegation(cluster, delegator, pondTokenId);
        mpondDelegation = await rewardDelegators.getDelegation(cluster, delegator, mpondTokenId);
        const rewardPerShare6 =  await rewardDelegators.getAccRewardPerShare(cluster, pondTokenId);
        const mpondRewardPerShare6 =  await rewardDelegators.getAccRewardPerShare(cluster, mpondTokenId);

        expect(clusterDelegation).to.equal(clusterDelegationInit.add(amount2));
        expect(mpondClusterDelegation).to.equal(mpondClusterDelegationInit.add(mpondAmount2));
        expect(delegation).to.equal(delegationInit.add(amount2));
        expect(mpondDelegation).to.equal(mpondDelegationInit.add(mpondAmount2));
        expect(rewardPerShare6.sub(rewardPerShare5)).to.equal(rewardAmount1.mul(e30).div(2).div(clusterDelegationInit));
        expect(mpondRewardPerShare6.sub(mpondRewardPerShare5)).to.equal(rewardAmount1.mul(e30).div(2).div(mpondClusterDelegation));
    });
});