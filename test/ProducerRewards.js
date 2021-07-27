const truffleAssert = require("truffle-assertions");

const PONDToken = artifacts.require("TokenLogic.sol");
const PONDProxy = artifacts.require("TokenProxy.sol");

const ProducerRewards = artifacts.require("ProducerRewards.sol");
const ProducerRewardsProxy = artifacts.require("ProducerRewardsProxy.sol");

const appConfig = require("../app-config");
const utils = require("./utils");

let producerRewards;

contract.only("ProducerRewards contract", async function (accounts) {
    let producerRewardsOwner = accounts[1];
    let feeder = accounts[2];
    const bridge = accounts[3];
    const proxyAdmin = accounts[4];
    const producer1 = accounts[5];
    const producer2 = accounts[6];
    const producer3 = accounts[7];
    const producer4 = accounts[8];

    const MAX_WEIGHT = 100;
    let producerRewardsProxyInstance;

    it("Initialize contract", async () => {
        const PONDDeployment = await PONDToken.new();
        const pondProxyInstance = await PONDProxy.new(PONDDeployment.address, proxyAdmin);
        PONDInstance = await PONDToken.at(pondProxyInstance.address);
        
        await PONDInstance.initialize(
            appConfig.PONDData.name,
            appConfig.PONDData.symbol,
            appConfig.PONDData.decimals,
            bridge
        );

        const producerRewardsDeployment = await ProducerRewards.new();
        producerRewardsProxyInstance = await ProducerRewardsProxy.new(
            producerRewardsDeployment.address,
            proxyAdmin
        );
        producerRewards = await ProducerRewards.at(producerRewardsProxyInstance.address);

        await producerRewards.initialize(
            1,
            appConfig.staking.rewardPerEpoch,
            PONDInstance.address,
            producerRewardsOwner,
            feeder,
            MAX_WEIGHT
        );
        
        await PONDInstance.mint(accounts[0], new web3.utils.BN("100000000000000000000"));

        // reverts if initialized again
        await truffleAssert.reverts(producerRewards.initialize(
            1,
            appConfig.staking.rewardPerEpoch,
            PONDInstance.address,
            producerRewardsOwner,
            feeder,
            MAX_WEIGHT
        ));
    });

    it("Access control: distributeRewards", async () => {
        let producerAddresses = [producer1, producer2, producer3, producer4];
        let weights = [25, 25, 25, 25];
        let epoch = 1;

        await truffleAssert.reverts(producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch
        ),"Sender not feeder");
    });

    it("Access control: emergencyWithdraw", async () => {
        let alice = accounts[9];
        await truffleAssert.reverts(producerRewards.emergencyWithdraw(
            PONDInstance.address,
            1,
            alice,
            {from: alice}
        ),"Ownable: caller is not the owner");

        await PONDInstance.transfer(producerRewards.address, 1);
        await producerRewards.emergencyWithdraw(
            PONDInstance.address,
            1,
            alice,
            {from: producerRewardsOwner}
        );
    });

    it("Access control: updatePONDAddress", async () => {
        let alice = accounts[9];
        await truffleAssert.reverts(producerRewards.updatePONDAddress(
            PONDInstance.address,
            {from: alice}
        ),"Ownable: caller is not the owner");
    });

    it("Access control: updatemaxTotalWeight", async () => {
        let alice = accounts[9];
        await truffleAssert.reverts(producerRewards.updatemaxTotalWeight(
            MAX_WEIGHT,
            {from: alice}
        ),"Ownable: caller is not the owner");
    });

    it("Access control: updatetotalRewardPerEpoch", async () => {
        let alice = accounts[9];
        await truffleAssert.reverts(producerRewards.updatetotalRewardPerEpoch(
            appConfig.staking.rewardPerEpoch,
            {from: alice}
        ),"Ownable: caller is not the owner");
    });

    it("Access control: updateFeeder", async () => {
        let alice = accounts[9];
        await truffleAssert.reverts(producerRewards.updateFeeder(
            alice,
            {from: alice}
        ),"Ownable: caller is not the owner");
    });

    it("Distribute Rewards: Equal weights (epoch 1)", async () => {
        let producerAddresses = [producer1, producer2, producer3, producer4];
        let weights = [25, 25, 25, 25];
        let epoch = 1;
        let producerBalBefore = [];

        for (let i=0; i< producerAddresses.length; i++) {
            producerBalBefore.push(await PONDInstance.balanceOf(producerAddresses[i]));
        }

        let expectedReward = appConfig.staking.rewardPerEpoch/4;
        await PONDInstance.transfer(
            producerRewards.address,
            2*appConfig.staking.rewardPerEpoch
        );
        await producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch,
            {from: feeder}
        );

        // claim rewards from all producers
        for (let i=0; i< producerAddresses.length; i++) {
            const totalReward = await producerRewards.accruedRewards(producerAddresses[i]);
            await producerRewards.claimReward(totalReward, 
                {from: producerAddresses[i]});
        }
        
        for (let i=0; i< producerAddresses.length; i++) {
            let producerBalAfter = await PONDInstance.balanceOf(producerAddresses[i]);
            let rewardReceived = producerBalAfter.sub(producerBalBefore[i]);
            assert.equal(rewardReceived.toString(), expectedReward);
        }
    });

    it("Distribute Rewards: 1:2 weights (epoch 2)", async () => {
        let producerAddresses = [producer1, producer2];
        let weights = [25, 50];
        let epoch = 2;
        let producerBalBefore = [];

        for (let i=0; i< producerAddresses.length; i++) {
            producerBalBefore.push(await PONDInstance.balanceOf(producerAddresses[i]));
        }
        let expectedReward = [];
        expectedReward.push(Math.floor(appConfig.staking.rewardPerEpoch/3));
        expectedReward.push(Math.floor(2*appConfig.staking.rewardPerEpoch/3));

        // change maxTotalWeight to 75
        await producerRewards.updatemaxTotalWeight(75, {from: producerRewardsOwner});

        await truffleAssert.reverts(producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch,
            {from: feeder}
        ), "PR:DRW-Cant distribute reward for new epoch within such short interval");
        
        // advance blocks
        await utils.advanceTime(web3, 24*60*60);

        await producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch,
            {from: feeder}
        );
        
        // claim rewards from all producers
        for (let i=0; i< producerAddresses.length; i++) {
            const totalReward = await producerRewards.accruedRewards(producerAddresses[i]);
            await producerRewards.claimReward(totalReward, 
                {from: producerAddresses[i]});
        }

        for (let i=0; i< producerAddresses.length; i++) {
            let producerBalAfter = await PONDInstance.balanceOf(producerAddresses[i]);
            let rewardReceived = producerBalAfter.sub(producerBalBefore[i]);
            assert.equal(rewardReceived.toString(), expectedReward[i]);
        }
    });

    it("Distribute Rewards: revert if rewards for epoch 1 > totalRewardPerEpoch", async () => {
        let producerAddresses = [producer1, producer2, producer3, producer4];
        let weights = [25, 25, 25, 25];
        let epoch = 1;

        // const rewardsDistributed = await producerRewards.rewardDistributedPerEpoch(epoch);
        // const TotalRewardsPerEpoch = await producerRewards.totalRewardPerEpoch();
        // console.log("rewardsDistributed: ", rewardsDistributed, "TotalRewardsPerEpoch: ", TotalRewardsPerEpoch);
        await PONDInstance.transfer(
            producerRewards.address,
            2*appConfig.staking.rewardPerEpoch
        );
        await truffleAssert.reverts(producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch,
            {from: feeder}
        ), "PR:DRW-Reward Distributed  cant  be more  than totalRewardPerEpoch");
    });

    it("Distribute Rewards: revert if weight is more than max weight", async () => {
        let producerAddresses = [producer1, producer2];
        let weights = [35, 50];
        let epoch = 3;

        // advance blocks
        await utils.advanceTime(web3, 24*60*60);

        await truffleAssert.reverts(producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch,
            {from: feeder}
        ), "PR:DRW-Reward Distributed  cant  be more  than totalRewardPerEpoch");
    });

    it("Claim Reward: revert if claim amount more than accured", async () => {
        let producerAddresses = [producer1, producer2];
        let weights = [25, 50];
        let epoch = 3;

        await producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch,
            {from: feeder}
        );
        let producer1AccReward = await producerRewards.accruedRewards(producer1);
        // console.log("producer1AccReward: ", producer1AccReward.toString());
        await truffleAssert.reverts(producerRewards.claimReward(producer1AccReward.toString()+1), 
        "PR:CR-Can't withdraw more than accured");
    });

    it("Can't add rewards to future blocks", async () => {
        let producerAddresses = [producer1, producer2];
        let weights = [25, 50];
        let epoch = 15;

        await truffleAssert.reverts(producerRewards.distributeRewards(
            producerAddresses,
            weights,
            epoch,
            {from: feeder}
        ), "PR:DRW-Cant distribute reward for new epoch within such short interval");
    });

    it("upgrade contract and check storage", async () => {
        const preUpgradeStorage = await producerRewards.rewardDistributedPerEpoch(1);
        const producerRewardsNewDeployment = await ProducerRewards.new();
        await producerRewardsProxyInstance.updateLogic(
            producerRewardsNewDeployment.address,
            {from: proxyAdmin}
        );
        const postUpgradeStorage = await producerRewards.rewardDistributedPerEpoch(1);
        assert.equal(
            preUpgradeStorage.toString(),
            postUpgradeStorage.toString()
        );
    });
});
