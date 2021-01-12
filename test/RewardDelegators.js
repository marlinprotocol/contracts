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

let PONDInstance, MPONDInstance, stakeContract, clusterRegistry, rewardDelegators, clusterRewards;
let PONDTokenId, MPONDTokenId;
const commissionLockWaitTime = 20, swtichNetworkLockTime = 21, unregisterLockWaitTime = 22;

contract("RewardDelegators contract", async function(accounts) {

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
    const unregisteredCluster = accounts[19];
    const clientKey = accounts[20];
    const delegator = accounts[21];
    const delegator1 = accounts[22];
    const delegator2 = accounts[23];

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
            stakeManagerOwner
        );
        
        const selectors = [web3.utils.keccak256("COMMISSION_LOCK"), web3.utils.keccak256("SWITCH_NETWORK_LOCK"), web3.utils.keccak256("UNREGISTER_LOCK")];
        const lockWaitTimes = [commissionLockWaitTime, swtichNetworkLockTime, unregisterLockWaitTime];

        await clusterRegistry.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

        await rewardDelegators.initialize(
            appConfig.staking.undelegationWaitTime,
            stakeContract.address,
            clusterRewards.address,
            clusterRegistry.address,
            rewardDelegatorsOwner,
            appConfig.staking.minMPONDStake,
            web3.utils.keccak256(MPONDInstance.address),
            PONDInstance.address,
            [PONDTokenId, MPONDTokenId],
            [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
        );

        await clusterRewards.initialize(
            clusterRewardsOwner, // oracleOwner,
            rewardDelegators.address,
            ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533", "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701", "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
            [100, 100, 100],
            appConfig.staking.rewardPerEpoch,
            PONDInstance.address, 
            appConfig.staking.payoutDenomination,
            feeder
        );

        await MPONDInstance.addWhiteListAddress(stakeContract.address, {
            from: admin
        });
        assert((await MPONDInstance.isWhiteListed(stakeContract.address)), "StakeManager contract not whitelisted");

        await PONDInstance.mint(accounts[0], new web3.utils.BN("100000000000000000000"));

        await PONDInstance.transfer(clusterRewards.address, appConfig.staking.rewardPerEpoch*100);
        // initialize contract and check if all variables are correctly set(including admin)
        assert((await rewardDelegators.undelegationWaitTime()) == appConfig.staking.undelegationWaitTime, "Undelegation wait time not initalized correctly");
        assert((await rewardDelegators.minMPONDStake()) == appConfig.staking.minMPONDStake, "minMPONDStake not initalized correctly");
        // reverts if initialized again
        await truffleAssert.reverts(rewardDelegators.initialize(
            appConfig.staking.undelegationWaitTime,
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

    it("update MPOND Token id", async () => {
        // update MPOND token id and check if minMPOND requirements is happenning(is cluster  active) with the updated token
        // cluster had minMPOND before and after change it doesn't
        // cluster had minMPOND before and after change it does have in new tokenId as well
        // update MPOND token to id that doesn't have an address mapped
    });

    it("Add reward factor", async () => {
        // TODO: Not being used as of now, but add test cases later
    });

    it("remove reward factor", async () => {
        // TODO: Not being used as of now, but add test cases later
    });

    it("update reward factor", async () => {
        // TODO: Not being used as of now, but add test cases later
    });

    it("update rewards", async () => {
        // Update rewards when there are no rewards pending for the cluster
        // update rewards when there are pending rewards for cluster and check if cluster is getting correct commission and also that accRewardPerShare is getting updated correctly
        // If weightedStake is 0, then check that no rewards are distributed
        // If rewards exist and then weightedStake becomes 0, then rewards still have to be distributed
    });

    it("delegate to cluster", async () => {
        // delegate to an  invalid cluster
        // delegate to a 
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 0, registeredCluster1RewardAddress, clientKey, {
            from: registeredCluster1
        });
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 0, registeredCluster2RewardAddress, clientKey, {
            from: registeredCluster2
        });
        // 2 users delegate tokens to a cluster - one twice the other
        await delegate(delegator1, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
        await delegate(delegator2, [registeredCluster1, registeredCluster2], [10, 0], [0, 2000000]);
        // data is fed to the oracle
        await feedData([registeredCluster1, registeredCluster2]);
        const cluster1Reward = await clusterRewards.clusterRewards(registeredCluster1);
        const cluster2Reward = await clusterRewards.clusterRewards(registeredCluster2);
        console.log(cluster1Reward, cluster2Reward);
        assert(cluster1Reward.toString() == parseInt((10+2)/(10+2+4+2)*appConfig.staking.rewardPerEpoch/3));
        assert(cluster2Reward.toString() == parseInt((4+2)/(10+2+4+2)*appConfig.staking.rewardPerEpoch/3));
        // do some delegations for both users to the cluster
        // rewards for one user is withdraw - this reward should be as per the time of oracle feed
        let PondBalance1Before = await PONDInstance.balanceOf(delegator1);
        await delegate(delegator1, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
        let PondBalance1After = await PONDInstance.balanceOf(delegator1);
        console.log(PondBalance1After.sub(PondBalance1Before).toString(), parseInt(appConfig.staking.rewardPerEpoch*(2.0/3*9/10*1/6+1.0/3*19/20*2/3)), appConfig.staking.rewardPerEpoch/3);
        assert(PondBalance1After.sub(PondBalance1Before).toString() == parseInt(appConfig.staking.rewardPerEpoch*(2.0/3*9/10*1/6+1.0/3*19/20*2/3)));
        // feed data again to the oracle
        // await feedData([registeredCluster, registeredCluster1, registeredCluster2, registeredCluster3, registeredCluster4]);
        // // do some delegations for both users to the cluster
        // let PondBalance2Before = await PONDInstance.balanceOf(delegator2);
        // await delegate(delegator2, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
        // let PondBalance2After = await PONDInstance.balanceOf(delegator2);
        // console.log(PondBalance2After.sub(PondBalance2Before).toString(), appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5)));
        // assert(PondBalance2After.sub(PondBalance2Before).toString() == parseInt(appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5))));
    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    it("", async () => {

    });

    async function getTokensAndApprove(user, tokens, spender) {
        if(tokens.pond > 0) {
            await PONDInstance.transfer(user, tokens.pond);
            await PONDInstance.approve(spender, tokens.pond, {
                from: user
            });
        }
        if(tokens.mpond > 0) {
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
        for(let i=0; i < pondAmounts.length; i++) {
            totalPond += pondAmounts[i];
            totalMPond += mpondAmounts[i];
        }
        await getTokensAndApprove(delegator, { pond: totalPond, mpond: totalMPond }, stakeContract.address);
    
        const stashes = [];
        for(let i=0; i < clusters.length; i++) {
            const tokens = [];
            const amounts = [];
            if(mpondAmounts[i] > 0) {
                tokens.push(MPONDTokenId);
                amounts.push(mpondAmounts[i]);
            }
            if(pondAmounts[i] > 0) {
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
    
    async function feedData(clusters) {
        const stakes = [];
        let totalStake = new web3.utils.BN(0);
        let pondPerMpond = new web3.utils.BN(1000000);
        let payoutDenomination = new web3.utils.BN(appConfig.staking.payoutDenomination);
        for(let i=0; i < clusters.length; i++) {
            const mpondClusterStake = await rewardDelegators.getClusterDelegation(clusters[i], MPONDTokenId);
            const pondClusterStake = await rewardDelegators.getClusterDelegation(clusters[i], PONDTokenId);
            const clusterStake = mpondClusterStake.mul(pondPerMpond).add(pondClusterStake);
            stakes.push(clusterStake);
            totalStake = totalStake.add(clusterStake);
        }
        const payouts = [];
        for(let i=0; i < clusters.length; i++) {
            const stake = stakes[i];
            payouts.push(stake.mul(payoutDenomination).div(totalStake).toString())
        }
        console.log(payouts);
        await clusterRewards.feed(web3.utils.keccak256("DOT"), clusters, payouts, {
            from: feeder
        });
    }
});