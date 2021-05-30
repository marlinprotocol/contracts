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

const PerfOracle = artifacts.require("ClusterRewards.sol");
const PerfOracleProxy = artifacts.require("ClusterRewardsProxy.sol");

const { BigNumber } = require("ethers/utils");
const appConfig = require("../app-config");
const truffleAssert = require("truffle-assertions");
const { AddressZero } = require("ethers/constants");

contract("Stake contract", async function(accounts) {

    let PONDInstance;
    let MPONDInstance;
    let stakeContract;
    let clusterRegistry;
    let perfOracle;
    let rewardDelegators;
    const bridge = accounts[2];
    const admin = accounts[1];
    const proxyAdmin = accounts[1];
    const dropBridgeAddress = accounts[11];
    const oracleOwner = accounts[10];
    const rewardDelegatorsAdmin = accounts[2];
    const MPONDAccount = accounts[3];
    const registeredCluster = accounts[4];
    const registeredClusterRewardAddress = accounts[7];
    const unregisteredCluster = accounts[5];
    const unregisteredClusterRewardAddress = accounts[8];
    const deregisteredCluster = accounts[6];
    const deregisteredClusterRewardAddress = accounts[9];
    const clientKey = accounts[19];
    const registeredCluster1 = accounts[20];
    const registeredCluster1RewardAddress = accounts[21];
    const registeredCluster2 = accounts[22];
    const registeredCluster2RewardAddress = accounts[23];
    const deregisteredCluster1 = accounts[24];
    const deregisteredCluster1RewardAddress = accounts[25];

    const stakeManagerOwner = accounts[12];
    const clusterRegistryOwner = accounts[13];
    const rewardDelegatorsOwner = accounts[14];
    const clusterRewardsOwner = accounts[15];
    const feeder = accounts[16];

    let PONDTokenId;
    let MPONDTokenId;

    it("deploy stake contract and initialize tokens and whitelist stake contract", async () => {
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

        const perfOracleDeployment = await PerfOracle.new();
        const perfOracleProxyInstance = await PerfOracleProxy.new(perfOracleDeployment.address, proxyAdmin);
        perfOracle = await PerfOracle.at(perfOracleProxyInstance.address);

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
        const lockWaitTimes = [4, 10, 22];

        await clusterRegistry.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

        await rewardDelegators.initialize(
            appConfig.staking.undelegationWaitTime,
            stakeContract.address,
            perfOracle.address,
            clusterRegistry.address,
            rewardDelegatorsOwner,
            appConfig.staking.minMPONDStake,
            web3.utils.keccak256("MPOND"),
            PONDInstance.address,
            [PONDTokenId, MPONDTokenId],
            [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
        )

        await perfOracle.initialize(
            clusterRewardsOwner, // oracleOwner,
            rewardDelegators.address,
            ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533", "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701", "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
            [100, 100, 100],
            appConfig.staking.rewardPerEpoch,
            MPONDInstance.address,
            appConfig.staking.payoutDenomination,
            feeder,
            10
        )

        await MPONDInstance.addWhiteListAddress(stakeContract.address, {
            from: admin
        })
        assert((await MPONDInstance.isWhiteListed(stakeContract.address), "StakeManager contract not whitelisted"));

        // await MPONDInstance.addWhiteListAddress(perfOracle.address, {
        //     from: admin
        // })
        // assert((await MPONDInstance.isWhiteListed(perfOracle.address), "StakeManager contract not whitelisted"));

        await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));

        await PONDInstance.transfer(perfOracle.address, appConfig.staking.rewardPerEpoch*100);

        await stakeContract.updateLockWaitTime(web3.utils.keccak256("REDELEGATION_LOCK"), 5, {
            from: stakeManagerOwner
        });
        assert((await stakeContract.lockWaitTime(web3.utils.keccak256("REDELEGATION_LOCK"))) == 5, "Waittime not set correctly");
    });

    it("create POND stash", async () => {
        const amount = 12000000;

        await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));

        await PONDInstance.approve(stakeContract.address, 0);
        // should revert without token allowance
        await truffleAssert.reverts(stakeContract.createStash([PONDTokenId], [1]));

        await PONDInstance.approve(stakeContract.address, amount);
        assert((await PONDInstance.allowance(accounts[0], stakeContract.address)) == amount);
        const prevUserBalance = await PONDInstance.balanceOf(accounts[0]);
        const prevBalLowStash = await PONDInstance.balanceOf(stakeContract.address);
        // Even if excess amount is approved, only amount mentioned while creating stash should be used and tokens should be transferred to stakingContract.
        let tx = await stakeContract.createStash([PONDTokenId], [amount - 100]);
        const postBalLowStash = await PONDInstance.balanceOf(stakeContract.address);
        const postUserBalance = await PONDInstance.balanceOf(accounts[0]);
        assert(postBalLowStash.sub(prevBalLowStash) == amount-100, `StakeManager balance not matching: Prev: ${prevUserBalance.toString()}, Post: ${postUserBalance.toString()}, Amount: ${amount-100}`);
        assert(prevUserBalance.sub(postUserBalance) == amount-100, `User balance not matching: Prev: ${prevUserBalance.toString()}, Post: ${postUserBalance.toString()}, Amount: ${amount-100}`);

        await PONDInstance.approve(stakeContract.address, amount);
        const prevBalEqStash = await PONDInstance.balanceOf(stakeContract.address);
        // If exact amount is approved, the stash should still be created and tokens transferred to stakingContract with specified amount
        await stakeContract.createStash([PONDTokenId], [amount]);
        const postBalEqStash = await PONDInstance.balanceOf(stakeContract.address);
        assert(postBalEqStash.sub(prevBalEqStash) == amount);

        // Should revert if trying to createStash with more amount than approved.
        await PONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash([PONDTokenId], [amount+1]));

        // should revert if trying to createStash with any of the token using 0 amount
        await PONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash([PONDTokenId], [0]));
        await truffleAssert.reverts(stakeContract.createStash([PONDTokenId, MPONDTokenId], [amount, 0]));

        // should revert if trying to createStash with same tokenId sent multiple times in same tx
        await PONDInstance.approve(stakeContract.address, amount+2);
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash([PONDTokenId, MPONDTokenId, PONDTokenId], [amount, amount, 2]))
        // If multiple stashes with same data are created, stashid should be different for both
        await PONDInstance.approve(stakeContract.address, amount*2);
        let tx1 = await stakeContract.createStash([PONDTokenId], [amount]);
        let tx2 = await stakeContract.createStash([PONDTokenId], [amount]);
        assert(tx1.logs[0].args.stashId != tx2.logs[0].args.stashId);
    });

    it("create MPOND stash", async () => {
        const amount = 13000000;

        await MPONDInstance.transfer(accounts[0], amount*8, {
            from: MPONDAccount
        });

        await MPONDInstance.approve(stakeContract.address, 0);
        // should revert without token allowance
        await truffleAssert.reverts(stakeContract.createStash([MPONDTokenId], [1]));

        await MPONDInstance.approve(stakeContract.address, amount);
        assert((await MPONDInstance.allowance(accounts[0], stakeContract.address)) == amount);

        const prevUserBalance = await MPONDInstance.balanceOf(accounts[0]);
        const prevBalLowStash = await MPONDInstance.balanceOf(stakeContract.address);
        // Even if excess amount is approved, only amount mentioned while creating stash should be used and tokens should be transferred to stakingContract.
        let tx = await stakeContract.createStash([MPONDTokenId], [amount - 100]);
        const postBalLowStash = await MPONDInstance.balanceOf(stakeContract.address);
        const postUserBalance = await MPONDInstance.balanceOf(accounts[0]);
        assert(postBalLowStash.sub(prevBalLowStash) == amount-100);
        assert(prevUserBalance.sub(postUserBalance) == amount-100);

        await MPONDInstance.approve(stakeContract.address, amount);
        const prevBalEqStash = await MPONDInstance.balanceOf(stakeContract.address);
        // If exact amount is approved, the stash should still be created and tokens transferred to stakingContract with specified amount
        await stakeContract.createStash([MPONDTokenId], [amount]);
        const postBalEqStash = await MPONDInstance.balanceOf(stakeContract.address);
        assert(postBalEqStash.sub(prevBalEqStash) == amount);

        // Should revert if trying to createStash with more amount than approved.
        await MPONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash([MPONDTokenId], [amount+1]));

        // should revert if trying to createStash with any of the token using 0 amount
        await MPONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash([MPONDTokenId], [0]));
        await truffleAssert.reverts(stakeContract.createStash([PONDTokenId, MPONDTokenId], [0, amount]));

        // should revert if trying to createStash with same tokenId sent multiple times in same tx
        await MPONDInstance.approve(stakeContract.address, amount+2);
        await PONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash([MPONDTokenId, PONDTokenId, MPONDTokenId], [amount, amount, 2]))
        // If multiple stashes with same data are created, stashid should be different for both
        await MPONDInstance.approve(stakeContract.address, amount*2);
        let tx1 = await stakeContract.createStash([MPONDTokenId], [amount]);
        let tx2 = await stakeContract.createStash([MPONDTokenId], [amount]);
        assert(tx1.logs[0].args.stashId != tx2.logs[0].args.stashId);
    });

    it("Delegated Stash to cluster that is yet to be created", async () => {
        // delegate a stash that is to be created, should revert
    });

    it("Delegate stash and ensure bookkeeping of cluster and delegator are correct", async () => {
        // delegate a stash and ensure that total cluster delegation increased and the delegator delegation increased
    });

    it("Delegate partially withdrawn stash", async () => {
        // delegate a stash that is partially withdrawn before delegating
    });

    it("Delegate POND stash", async () => {
        // delegate a stash that is withdrawn before delegating and hence deleted
        // delegate a stash already delegating
        // delegate a stash that is undelegating to same cluster
        // delegate a stash that is undelegating to different cluster
        // delegate a stash that is undelegated to a different cluster
        // delegate a stash that is undelegated to same cluster
        // delegate a stash that is undelegated and some amount is withdrawn
        // delegate a stash that is undelegated and completely withdrawn, hence deleted
        // delegate a stash that has multiple tokens
        // delegate from a stash
        const amount = 1000000;
        // register cluster with cluster registry
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
            from: registeredCluster
        });

        const clusterInitialPONDDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));

        const stashId = await createStash(0, amount);
        const initialStakeContractBalance = (await PONDInstance.balanceOf(stakeContract.address)).toString();
        await stakeContract.delegateStash(stashId, registeredCluster);
        const finalStakeContractBalance = (await PONDInstance.balanceOf(stakeContract.address)).toString();
        const clusterPONDDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));

        assert(clusterPONDDelegation - clusterInitialPONDDelegation == amount);
        assert(finalStakeContractBalance == initialStakeContractBalance);
    });

    it("Delegate MPOND stash", async () => {
        const amount = 1500000;
        // register cluster with cluster registry
        await truffleAssert.reverts(clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
            from: registeredCluster
        }));
        const clusterInitialMPONDDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));

        const stashId = await createStash(amount, 0);
        const initalStakeContractBalance = (await MPONDInstance.balanceOf(stakeContract.address)).toString();
        await stakeContract.delegateStash(stashId, registeredCluster);
        const finalStakeContractBalance = (await MPONDInstance.balanceOf(stakeContract.address)).toString();
        const clusterMPONDDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));

        assert(clusterMPONDDelegation - clusterInitialMPONDDelegation == amount);
        assert(finalStakeContractBalance == initalStakeContractBalance);
    });

    // it("Delegate random token to stash", async () => {
    //     const amount = 100000;
    //     await truffleAssert.fails(stakeContract.createStash(2, amount));
    // });

    it("Delegate POND to invalid cluster", async () => {
        const amount = 900000;
        const stashId = await createStash(0, amount);
        await truffleAssert.reverts(stakeContract.delegateStash(stashId, unregisteredCluster));
    });

    it("Delegate MPOND to invalid cluster", async () => {
        const amount = 800000;
        const stashId = await createStash(amount, 0);
        await truffleAssert.reverts(stakeContract.delegateStash(stashId, unregisteredCluster));
    });

    it("Delegate MPOND to deregistered cluster", async () => {
        await clusterRegistry.register(web3.utils.keccak256("NEAR"), 5, deregisteredClusterRewardAddress, clientKey, {
            from: deregisteredCluster
        });
        await clusterRegistry.unregister({
            from: deregisteredCluster
        })

        await skipBlocks(23);

        const amount = 700000;
        const stashId = await createStash(amount, 0);

        await truffleAssert.reverts(stakeContract.delegateStash(stashId, deregisteredCluster));
    });

    it("Redelegate a undelegated POND stash", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(0, amount);
        const clusterInitialPONDDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        await stakeContract.delegateStash(stashId, registeredCluster);
        const clusterFinalDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterFinalDelegation - clusterInitialPONDDelegation == amount, "Delegation of cluster not updated");
        // verify if redelegation is allowed after the time period and value changes after delegatedCluster is changed
        const delegationBeforeRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster1, PONDTokenId));
        const prevClusterDelegationBeforeRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        const stakeContractBalanceBeforeRedelegateRequest = (await PONDInstance.balanceOf(stakeContract.address));
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        const delegationAfterRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster1, PONDTokenId));
        const prevClusterDelegationAfterRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        const stakeContractBalanceAfterRedelegateRequest = (await PONDInstance.balanceOf(stakeContract.address));
        // check if the delegations doesn't change when requested, also the balance of stake contract doesn't change
        assert(delegationBeforeRedelegateRequest.eq(delegationAfterRedelegateRequest));
        assert(prevClusterDelegationBeforeRedelegateRequest.eq(prevClusterDelegationAfterRedelegateRequest));
        assert(stakeContractBalanceBeforeRedelegateRequest.eq(stakeContractBalanceAfterRedelegateRequest));
        await skipBlocks(2);
        await truffleAssert.reverts(stakeContract.requestStashRedelegation(stashId, registeredCluster1), "SM:RSR-Please close the existing redelegation request before placing a new one")
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
        await truffleAssert.reverts(stakeContract.requestStashRedelegation(stashId, registeredCluster1), "SM:RSR-Please close the existing redelegation request before placing a new one")
        await stakeContract.redelegateStash(stashId);
        const delegationAfterRedelegate = (await rewardDelegators.getClusterDelegation(registeredCluster1, PONDTokenId));
        const prevClusterDelegationAfterRedelegate = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        const stakeContractBalanceAfterRedelegate = (await PONDInstance.balanceOf(stakeContract.address));
        assert((await stakeContract.stashes(stashId)).delegatedCluster == registeredCluster1);
        assert(delegationAfterRedelegate - delegationAfterRedelegateRequest == amount);
        assert(prevClusterDelegationAfterRedelegateRequest - prevClusterDelegationAfterRedelegate == amount);
        assert(stakeContractBalanceAfterRedelegateRequest.eq(stakeContractBalanceAfterRedelegate));
    });

    it("Redelegate a undelegated MPOND stash", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        // Redelegate a stash that is delegated to some cluster and check the wait time and updates in cluster delegations
        const stashId = await createStash(amount, 0);
        const clusterInitialMPONDDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        await stakeContract.delegateStash(stashId, registeredCluster);
        const clusterFinalDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterFinalDelegation - clusterInitialMPONDDelegation == amount, "Delegation of cluster not updated");
        // verify if redelegation is allowed after the time period and value changes after delegatedCluster is changed
        const delegationBeforeRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster1, MPONDTokenId));
        const prevClusterDelegationBeforeRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const stakeContractBalanceBeforeRedelegateRequest = (await MPONDInstance.balanceOf(stakeContract.address));
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        const delegationAfterRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster1, MPONDTokenId));
        const prevClusterDelegationAfterRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const stakeContractBalanceAfterRedelegateRequest = (await MPONDInstance.balanceOf(stakeContract.address));
        // check if the delegations doesn't change when requested, also the balance of stake contract doesn't change
        assert(delegationBeforeRedelegateRequest.eq(delegationAfterRedelegateRequest));
        assert(prevClusterDelegationBeforeRedelegateRequest.eq(prevClusterDelegationAfterRedelegateRequest));
        assert(stakeContractBalanceBeforeRedelegateRequest.eq(stakeContractBalanceAfterRedelegateRequest));
        await truffleAssert.reverts(stakeContract.requestStashRedelegation(stashId, registeredCluster1), "SM:RSR-Please close the existing redelegation request before placing a new one")
        await skipBlocks(2);
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
        await truffleAssert.reverts(stakeContract.requestStashRedelegation(stashId, registeredCluster1), "SM:RSR-Please close the existing redelegation request before placing a new one")
        await stakeContract.redelegateStash(stashId);
        const delegationAfterRedelegate = (await rewardDelegators.getClusterDelegation(registeredCluster1, MPONDTokenId));
        const prevClusterDelegationAfterRedelegate = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const stakeContractBalanceAfterRedelegate = (await MPONDInstance.balanceOf(stakeContract.address));
        assert((await stakeContract.stashes(stashId)).delegatedCluster == registeredCluster1);
        assert(delegationAfterRedelegate - delegationAfterRedelegateRequest == amount);
        assert(prevClusterDelegationAfterRedelegateRequest - prevClusterDelegationAfterRedelegate == amount);
        assert(stakeContractBalanceAfterRedelegateRequest.eq(stakeContractBalanceAfterRedelegate));
    });

    it("Redelegate to unregistered cluster", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        // Redelegate to invalid cluster
        const stashId = await createStash(amount, amount);
        await truffleAssert.reverts(stakeContract.requestStashRedelegation(stashId, registeredCluster));
        await stakeContract.delegateStash(stashId, registeredCluster);
        await stakeContract.requestStashRedelegation(stashId, registeredCluster2);
        await skipBlocks(5);
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
        // cleanup  the redelegation
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster2))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster2RewardAddress, clientKey, {
                from: registeredCluster2
            });
        }
        await skipBlocks(20);
        await stakeContract.redelegateStash(stashId);
    });

    it("Redelegate to cluster that became invalid after request", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        // Redelegate to cluster that was valid when placing request then has unregistered(hence invalid) when applying redelegation
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        await clusterRegistry.unregister({
            from: registeredCluster1
        });
        await skipBlocks(23);
        assert(!(await clusterRegistry.isClusterValid.call(registeredCluster1)));
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
        // cleanup the redelegation
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
            from: registeredCluster1
        });
        await stakeContract.redelegateStash(stashId);
    });

    it("Redelegate a stash to a unregistering cluster", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        // Redelegate a stash that is undelegating
        await clusterRegistry.unregister({
            from: registeredCluster
        });
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        await skipBlocks(4);
        const delegationAfterRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster1, MPONDTokenId));
        const prevClusterDelegationAfterRedelegateRequest = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const stakeContractBalanceAfterRedelegateRequest = (await MPONDInstance.balanceOf(stakeContract.address));
        await stakeContract.redelegateStash(stashId);
        const delegationAfterRedelegate = (await rewardDelegators.getClusterDelegation(registeredCluster1, MPONDTokenId));
        const prevClusterDelegationAfterRedelegate = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const stakeContractBalanceAfterRedelegate = (await MPONDInstance.balanceOf(stakeContract.address));
        assert((await stakeContract.stashes(stashId)).delegatedCluster == registeredCluster1);
        assert(delegationAfterRedelegate - delegationAfterRedelegateRequest == amount);
        assert(prevClusterDelegationAfterRedelegateRequest - prevClusterDelegationAfterRedelegate == amount);
        assert(stakeContractBalanceAfterRedelegateRequest.eq(stakeContractBalanceAfterRedelegate));
        await skipBlocks(18);
        assert(!(await clusterRegistry.isClusterValid.call(registeredCluster)));
    });

    it("Redelegate a stash to a unregistered cluster", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        await clusterRegistry.unregister({
            from: registeredCluster1
        });
        // Register redelegate when cluster is undelegating and apply it when undelegated
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        await skipBlocks(23);
        assert(!(await clusterRegistry.isClusterValid.call(registeredCluster1)));
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
        // cleanup redelegation
        await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
            from: registeredCluster1
        });
        await stakeContract.redelegateStash(stashId);
    });

    it("Redelegate stash from an unregistered cluster", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        // Redelegate a stash that is undelegated
        await clusterRegistry.unregister({
            from: registeredCluster
        });
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        await skipBlocks(23);
        assert(!(await clusterRegistry.isClusterValid.call(registeredCluster)));
        await stakeContract.redelegateStash(stashId);
    });

    it("Redelegate stash that is undelegating", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        await stakeContract.undelegateStash(stashId);
        await truffleAssert.reverts(stakeContract.requestStashRedelegation(stashId, registeredCluster1));

    });

    it("Redelegate cluster when registered and apply when unregistering", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        // Register redelegate when cluster is registered and apply it when unregistering
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        await clusterRegistry.unregister({
            from: registeredCluster1
        });
        await skipBlocks(4);
        await stakeContract.redelegateStash(stashId);
        // cleanup unregistration
        await skipBlocks(20);
    });

    it("Check if redelegation requests before undelegation are applicable after", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        // Register redelegate to a cluster, undelegate and delegate again to another cluster. Now apply redelegation
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        await stakeContract.undelegateStash(stashId);
        await skipBlocks(23);
        await stakeContract.delegateStash(stashId, registeredCluster);
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
    });

    it("Check if redelegation request remains active even after usage", async () => {
        const amount = 1000000;
        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);
        // Register redelegate to a cluster and apply redelegation, undelegate and delegate again to another cluster. Now apply redelegation again
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        await skipBlocks(4);
        await stakeContract.redelegateStash(stashId)
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
        await skipBlocks(4);
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
        await stakeContract.undelegateStash(stashId);
        await skipBlocks(23);
        await stakeContract.delegateStash(stashId, registeredCluster);
        await truffleAssert.reverts(stakeContract.redelegateStash(stashId));
    });
    // Redelegate a stash that is undelegating
    // Redelegate a stash that is undelegated
    // Redelegate a stash that is undelegated and partially withdrawn
    // Redelegate a stash that is undelegated and fully withdrawn, hence deleted
    // Redelegate a stash to the same cluster

    // Register redelegate when cluster is delegated and apply it after undelegated and delegate again. Now apply redelegation again
    // Register redelegate when cluster is undelegating and apply it after undelegated and delegate again. Now apply redelegation again.

    it("create and Delegate POND stash", async () => {
        const amount = 750000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));

        await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);

        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
    });

    it("create and Delegate MPOND stash", async () => {
        const amount = 710000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));

        await stakeContract.createStashAndDelegate([MPONDTokenId], [amount], registeredCluster);

        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
    });

    it("Undelegate POND stash", async () => {
        const amount = 730000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));

        const receipt = await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        const balanceBefore = await PONDInstance.balanceOf(accounts[0]);
        await stakeContract.undelegateStash(stashId);
        const balanceAfter = await PONDInstance.balanceOf(accounts[0]);
        assert(balanceAfter.toString() == balanceBefore.toString());
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());
    });

    it("Undelegate MPOND stash", async () => {
        const amount = 710000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const receipt = await stakeContract.createStashAndDelegate([MPONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        const balanceBefore = await MPONDInstance.balanceOf(accounts[0]);
        await stakeContract.undelegateStash(stashId);
        const balanceAfter = await MPONDInstance.balanceOf(accounts[0]);
        assert(balanceBefore == balanceBefore);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());
    });

    it("Undelegate POND stash that doesn't exists", async () => {
        const amount = 690000;
        await PONDInstance.approve(stakeContract.address, amount);
        const receipt = await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);
        const stashId = receipt.logs[0].args.stashId;
        await stakeContract.undelegateStash(stashId);

        await truffleAssert.reverts(stakeContract.undelegateStash(stashId));
    });

    it("Undelegate MPOND stash that doesn't exists", async () => {
        const amount = 680000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);
        const receipt = await stakeContract.createStashAndDelegate([MPONDTokenId], [amount], registeredCluster);
        const stashId = receipt.logs[0].args.stashId;
        await stakeContract.undelegateStash(stashId);

        await truffleAssert.reverts(stakeContract.undelegateStash(stashId));
    });

    it("Undelegate POND stash from a deregistering cluster", async () => {
        const amount = 670000;
        await PONDInstance.approve(stakeContract.address, amount);
        await clusterRegistry.register(web3.utils.keccak256("NEAR"), 5, deregisteredClusterRewardAddress, clientKey, {
            from: deregisteredCluster
        });

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        const receipt = await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await clusterRegistry.unregister({
            from: deregisteredCluster
        });

        await skipBlocks(5);

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());
        await skipBlocks(24);
    });

    it("Undelegate POND stash from a deregistered cluster", async () => {
        const amount = 670000;
        await PONDInstance.approve(stakeContract.address, amount);
        await clusterRegistry.register(web3.utils.keccak256("NEAR"), 5, deregisteredClusterRewardAddress, clientKey, {
            from: deregisteredCluster
        });

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        const receipt = await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await clusterRegistry.unregister({
            from: deregisteredCluster
        });

        await skipBlocks(23);

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());
    });

    it("Undelegate MPOND stash from a deregistering cluster", async () => {
        const amount = 660000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);
        await clusterRegistry.register(web3.utils.keccak256("NEAR"), 5, deregisteredClusterRewardAddress, clientKey, {
            from: deregisteredCluster
        });

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const receipt = await stakeContract.createStashAndDelegate([MPONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await clusterRegistry.unregister({
            from: deregisteredCluster
        });

        await skipBlocks(5);

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());
        await skipBlocks(24);
    });

    it("Undelegate MPOND stash from a deregistered cluster", async () => {
        const amount = 660000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);
        await clusterRegistry.register(web3.utils.keccak256("NEAR"), 5, deregisteredClusterRewardAddress, clientKey, {
            from: deregisteredCluster
        });

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const receipt = await stakeContract.createStashAndDelegate([MPONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await clusterRegistry.unregister({
            from: deregisteredCluster
        });

        await skipBlocks(23);

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());
    });

    it("Withdraw POND before wait time", async () => {
        const amount = 650000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));

        const receipt = await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());

        await skipBlocks(appConfig.staking.undelegationWaitTime-2);

        await truffleAssert.reverts(stakeContract.withdrawStash(stashId));
    });

    it("Withdraw MPOND before wait time", async () => {
        const amount = 640000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const receipt = await stakeContract.createStashAndDelegate([MPONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());

        await skipBlocks(appConfig.staking.undelegationWaitTime-2);

        await truffleAssert.reverts(stakeContract.withdrawStash(stashId));
    });

    it("Withdraw POND after wait time", async () => {
        const amount = 630000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));

        const receipt = await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, PONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());

        await skipBlocks(appConfig.staking.undelegationWaitTime-1);

        const balanceBefore = (await PONDInstance.balanceOf(accounts[0])).toString();
        await stakeContract.withdrawStash(stashId);
        const balanceAfter = (await PONDInstance.balanceOf(accounts[0])).toString();
        const increasedBalance = (new BigNumber(balanceBefore)).add(amount);
        assert(increasedBalance == balanceAfter);
    });

    it("Withdraw MPOND after wait time", async () => {
        const amount = 620000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        const receipt = await stakeContract.createStashAndDelegate([MPONDTokenId], [amount], registeredCluster);
        const clusterDelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterDelegation - clusterInitialDelegation == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await rewardDelegators.getClusterDelegation(registeredCluster, MPONDTokenId));
        assert(clusterInitialDelegation.toString() == clusterDelegationAfterUndelegation.toString());

        await skipBlocks(appConfig.staking.undelegationWaitTime-1);

        const balanceBefore = await MPONDInstance.balanceOf(accounts[0]);
        await stakeContract.withdrawStash(stashId);
        const balanceAfter = await MPONDInstance.balanceOf(accounts[0]);
        assert(balanceAfter - balanceBefore == amount)
    });

    it("Redelegate POND stash", async () => {

    });

    it("Redelegate MPOND stash", async () => {

    });

    it("Create POND stash and split", async () => {
        const amount = 12000000;
        await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));
        await PONDInstance.approve(stakeContract.address, amount);

        let createStashTx = await stakeContract.createStash([PONDTokenId], [amount]);
        let stashIndex = await stakeContract.stashIndex();
        let splitTx = await stakeContract.splitStash(createStashTx.logs[0].args.stashId, [PONDTokenId], [amount-100]);

        // new stash id must be equal to keccak256(abi.encodePacked(stashIndex))
        let newStashID = await web3.utils.keccak256(web3.eth.abi.encodeParameters(
            ["uint256"],
            [stashIndex]
        ));
        assert.equal(splitTx.logs[0].args._newStashId, newStashID);

        // new stash should have amount = amount-100
        let newStashTokenAmt = await stakeContract.getTokenAmountInStash(
            splitTx.logs[0].args._newStashId, PONDTokenId
        );
        assert.equal(newStashTokenAmt.toString(), amount-100);

        // old stash shouhld have 100
        let oldStashTokenAmt = await stakeContract.getTokenAmountInStash(
            createStashTx.logs[0].args.stashId, PONDTokenId
        );
        assert.equal(oldStashTokenAmt.toString(), 100);
    });

    it("Create two stashes and then merge them", async () => {
        const amount = 1200;
        await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));
        await PONDInstance.approve(stakeContract.address, 10*amount);

        const createStash1 = await stakeContract.createStash([PONDTokenId], [3*amount]);
        const createStash2 = await stakeContract.createStash([PONDTokenId], [7*amount]);

        // merge these two stashes
        await stakeContract.mergeStash(
            createStash1.logs[0].args.stashId,
            createStash2.logs[0].args.stashId
        );

        // check if the amount is added
        const mergedAmount = await stakeContract.getTokenAmountInStash(
            createStash1.logs[0].args.stashId,
            PONDTokenId
        );
        assert.equal(mergedAmount.toString(), 10*amount);

        // check if old stash has nothing
        const oldAmount = await stakeContract.getTokenAmountInStash(
            createStash2.logs[0].args.stashId,
            PONDTokenId
        );
        assert.equal(oldAmount.toString(), 0);
    });

    it("Redelegate stash and then cancel redeledation", async () => {
        const amount = 1000000;

        // register and delegate
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster1))) {
            await clusterRegistry.register(web3.utils.keccak256("NEAR"), 10, registeredCluster1RewardAddress, clientKey, {
                from: registeredCluster1
            });
        }
        const stashId = await createStash(amount, amount);
        await stakeContract.delegateStash(stashId, registeredCluster);

        // Redelegate to cluster that was valid when placing request then has unregistered(hence invalid) when applying redelegation
        await stakeContract.requestStashRedelegation(stashId, registeredCluster1);
        const redeledationLockSelector =  web3.utils.keccak256("REDELEGATION_LOCK");

        const lockID = await web3.utils.keccak256(web3.eth.abi.encodeParameters(
            ["bytes32", "bytes32"],
            [redeledationLockSelector, stashId]
        ));
        let lock = await stakeContract.locks(lockID);

        // fail if unlock block is 0
        if (!lock.unlockBlock.toString()) {
            assert.fail(1, 0, "wrong unlock block");
        }

        // cancel redelegation
        const cancelTx = await stakeContract.cancelRedelegation(stashId);
        assert.equal(cancelTx.logs[0].event, "RedelegationCancelled", "Wrong event emitted");
        lock = await stakeContract.locks(lockID);
        assert.equal(lock.unlockBlock.toString(), 0, "lock not deleted");
    });

    it("cancel stash undelegation", async () => {
        if(!(await clusterRegistry.isClusterValid.call(registeredCluster))) {
            await clusterRegistry.register(web3.utils.keccak256("DOT"), 5, registeredClusterRewardAddress, clientKey, {
                from: registeredCluster
            });
        }

        const amount = 730000;
        await PONDInstance.approve(stakeContract.address, amount);
        const receipt = await stakeContract.createStashAndDelegate([PONDTokenId], [amount], registeredCluster);
        const stashId = receipt.logs[0].args.stashId;
        await stakeContract.undelegateStash(stashId);

        // cancel undelegation
        const cancelTx = await stakeContract.cancelUndelegation(stashId, registeredCluster);
        assert.equal(cancelTx.logs[0].event, "StashUndelegationCancelled", "Wrong event emitted");
        const stash = await stakeContract.stashes(stashId);
        assert.equal(stash.delegatedCluster.toString(),"0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF",
        "Temp address not set");
        assert.equal(stash.undelegatesAt.toString(), 0, "stash.undelegatesAt not deleted");
    });

    async function createStash(mpondAmount, pondAmount) {
        const tokens = [];
        const amounts = [];
        if(mpondAmount != 0) {
            await MPONDInstance.transfer(accounts[0], mpondAmount, {
                from: MPONDAccount
            });
            await MPONDInstance.approve(stakeContract.address, mpondAmount);
            tokens.push(MPONDTokenId);
            amounts.push(mpondAmount);
        }
        if(pondAmount != 0) {
            await PONDInstance.approve(stakeContract.address, pondAmount);
            tokens.push(PONDTokenId);
            amounts.push(pondAmount);
        }
        const tx = await stakeContract.createStash(tokens, amounts);
        return (tx.logs[0].args.stashId);
    }

    async function skipBlocks(noOfBlocks) {
        for(let i=0; i < noOfBlocks; i++) {
            await PONDInstance.transfer(accounts[0], 0);
        }
    }
});
