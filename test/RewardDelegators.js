const { keccak256 } = require("ethers/utils");
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

const TestERC20 = artifacts.require("TestERC20.sol");

let testTokenInstance
let PONDInstance, MPONDInstance, stakeContract, clusterRegistry, rewardDelegators, clusterRewards;
let PONDTokenId, MPONDTokenId;
const commissionLockWaitTime = 20, swtichNetworkLockTime = 21, unregisterLockWaitTime = 22;

contract.only("RewardDelegators contract", async function (accounts) {

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
    const registeredCluster1 = accounts[13];
    const registeredCluster1RewardAddress = accounts[14];
    const registeredCluster2 = accounts[15];
    const registeredCluster2RewardAddress = accounts[16];
    const registeredCluster3 = accounts[17];
    const registeredCluster3RewardAddress = accounts[18];
    const registeredCluster4 = accounts[25];
    const registeredCluster4RewardAddress = accounts[26];
    const unregisteredCluster = accounts[19];
    const clientKey1 = accounts[20];
    const clientKey2 = accounts[30];
    const clientKey3 = accounts[27];
    const clientKey4 = accounts[28];
    const clientKey5 = accounts[29];
    const delegator = accounts[21];
    const delegator1 = accounts[22];
    const delegator2 = accounts[23];
    const delegator3 = accounts[24];
    const delegator4 = accounts[25];

    it("Initialize contract", async () => {

        // deploy pond and mpond tokens
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

        const selectors = [web3.utils.keccak256("COMMISSION_LOCK"), web3.utils.keccak256("SWITCH_NETWORK_LOCK"), web3.utils.keccak256("UNREGISTER_LOCK")];
        const lockWaitTimes = [commissionLockWaitTime, swtichNetworkLockTime, unregisterLockWaitTime];

        await clusterRegistry.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

        await rewardDelegators.initialize(
            stakeContract.address,
            clusterRewards.address, // oracle
            clusterRegistry.address,
            rewardDelegatorsOwner,
            appConfig.staking.minMPONDStake,
            MPONDTokenId,
            PONDInstance.address,
            [PONDTokenId, MPONDTokenId],
            [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
        )

        await clusterRewards.initialize(
            clusterRewardsOwner, // oracleOwner,
            rewardDelegators.address,
            ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533","0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701","0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
            [100, 100, 100],
            appConfig.staking.rewardPerEpoch,
            PONDInstance.address,
            appConfig.staking.payoutDenomination,
            feeder,
            10
        );

        await MPONDInstance.addWhiteListAddress(stakeContract.address, {
            from: admin
        });
        assert((await MPONDInstance.isWhiteListed(stakeContract.address)), "StakeManager contract not whitelisted");

        await PONDInstance.mint(accounts[0], new web3.utils.BN("100000000000000000000"));

        await PONDInstance.transfer(clusterRewards.address, appConfig.staking.rewardPerEpoch * 100);
        // initialize contract and check if all variables are correctly set(including admin)
        assert((await stakeContract.undelegationWaitTime()) == appConfig.staking.undelegationWaitTime, "Undelegation wait time not initalized correctly");
        assert((await rewardDelegators.minMPONDStake()) == appConfig.staking.minMPONDStake, "minMPONDStake not initalized correctly");
        // reverts if initialized again
        await truffleAssert.reverts(rewardDelegators.initialize(
            stakeContract.address,
            clusterRewards.address,
            clusterRegistry.address,
            rewardDelegatorsOwner,
            appConfig.staking.minMPONDStake,
            web3.utils.keccak256(MPONDInstance.address),
            PONDInstance.address,
            [PONDTokenId, MPONDTokenId],
            [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
        ));
    });

    it.skip("Add reward factor", async () => {
        // TODO: Not being used as of now, but add test cases later
    });

    it.skip("remove reward factor", async () => {
        // TODO: Not being used as of now, but add test cases later
    });

    it.skip("update reward factor", async () => {
        // TODO: Not being used as of now, but add test cases later
    });

    it("update rewards", async () => {
        // Update rewards when there are no rewards pending for the cluster
        // update rewards when there are pending rewards for cluster and check if cluster is getting correct commission and also that accRewardPerShare is getting updated correctly
        // If weightedStake is 0, then check that no rewards are distributed
        // If rewards exist and then weightedStake becomes 0, then rewards still have to be distributed

        // If weightedStake is 0, then check that no rewards are distributed
        // const weightedStake = await rewardDelegators.getClustersWeightedStake(registeredCluster);
        // assert.equal(Number(weightedStake), 0);

        const clusterBeforeReward = await clusterRewards.clusterRewards(registeredCluster);
        assert.equal(Number(clusterBeforeReward), 0);

        await rewardDelegators._updateRewards(registeredCluster, { from: rewardDelegatorsOwner });

        const clusterAfterReward = await clusterRewards.clusterRewards(registeredCluster);
        assert.equal(Number(clusterAfterReward), 0);

        // Check For Correct Update Case
        const commission = 5;
        await clusterRegistry.register(web3.utils.keccak256("DOT"), commission, registeredClusterRewardAddress, clientKey1, {
            from: registeredCluster
        });

        await delegate(delegator, [registeredCluster], [0], [2000000]);

        await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
        await feedData([registeredCluster], 1);

        const clusterUpdatedReward = await clusterRewards.clusterRewards(registeredCluster);
        assert.equal(Number(clusterUpdatedReward), 3333);

        const rewardAddrOldBalance = await PONDInstance.balanceOf(registeredClusterRewardAddress);
        assert.equal(Number(rewardAddrOldBalance), 0);

        const accPondRewardPerShareBefore = await rewardDelegators.getAccRewardPerShare(registeredCluster, PONDTokenId);
        const accMPondRewardPerShareBefore = await rewardDelegators.getAccRewardPerShare(registeredCluster, MPONDTokenId);
        assert.equal(Number(accPondRewardPerShareBefore), 0);
        assert.equal(Number(accMPondRewardPerShareBefore), 0);

        const rewardDelegatorsBal = await PONDInstance.balanceOf(rewardDelegators.address);

        // transfer POND for rewards
        await PONDInstance.transfer(rewardDelegators.address, appConfig.staking.rewardPerEpoch*100);
        await rewardDelegators._updateRewards(registeredCluster, { from: rewardDelegatorsOwner });

        // Checking Cluster Reward
        const cluster1UpdatedRewardNew = await clusterRewards.clusterRewards(registeredCluster);
        assert.equal(Number(cluster1UpdatedRewardNew), 1);

        // Checking Cluster Commission
        const rewardAddrNewBalance = await PONDInstance.balanceOf(registeredClusterRewardAddress);
        assert(rewardAddrOldBalance != rewardAddrNewBalance);

        // the actual rewardAddrNewBalance is 166.65 but due to solidity uint, it'll be 166
        assert.equal(Number(rewardAddrNewBalance), Math.floor(Number(clusterUpdatedReward) / 100 * commission));

        // Checking cluster Acc Reward
        const accPondRewardPerShareAfter = await rewardDelegators.getAccRewardPerShare(registeredCluster, PONDTokenId);
        const accMPondRewardPerShareAfter = await rewardDelegators.getAccRewardPerShare(registeredCluster, MPONDTokenId);
        assert.equal(String(accPondRewardPerShareAfter), "1583000000000000000000000000");
        assert.equal(String(accMPondRewardPerShareAfter), "0");
    });

    it("delegate to cluster", async () => {
        // delegate to an  invalid cluster
        // delegate to a 
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 0, registeredCluster1RewardAddress, clientKey2, {
            from: registeredCluster1
        });
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 0, registeredCluster2RewardAddress, clientKey3, {
            from: registeredCluster2
        });
        // 2 users delegate tokens to a cluster - one twice the other
        await delegate(delegator1, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
        await delegate(delegator2, [registeredCluster1, registeredCluster2], [10, 0], [0, 2000000]);
        let accPondRewardPerShareBefore = await rewardDelegators.getAccRewardPerShare(registeredCluster1, PONDTokenId);
        let accMPondRewardPerShareBefore = await rewardDelegators.getAccRewardPerShare(registeredCluster1, MPONDTokenId);
        // data is fed to the oracle
        // await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
        // wait for 1 day
        await increaseTime(1*86400);
        await feedData([registeredCluster1, registeredCluster2], 2);
        const cluster1Reward = await clusterRewards.clusterRewards(registeredCluster1);
        const cluster2Reward = await clusterRewards.clusterRewards(registeredCluster2);
        console.log(cluster1Reward.toString(), cluster2Reward.toString());
        assert(cluster1Reward.toString() == parseInt((10 + 2) / (10 + 2 + 4 + 2) * appConfig.staking.rewardPerEpoch / 3));
        assert(cluster2Reward.toString() == parseInt((4 + 2) / (10 + 2 + 4 + 2) * appConfig.staking.rewardPerEpoch / 3));
        // do some delegations for both users to the cluster
        // rewards for one user is withdraw - this reward should be as per the time of oracle feed
        let PondBalance1Before = await PONDInstance.balanceOf(delegator1);
        await delegate(delegator1, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
        let PondBalance1After = await PONDInstance.balanceOf(delegator1);
        let accPondRewardPerShare = await rewardDelegators.getAccRewardPerShare(registeredCluster1, PONDTokenId);
        let accMPondRewardPerShare = await rewardDelegators.getAccRewardPerShare(registeredCluster1, MPONDTokenId);
        console.log(accPondRewardPerShare.sub(accPondRewardPerShareBefore).toString(), accMPondRewardPerShare.sub(accMPondRewardPerShareBefore).toString())
        console.log(PondBalance1After.sub(PondBalance1Before).toString(), parseInt(appConfig.staking.rewardPerEpoch * 1 / 3 * (2.0 / 3 * 1 / 2 + 1.0 / 3 * 1 / 2)), appConfig.staking.rewardPerEpoch / 3);
        
        // substract 1 from the delegator rewards according to contract changes?
        assert.equal(PondBalance1After.sub(PondBalance1Before).toString(), parseInt(appConfig.staking.rewardPerEpoch * 1 / 3 * (2.0 / 3 * 1 / 2 + 1.0 / 3 * 1 / 2))-1);
        // feed data again to the oracle
        // await feedData([registeredCluster, registeredCluster1, registeredCluster2, registeredCluster3, registeredCluster4]);
        // // do some delegations for both users to the cluster
        // let PondBalance2Before = await PONDInstance.balanceOf(delegator2);
        // await delegate(delegator2, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
        // let PondBalance2After = await PONDInstance.balanceOf(delegator2);
        // console.log(PondBalance2After.sub(PondBalance2Before).toString(), appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5)));
        // assert(PondBalance2After.sub(PondBalance2Before).toString() == parseInt(appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5))));
    });

    it("withdraw reward", async () => {
        const commission = 10;
        await clusterRegistry.register(web3.utils.keccak256("DOT"), commission, registeredCluster3RewardAddress, clientKey4, {
            from: registeredCluster3
        });

        await delegate(delegator3, [registeredCluster3], [4], [1000000]);
        // await skipBlocks(10); // skip blocks to ensure feedData has enough time diff between them.
        // wait 1 day
        await increaseTime(1*86400);
        await feedData([registeredCluster3], 3);
        const clusterReward = await clusterRewards.clusterRewards(registeredCluster3);
        const clusterCommission = Math.floor(Number(clusterReward) / 100 * commission);

        const delegatorOldBalance = await PONDInstance.balanceOf(delegator3);
        assert.equal(Number(delegatorOldBalance), 0);

        await rewardDelegators.withdrawRewards(delegator3, registeredCluster3, { from: delegator3 });

        const delegatorNewBalance = await PONDInstance.balanceOf(delegator3);
        assert.equal(Number(delegatorNewBalance), Number(clusterReward) - clusterCommission);
    });

    it("update MPOND Token id", async () => {
        // update MPOND token id and check if minMPOND requirements is happenning(is cluster  active) with the updated token
        // cluster had minMPOND before and after change it doesn't
        // cluster had minMPOND before and after change it does have in new tokenId as well
        // update MPOND token to id that doesn't have an address mapped
        const oldMPONDTokenId = await rewardDelegators.MPONDTokenId();
        const oldClusterDelegation = await rewardDelegators.getClusterDelegation(registeredCluster1, oldMPONDTokenId);

        const rewardDelegatorsOwner = await rewardDelegators.owner();
        await rewardDelegators.updateMPONDTokenId(web3.utils.keccak256("dummyTokenId"),
            { from: rewardDelegatorsOwner });
        const newMPONDTokenId = await rewardDelegators.MPONDTokenId();

        // should be zero
        const newClusterDelegation = await rewardDelegators.getClusterDelegation(registeredCluster1, newMPONDTokenId);
        const clusterTokenDelegation = await rewardDelegators.getClusterDelegation(registeredCluster1, oldMPONDTokenId);
        assert(newClusterDelegation.toString() == 0);
        assert(oldClusterDelegation.toString() == clusterTokenDelegation.toString());
    });

    it("reinitialize contract then delegate and withdraw rewards for single token", async () => {

        // deploy pond and mpond tokens
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
        
        // deploy a test erc20 token
        testTokenInstance = await TestERC20.new(1000000000);
        const testTokenId = web3.utils.keccak256(testTokenInstance.address);
        await stakeContract.initialize(
            [testTokenId],
            [testTokenInstance.address],
            MPONDInstance.address,
            clusterRegistry.address,
            rewardDelegators.address,
            stakeManagerOwner,
            appConfig.staking.undelegationWaitTime
        );

        const selectors = [web3.utils.keccak256("COMMISSION_LOCK"), web3.utils.keccak256("SWITCH_NETWORK_LOCK"), web3.utils.keccak256("UNREGISTER_LOCK")];
        const lockWaitTimes = [commissionLockWaitTime, swtichNetworkLockTime, unregisterLockWaitTime];

        await clusterRegistry.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

        await rewardDelegators.initialize(
            stakeContract.address,
            clusterRewards.address,
            clusterRegistry.address,
            rewardDelegatorsOwner,
            appConfig.staking.minMPONDStake,
            web3.utils.keccak256(MPONDInstance.address),
            PONDInstance.address,
            [testTokenId],
            [100]
        );

        await clusterRewards.initialize(
            clusterRewardsOwner, // oracleOwner,
            rewardDelegators.address,
            [web3.utils.keccak256("testing")],
            [100],
            appConfig.staking.rewardPerEpoch,
            PONDInstance.address,
            appConfig.staking.payoutDenomination,
            feeder,
            10
        );

        await MPONDInstance.addWhiteListAddress(stakeContract.address, {
            from: admin
        });
        assert((await MPONDInstance.isWhiteListed(stakeContract.address)), "StakeManager contract not whitelisted");

        await PONDInstance.mint(accounts[0], new web3.utils.BN("100000000000000000000"));

        await PONDInstance.transfer(clusterRewards.address, appConfig.staking.rewardPerEpoch * 100);

        // register cluster
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 10, registeredCluster4RewardAddress, clientKey5, {
            from: registeredCluster4
        });

        const delegator1BeforeBalance = await PONDInstance.balanceOf(delegator1);

        // delegate to the cluster
        await delegateToken(delegator1, [registeredCluster4], [10], testTokenInstance);
        await delegateToken(delegator2, [registeredCluster4], [20], testTokenInstance);
        await skipBlocks(10);
        await feedTokenData([registeredCluster4], testTokenInstance, 1);
        
        // cluster reward
        const cluster4Reward = await clusterRewards.clusterRewards(registeredCluster4);
        assert(cluster4Reward.toString() == 10000);

        // transfer POND for rewards
        await PONDInstance.transfer(rewardDelegators.address, appConfig.staking.rewardPerEpoch*100);
        await rewardDelegators.withdrawRewards(delegator1, registeredCluster4, { from: delegator1 });

        // delegator reward
        const delegator1AfterBalance = await PONDInstance.balanceOf(delegator1);
        assert(delegator1AfterBalance.toString() == 3000);
    });

    it("delegate tokens then update reward factor then delegate again", async () => {
        const rewardDelegatorsOwner = await rewardDelegators.owner();
        const delegatorBalBefore = await PONDInstance.balanceOf(delegator3);
        assert(delegatorBalBefore.toString() == 0);

        await truffleAssert.reverts(rewardDelegators.updateRewardFactor(
            web3.utils.keccak256(testTokenInstance.address), 0,
            {from: rewardDelegatorsOwner}));

        // update the reward factor then delegate then withdraw
        await rewardDelegators.updateRewardFactor(
            web3.utils.keccak256(testTokenInstance.address), 5,
            {from: rewardDelegatorsOwner});
        await delegateToken(delegator3, [registeredCluster4], [10], testTokenInstance);
        // await skipBlocks(10);
        // wait 1 day
        await increaseTime(1*86400);
        await feedTokenData([registeredCluster4], testTokenInstance, 2);
        await rewardDelegators.withdrawRewards(delegator3, registeredCluster4,
            { from: delegator3 });
        
        const delegatorBalAfter = await PONDInstance.balanceOf(delegator3);
        assert(delegatorBalAfter.toString() == 2250);
    });

    it("delegate tokens then remove reward factor then delegate again", async () => {
        const rewardDelegatorsOwner = await rewardDelegators.owner();
        const delegatorBalBefore = await PONDInstance.balanceOf(delegator4);
        assert(delegatorBalBefore.toString() == 0);

        await truffleAssert.reverts(rewardDelegators.updateRewardFactor(
            web3.utils.keccak256(testTokenInstance.address), 0,
            {from: rewardDelegatorsOwner}));

        // update the reward factor then delegate then withdraw
        await rewardDelegators.removeRewardFactor(
            web3.utils.keccak256(testTokenInstance.address), {from: rewardDelegatorsOwner});
        await delegateToken(delegator4, [registeredCluster4], [10], testTokenInstance);
        // await skipBlocks(10);
        // wait for 1 day
        await increaseTime(1*86400);

        await feedTokenData([registeredCluster4], testTokenInstance, 3);
        await rewardDelegators.withdrawRewards(delegator4, registeredCluster4,
            { from: delegator4 });
        
        const delegatorBalAfter = await PONDInstance.balanceOf(delegator4);
        assert(delegatorBalAfter.toString() == 0);
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

    async function delegateToken(delegator, clusters, tokenAmounts, tokenInstance) {
        let totalToken = 0;
        for (let i = 0; i < tokenAmounts.length; i++) {
            totalToken += tokenAmounts[i];
        }

        if (totalToken > 0) {
            await tokenInstance.transfer(delegator, totalToken);
            await tokenInstance.approve(stakeContract.address, totalToken, {
                from: delegator
            });
        }

        const stashes = [];
        let testTokenId = web3.utils.keccak256(tokenInstance.address);
        for (let i = 0; i < clusters.length; i++) {
            const tokens = [];
            const amounts = [];
            if (tokenAmounts[i] > 0) {
                tokens.push(testTokenId);
                amounts.push(tokenAmounts[i]);
            }
            const receipt = await stakeContract.createStashAndDelegate(tokens, amounts, clusters[i], {
                from: delegator
            });
            stashes.push(receipt.logs[0].args.stashId);
        }
        return stashes;
    }

    async function feedTokenData(clusters, tokenInstance, epoch) {
        const stakes = [];
        let totalStake = new web3.utils.BN(0);
        let pondPerToken = new web3.utils.BN(1000000);
        let payoutDenomination = new web3.utils.BN(appConfig.staking.payoutDenomination);

        let testTokenId = await web3.utils.keccak256(tokenInstance.address);
        for (let i = 0; i < clusters.length; i++) {
            const tokenClusterStake = await rewardDelegators.getClusterDelegation(clusters[i], testTokenId);
            const clusterStake = tokenClusterStake.mul(pondPerToken);
            stakes.push(clusterStake);
            totalStake = totalStake.add(clusterStake);
        }
        const payouts = [];
        for (let i = 0; i < clusters.length; i++) {
            const stake = stakes[i];
            payouts.push(stake.mul(payoutDenomination).div(totalStake).toString())
        }
        console.log(payouts);
        await clusterRewards.feed(web3.utils.keccak256("testing"), clusters, payouts, epoch, {
            from: feeder
        });
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
        console.log(payouts);
        await clusterRewards.feed(web3.utils.keccak256("DOT"), clusters, payouts, epoch, {
            from: feeder
        });
    }

    async function skipBlocks(noOfBlocks) {
        for(let i=0; i < noOfBlocks; i++) {
            await PONDInstance.transfer(accounts[0], 0);
        }
    }
});

async function increaseTime(time) {
    return new Promise ((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [time],
            id: 0,
        }, (err, res) => {
            if(err) {
                reject(err)
            } else {
                web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    params: [],
                    id: 0
                }, (err, res) => {
                    if(err) {
                        reject(err)
                    } else {
                        resolve()
                    }
                });
            }
        })
    });
}
