const truffleAssert = require("truffle-assertions");

const PONDToken = artifacts.require("TokenLogic.sol");
const PONDProxy = artifacts.require("TokenProxy.sol");

const MPONDToken = artifacts.require("MPondLogic.sol");
const MPONDProxy = artifacts.require("MPondProxy.sol");

const Stake = artifacts.require("StakeManager.sol");
const StakeProxy = artifacts.require("StakeManagerProxy.sol");

const RewardDelegators = artifacts.require("RewardDelegators.sol");
const RewardDelegatorsProxy = artifacts.require("RewardDelegatorsProxy.sol");

const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");

const ClusterRewards = artifacts.require("ClusterRewards.sol");
const ClusterRewardsProxy = artifacts.require("ClusterRewardsProxy.sol");

const appConfig = require("../app-config");
const utils = require("./utils");

let PONDInstance, MPONDInstance, stakeContract, clusterRegistry, rewardDelegators, clusterRewards;
let PONDTokenId, MPONDTokenId;
const commissionLockWaitTime = 20, swtichNetworkLockTime = 21, unregisterLockWaitTime = 22;

contract.only("ClusterRewards contract", async function (accounts) {
    const proxyAdmin = accounts[1];
    const MPONDAccount = accounts[2];
    const bridge = accounts[3];
    const dropBridgeAddress = accounts[4];
    const admin = accounts[5];
    const stakeManagerOwner = accounts[6];
    const clusterRegistryOwner = accounts[7];
    const rewardDelegatorsOwner = accounts[8];
    const clusterRewardsOwner = accounts[9];
    const feeder = accounts[10];

    const registeredCluster = accounts[11];
    const registeredClusterRewardAddress = accounts[12];
    const registeredClusterClientKey = accounts[19];
    const registeredCluster1 = accounts[15];
    const registeredClusterRewardAddress1 = accounts[16];
    const clientKey1 = accounts[13];
    const clientKey2 = accounts[17];
    const delegator = accounts[14];

    it("Initialize contract", async () => {
        const PONDDeployment = await PONDToken.new();
        const pondProxyInstance = await PONDProxy.new(PONDDeployment.address, proxyAdmin);
        PONDInstance = await PONDToken.at(pondProxyInstance.address);

        const MPONDDeployment = await MPONDToken.new();
        const MpondProxyInstance = await MPONDProxy.new(MPONDDeployment.address, proxyAdmin);
        MPONDInstance = await MPONDToken.at(MpondProxyInstance.address);

        await PONDInstance.initialize(
            appConfig.PONDData.name,
            appConfig.PONDData.symbol,
            appConfig.PONDData.decimals,
            bridge
        );
        await MPONDInstance.initialize(
            MPONDAccount,
            bridge,
            dropBridgeAddress,
            {
                from: admin
            }
        );

        const stakeDeployment = await Stake.new();
        const stakeProxyInstance = await StakeProxy.new(stakeDeployment.address, proxyAdmin);
        stakeContract = await Stake.at(stakeProxyInstance.address);

        const clusterRegistryDeployment = await ClusterRegistry.new();
        const clusterRegistryProxy = await ClusterRegistryProxy.new(clusterRegistryDeployment.address, proxyAdmin);
        clusterRegistry = await ClusterRegistry.at(clusterRegistryProxy.address);

        const rewardDelegatorsDeployment = await RewardDelegators.new();
        const rewardDelegatorsProxy = await RewardDelegatorsProxy.new(rewardDelegatorsDeployment.address, proxyAdmin);
        rewardDelegators = await RewardDelegators.at(rewardDelegatorsProxy.address);

        const clusterRewardsDeployment = await ClusterRewards.new();
        const clusterRewardsProxyInstance = await ClusterRewardsProxy.new(clusterRewardsDeployment.address, proxyAdmin);
        clusterRewards = await ClusterRewards.at(clusterRewardsProxyInstance.address);

        PONDTokenId = web3.utils.keccak256(PONDInstance.address);
        MPONDTokenId = web3.utils.keccak256(MPONDInstance.address);

        await stakeContract.initialize(
            [PONDTokenId, MPONDTokenId],
            [PONDInstance.address, MPONDInstance.address],
            MPONDInstance.address,
            clusterRegistry.address,
            rewardDelegators.address,
            stakeManagerOwner,
            appConfig.staking.undelegationWaitTime
        );

        const selectors = [web3.utils.keccak256("COMMISSION_LOCK"),
        web3.utils.keccak256("SWITCH_NETWORK_LOCK"), web3.utils.keccak256("UNREGISTER_LOCK")];
        const lockWaitTimes = [commissionLockWaitTime, swtichNetworkLockTime, unregisterLockWaitTime];

        await clusterRegistry.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

        await rewardDelegators.initialize(
            stakeContract.address,
            clusterRewards.address,
            clusterRegistry.address,
            rewardDelegatorsOwner,
            appConfig.staking.minMPONDStake,
            web3.utils.keccak256("MPOND"),
            PONDInstance.address,
            [PONDTokenId, MPONDTokenId],
            [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
        )

        await clusterRewards.initialize(
            clusterRewardsOwner, // oracleOwner,
            rewardDelegators.address,
            [
                "0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533",
                "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701",
                "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"
            ],
            [100, 100, 100],
            appConfig.staking.rewardPerEpoch,
            PONDInstance.address,
            appConfig.staking.payoutDenomination,
            feeder,
            1
        );

        await MPONDInstance.addWhiteListAddress(stakeContract.address, {
            from: admin
        });
        assert((await MPONDInstance.isWhiteListed(stakeContract.address)), "StakeManager contract not whitelisted");

        await PONDInstance.mint(accounts[0], new web3.utils.BN("100000000000000000000"));

        await PONDInstance.transfer(rewardDelegators.address, appConfig.staking.rewardPerEpoch * 100);

        // initialize contract and check if all variables are correctly set
        assert((await clusterRewards.feeder()) == feeder, "feeder not initalized correctly");
        assert((await clusterRewards.totalRewardsPerEpoch()) == appConfig.staking.rewardPerEpoch, "rewardPerEpoch not initalized correctly");
        // assert((await clusterRewards.rewardDelegatorsAddress()) == rewardDelegators.address, "rewardDelegatorsAddress not initalized correctly");
        // assert((await clusterRewards.payoutDenomination()) == appConfig.staking.payoutDenomination, "payoutDenomination not initalized correctly");

        // reverts if initialized again
        await truffleAssert.reverts(clusterRewards.initialize(
            clusterRewardsOwner, // oracleOwner,
            rewardDelegators.address,
            [
                "0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533",
                "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701",
                "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"
            ],
            [100, 100, 100],
            appConfig.staking.rewardPerEpoch,
            PONDInstance.address,
            appConfig.staking.payoutDenomination,
            feeder,
            1
        ));
    });

    it("Add network", async () => {
        const networkId = web3.utils.keccak256("ETH");
        const rewardWeight = 10;

        assert.equal(Number(await clusterRewards.rewardWeight(networkId)), 0);

        await truffleAssert.reverts(
            clusterRewards.addNetwork(networkId, rewardWeight),
            "Ownable: caller is not the owner"
        );

        await clusterRewards.addNetwork(networkId, rewardWeight, { from: clusterRewardsOwner });

        assert.equal(Number(await clusterRewards.rewardWeight(networkId)), rewardWeight);
    });

    it("Remove network", async () => {
        const networkId = web3.utils.keccak256("NEAR1");
        const rewardWeight = 5;

        await clusterRewards.addNetwork(networkId, rewardWeight, { from: clusterRewardsOwner });
        assert.equal(Number(await clusterRewards.rewardWeight(networkId)), rewardWeight);

        await truffleAssert.reverts(
            clusterRewards.removeNetwork(networkId),
            "Ownable: caller is not the owner"
        );

        await clusterRewards.removeNetwork(networkId, { from: clusterRewardsOwner });
        assert.equal(Number(await clusterRewards.rewardWeight(networkId)), 0);
    });

    it("change network reward", async () => {
        const networkId = web3.utils.keccak256("DOT1");
        const rewardWeight = 5;
        const updateRewardWeight = 10;

        await clusterRewards.addNetwork(networkId, rewardWeight, { from: clusterRewardsOwner });
        assert.equal(Number(await clusterRewards.rewardWeight(networkId)), rewardWeight);

        await truffleAssert.reverts(
            clusterRewards.changeNetworkReward(networkId, updateRewardWeight),
            "Ownable: caller is not the owner"
        );

        await clusterRewards.changeNetworkReward(networkId, updateRewardWeight, { from: clusterRewardsOwner });
        assert.equal(Number(await clusterRewards.rewardWeight(networkId)), updateRewardWeight);
    });

    it("feed cluster reward", async () => {
        let commission = 10;
        let networkId = web3.utils.keccak256("BSC");

        await clusterRegistry.register(networkId, commission, registeredClusterRewardAddress, clientKey1, {
            from: registeredCluster
        });

        assert.equal(Number(await clusterRewards.clusterRewards(registeredCluster)), 0);

        await delegate(delegator, [registeredCluster], [1], [2000000]);
        await feedData([registeredCluster], 0);

        assert.equal(Number(await clusterRewards.clusterRewards(registeredCluster)), 3125);
    });

    it("should revert when cluster rewards are more than total rewards distributed per epoch", async () => {
        await utils.advanceTime(web3, 24*60*60);
        // change the reward per epoch then feed
        await clusterRewards.changeRewardPerEpoch(1, {from: clusterRewardsOwner});
        await delegate(delegator, [registeredCluster], [1], [2000000]);

        // cluster reward more than total reward per epoch
        await truffleAssert.reverts(feedData([registeredCluster], 0),
        "CRW:F-Reward Distributed  cant  be more  than totalRewardPerEpoch");

        // change the epoch reward to 10000
        await clusterRewards.changeRewardPerEpoch(appConfig.staking.rewardPerEpoch,
            {from: clusterRewardsOwner});
        await utils.advanceTime(web3, 24*60*60);
    });

    it("feed rewards for epoch 1 & 2 simultaneously", async () => {
        await utils.advanceTime(web3, 24*60*60);
        await feedData([registeredCluster], 1);
        await truffleAssert.reverts(feedData([registeredCluster], 2),
        "CRW:F-Cant distribute reward for new epoch within such short interva");
    });

    it("add new network then feed then remove network then feed again", async () => {
        await utils.advanceTime(web3, 24*60*60);
        const networkId = web3.utils.keccak256("testnet");
        const rewardWeight = 10;
        let commission = 10;

        await clusterRewards.addNetwork(networkId, rewardWeight, { from: clusterRewardsOwner });
        await clusterRegistry.register(networkId,
            commission, registeredClusterRewardAddress1, clientKey2, {
            from: registeredCluster1
        });

        assert.equal(Number(await clusterRewards.clusterRewards(registeredCluster1)), 0);

        await delegate(delegator, [registeredCluster1], [1], [2000000]);
        await feedData([registeredCluster1], 3);
        assert.equal(Number(await clusterRewards.clusterRewards(registeredCluster1)), 3030);
        await clusterRewards.removeNetwork(networkId, { from: clusterRewardsOwner });
        await utils.advanceTime(web3, 24*60*60);
        // transfer some rewards to rewardDelegators
        await PONDInstance.transfer(rewardDelegators.address, 1000000);

        // feed again the cluster reward increases 
        await delegate(delegator, [registeredCluster1], [1], [2000000]);
        await feedData([registeredCluster1], 4);
        assert.equal(Number(await clusterRewards.clusterRewards(registeredCluster1)), 3126  );
    });

    it("add new network then feed then update reward to 0 then feed again", async () => {
        const networkId = web3.utils.keccak256("testnet");
        const updateRewardWeight = 0;

        await truffleAssert.reverts(
            clusterRewards.changeNetworkReward(
                networkId, 
                updateRewardWeight,
                { from: clusterRewardsOwner }
            ),
            "CRW:CNR-Network doesnt exist"
        );
    });

    it("delegate then claim reward", async () => {
        await clusterRewards.clusterRewards(registeredCluster1);
        assert.equal(Number(await clusterRewards.clusterRewards(registeredCluster1)), 3126);
        const oldBalance = await PONDInstance.balanceOf(registeredClusterRewardAddress1);
        assert.equal(oldBalance.toString(), 302);

        await delegate(delegator, [registeredCluster1], [1], [2000000]);
        await clusterRewards.updateRewardDelegatorAddress(accounts[0],
            {from: clusterRewardsOwner});

        const PondBalBefore = await PONDInstance.balanceOf(clusterRewards.address);
    
        await clusterRewards.claimReward(registeredCluster1);
        const newBalance = await PONDInstance.balanceOf(registeredClusterRewardAddress1);
        assert.equal(newBalance.toString(), 614);

        // check the balance of clusterRewards
        const PondBalAfter = await PONDInstance.balanceOf(clusterRewards.address);
        assert.equal(PondBalBefore.toString(), PondBalAfter.toString(),
        "The rewards are transferred from the clusterRewards contract");
    });

    async function getTokensAndApprove(user, tokens, spender) {
        if (tokens.pond > 0) {
            await PONDInstance.transfer(user, tokens.pond);
            await PONDInstance.approve(spender, tokens.pond, {
                from: user
            });
        }
        if (tokens.mpond > 0) {
            await MPONDInstance.transfer(user, tokens.mpond, {
                from: MPONDAccount
            });
            await MPONDInstance.approve(spender, tokens.mpond, {
                from: user
            });
        }
    }

    async function delegate(delegator, clusters, mpondAmounts, pondAmounts) {
        let totalPond = 0;
        let totalMPond = 0;
        for (let i = 0; i < pondAmounts.length; i++) {
            totalPond += pondAmounts[i];
            totalMPond += mpondAmounts[i];
        }
        await getTokensAndApprove(delegator, { pond: totalPond, mpond: totalMPond }, stakeContract.address);

        const stashes = [];
        for (let i = 0; i < clusters.length; i++) {
            const tokens = [];
            const amounts = [];
            if (mpondAmounts[i] > 0) {
                tokens.push(MPONDTokenId);
                amounts.push(mpondAmounts[i]);
            }
            if (pondAmounts[i] > 0) {
                tokens.push(PONDTokenId);
                amounts.push(pondAmounts[i]);
            }
            const receipt = await stakeContract.createStashAndDelegate(tokens, amounts, clusters[i], {
                from: delegator
            });
            stashes.push(receipt.logs[0].args.stashId);
        }
        return stashes;
    }

    async function feedData(clusters, epoch) {
        const stakes = [];
        let totalStake = new web3.utils.BN(0);
        let pondPerMpond = new web3.utils.BN(1000000);
        let payoutDenomination = new web3.utils.BN(appConfig.staking.payoutDenomination);
        for (let i = 0; i < clusters.length; i++) {
            const mpondClusterStake = await rewardDelegators.getClusterDelegation(clusters[i], MPONDTokenId);
            const pondClusterStake = await rewardDelegators.getClusterDelegation(clusters[i], PONDTokenId);
            const clusterStake = mpondClusterStake.mul(pondPerMpond).add(pondClusterStake);
            stakes.push(clusterStake);
            totalStake = totalStake.add(clusterStake);
        }
        const payouts = [];
        for (let i = 0; i < clusters.length; i++) {
            const stake = stakes[i];
            payouts.push(stake.mul(payoutDenomination).div(totalStake).toString())
        }
        await clusterRewards.feed(web3.utils.keccak256("DOT"), clusters, payouts, epoch, {
            from: feeder
        });
    }
});
