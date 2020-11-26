const PONDToken = artifacts.require("TokenLogic.sol");
const PONDProxy = artifacts.require("TokenProxy.sol");

const MPONDToken = artifacts.require("MPondLogic.sol");
const MPONDProxy = artifacts.require("MPondProxy.sol");

const Stake = artifacts.require("StakeManager.sol");

const ClusterRegistry = artifacts.require("ClusterRegistry.sol");

const PerfOracle = artifacts.require("PerfOracle.sol");

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
    const bridge = accounts[2];
    const admin = accounts[1];
    const oracleOwner = accounts[10];
    const MPONDAccount = accounts[3];
    const registeredCluster = accounts[4];
    const registeredClusterRewardAddress = accounts[7];
    const unregisteredCluster = accounts[5];
    const unregisteredClusterRewardAddress = accounts[8];
    const deregisteredCluster = accounts[6];
    const deregisteredClusterRewardAddress = accounts[9];
    const registeredCluster1 = accounts[11];
    const registeredCluster2 = accounts[12];
    const registeredCluster3 = accounts[13];
    const registeredCluster4 = accounts[14];
    const delegator1 = accounts[15];
    const delegator2 = accounts[16];
    const delegator3 = accounts[17];
    const delegator4 = accounts[18];
    const clientKey = accounts[19];

    it("deploy stake contract and initialize tokens and whitelist stake contract", async () => {
        const PONDDeployment = await PONDToken.new();
        const pondProxyInstance = await PONDProxy.new(PONDDeployment.address);
        PONDInstance = await PONDToken.at(pondProxyInstance.address);

        const MPONDDeployment = await MPONDToken.new();
        const MpondProxyInstance = await MPONDProxy.new(MPONDDeployment.address);
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
            {
                from: admin
            }
        );

        stakeContract = await Stake.new(
            MPONDInstance.address, 
            PONDInstance.address, 
            appConfig.staking.undelegationWaitTime,
            oracleOwner,
            appConfig.staking.rewardPerEpoch,
        );

        const clusterRegistryAddress = await stakeContract.clusters();
        clusterRegistry = await ClusterRegistry.at(clusterRegistryAddress);

        const perfOracleAddress = await clusterRegistry.oracle();
        perfOracle = await PerfOracle.at(perfOracleAddress);

        assert((await perfOracle.owner()) == oracleOwner, "Owner not correctly set");

        await MPONDInstance.addWhiteListAddress(stakeContract.address, {
            from: admin
        })
        assert((await MPONDInstance.isWhiteListed(stakeContract.address), "StakeManager contract not whitelisted"));

        await MPONDInstance.addWhiteListAddress(clusterRegistry.address, {
            from: admin
        })
        assert((await MPONDInstance.isWhiteListed(clusterRegistry.address), "clusterRegistry contract not whitelisted"));

        await MPONDInstance.addWhiteListAddress(perfOracle.address, {
            from: admin
        })
        assert((await MPONDInstance.isWhiteListed(perfOracle.address), "StakeManager contract not whitelisted"));

        await MPONDInstance.transfer(perfOracle.address, appConfig.staking.rewardPerEpoch*100, {
            from: MPONDAccount
        });

        await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));
    });

    it("Register cluster", async () => {

    });

    it("Register cluster with commission above 100", async () => {

    });

    it("Register an already registered cluster", async () => {

    });

    it("Register a deregistered cluster", async () => {

    });

    it("Update commission", async () => {

    });

    it("Update commission with value more than 100", async () => {

    });

    it("Update commission for a cluster that was never registered", async () => {

    });

    it("Update commission for a cluster that is deregistered", async () => {

    });

    it("Update reward address", async () => {

    });

    it("Update reward address for a cluster that was never registered", async () => {

    });

    it("Update reward address for a cluster that is deregistered", async () => {

    });

    it("Update client key", async () => {

    });

    it("Update client key for a cluster that was never registered", async () => {

    });

    it("Update client key for a cluster that is deregistered", async () => {

    });

    it("unregister cluster", async () => {

    });

    it("unregister cluster that was never registered", async () => {

    });

    it("unregister cluster that was already deregistered", async () => {

    });

    it("Check if cluster is valid", async () => {

    });

    it("check if cluster is active", async () => {

    });

    it("Delegator withdraw rewards from a cluster", async () => {
        await clusterRegistry.register(10, registeredClusterRewardAddress, clientKey, {
            from: registeredCluster1
        });
        await clusterRegistry.register(5, registeredClusterRewardAddress, clientKey, {
            from: registeredCluster2
        });
        // 2 users delegate tokens to a cluster - one twice the other
        await delegate(delegator1, [registeredCluster1, registeredCluster2], [1000000, 2], [0, 1]);
        await delegate(delegator2, [registeredCluster1, registeredCluster2], [5000000, 1], [0, 1]);
        // data is fed to the oracle
        const epochToFeed = parseInt((await perfOracle.currentEpoch())) + 1;
        await feedData(epochToFeed, [registeredCluster, registeredCluster1, registeredCluster2, registeredCluster3, registeredCluster4]);
        // do some delegations for both users to the cluster
        // rewards for one user is withdraw - this reward should be as per the time of oracle feed
        let MPondBalance1Before = await MPONDInstance.balanceOf(delegator1);
        await delegate(delegator1, [registeredCluster1, registeredCluster2], [1000000, 2], [0, 1]);
        let MPondBalance1After = await MPONDInstance.balanceOf(delegator1);
        console.log(MPondBalance1After.sub(MPondBalance1Before).toString(), appConfig.staking.rewardPerEpoch/3);
        assert(MPondBalance1After.sub(MPondBalance1Before).toString() == parseInt(appConfig.staking.rewardPerEpoch*(2.0/3*9/10*1/6+1.0/3*19/20*2/3)));
        // feed data again to the oracle
        console.log((await perfOracle.currentEpoch()), epochToFeed+1);
        await feedData(epochToFeed+1, [registeredCluster, registeredCluster1, registeredCluster2, registeredCluster3, registeredCluster4]);
        // do some delegations for both users to the cluster
        let MPondBalance2Before = await MPONDInstance.balanceOf(delegator2);
        await delegate(delegator2, [registeredCluster1, registeredCluster2], [1000000, 2], [0, 1]);
        let MPondBalance2After = await MPONDInstance.balanceOf(delegator2);
        console.log(MPondBalance2After.sub(MPondBalance2Before).toString(), appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5)));
        assert(MPondBalance2After.sub(MPondBalance2Before).toString() == parseInt(appConfig.staking.rewardPerEpoch*((2.0/3*9/10*5/6+1.0/3*19/20*1/3)+(7.0/12*9/10*5/7+5.0/12*19/20*1/5))));
    });

    async function delegate(delegator, clusters, amounts, tokenType) {
        let totalPond = 0;
        let totalMPond = 0;
        for(let i=0; i < amounts.length; i++) {
            if(tokenType[i] == 0) {
                totalPond += amounts[i];
            } else if(tokenType[i] == 1) {
                totalMPond += amounts[i];
            }     
        }

        if(totalMPond > 0) {
            await PONDInstance.transfer(delegator, totalPond);
            await PONDInstance.approve(stakeContract.address, totalPond, {
                from: delegator
            });
        }
        if(totalMPond > 0) {
            await MPONDInstance.transfer(delegator, totalMPond, {
                from: MPONDAccount
            });
            await MPONDInstance.approve(stakeContract.address, totalMPond, {
                from: delegator
            });
        }
        const stashes = [];
        for(let i=0; i < clusters.length; i++) {
            console.log(tokenType[i], amounts[i], clusters[i]);
            const receipt = await stakeContract.createStashAndDelegate(tokenType[i], amounts[i], clusters[i], {
                from: delegator
            });
            stashes.push(receipt.logs[0].args.stashId);
        }
        return stashes;
    }

    async function feedData(epoch, clusters) {
        const perf = [];
        for(let i=0; i < clusters.length; i++) {
            perf.push(100);
            // perf.push(parseInt(100*Math.random()));
        }

        await perfOracle.feed(epoch, clusters, perf, {
            from: oracleOwner
        });
        await perfOracle.closeFeed(epoch, {
            from: oracleOwner
        });
        await perfOracle.distributeRewards(epoch, clusters, {
            from: oracleOwner
        });
        await perfOracle.lockEpoch(epoch, {
            from: oracleOwner
        });
    }
});