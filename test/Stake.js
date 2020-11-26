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
        console.log("Cluster Registry deployed at", clusterRegistryAddress);
        clusterRegistry = await ClusterRegistry.at(clusterRegistryAddress);

        const perfOracleAddress = await clusterRegistry.oracle();
        console.log("Performance oracle deployed at", perfOracleAddress);
        perfOracle = await PerfOracle.at(perfOracleAddress);

        console.log((await perfOracle.owner()));

        await MPONDInstance.addWhiteListAddress(stakeContract.address, {
            from: admin
        })
        assert((await MPONDInstance.isWhiteListed(stakeContract.address), "StakeManager contract not whitelisted"));

        await MPONDInstance.addWhiteListAddress(perfOracle.address, {
            from: admin
        })
        assert((await MPONDInstance.isWhiteListed(perfOracle.address), "StakeManager contract not whitelisted"));

        await MPONDInstance.transfer(perfOracle.address, appConfig.staking.rewardPerEpoch*100, {
            from: MPONDAccount
        });
    });

    it("create POND stash", async () => {
        const amount = 12000000;

        await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));
        
        await PONDInstance.approve(stakeContract.address, amount);
        assert((await PONDInstance.allowance(accounts[0], stakeContract.address)) == amount);
        let tx = await stakeContract.createStash(0, amount - 100);
        console.log("stash created with id:", (tx.logs[0].args.stashId))

        await PONDInstance.approve(stakeContract.address, amount);
        await stakeContract.createStash(0, amount);

        await PONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash(0, amount + 1));

        await PONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash(0, 0));
    });

    it("create MPOND stash", async () => {
        const amount = 13000000;
        
        await MPONDInstance.transfer(accounts[0], amount*4, {
            from: MPONDAccount
        });

        await MPONDInstance.approve(stakeContract.address, amount);
        assert((await MPONDInstance.allowance(accounts[0], stakeContract.address)) == amount);
        let tx = await stakeContract.createStash(1, amount - 100);
        console.log("stash created with id:", (tx.logs[0].args.stashId))

        await MPONDInstance.approve(stakeContract.address, amount);
        await stakeContract.createStash(1, amount);

        await MPONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash(1, amount + 1));

        await MPONDInstance.approve(stakeContract.address, amount);
        await truffleAssert.reverts(stakeContract.createStash(1, 0));
    });

    it("Delegate POND stash", async () => {
        const amount = 1000000;
        // register cluster with cluster registry
        await clusterRegistry.register(5, registeredClusterRewardAddress, {
            from: registeredCluster
        });
        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        
        const stashId = await createStash(0, amount);
        
        await stakeContract.delegateStash(stashId, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));

        assert(clusterDelegation.POND - clusterInitialDelegation.POND == amount);
    });

    it("Delegate MPOND stash", async () => {
        const amount = 1500000;
        // register cluster with cluster registry
        await truffleAssert.reverts(clusterRegistry.register(5, registeredClusterRewardAddress, {
            from: registeredCluster
        }));
        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        
        const stashId = await createStash(1, amount);
        
        await stakeContract.delegateStash(stashId, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));

        assert(clusterDelegation.MPOND - clusterInitialDelegation.MPOND == amount);
    });

    it("Delegate random token to stash", async () => {
        const amount = 100000;
        await truffleAssert.fails(stakeContract.createStash(2, amount));
    });

    it("Delegate POND to invalid cluster", async () => {
        const amount = 900000;
        const stashId = await createStash(0, amount);
        await truffleAssert.reverts(stakeContract.delegateStash(stashId, unregisteredCluster));
    });

    it("Delegate MPOND to invalid cluster", async () => {
        const amount = 800000;
        const stashId = await createStash(1, amount);
        await truffleAssert.reverts(stakeContract.delegateStash(stashId, unregisteredCluster));
    });

    it("Delegate MPOND to deregistered cluster", async () => {
        await clusterRegistry.register(5, deregisteredClusterRewardAddress, {
            from: deregisteredCluster
        });
        await clusterRegistry.unregister({
            from: deregisteredCluster
        })

        const amount = 700000;
        const stashId = await createStash(1, amount);

        await truffleAssert.reverts(stakeContract.delegateStash(stashId, deregisteredCluster));
    });

    it("create and Delegate POND stash", async () => {
        const amount = 750000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));

        await stakeContract.createStashAndDelegate(0, amount, registeredCluster);

        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.POND - clusterInitialDelegation.POND == amount);
    });

    it("create and Delegate MPOND stash", async () => {
        const amount = 710000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));

        await stakeContract.createStashAndDelegate(1, amount, registeredCluster);

        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.MPOND - clusterInitialDelegation.MPOND == amount);
    });

    it("Undelegate POND stash", async () => {
        const amount = 730000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));

        const receipt = await stakeContract.createStashAndDelegate(0, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.POND - clusterInitialDelegation.POND == amount);
        const stashId = receipt.logs[0].args.stashId;

        const balanceBefore = await PONDInstance.balanceOf(accounts[0]);
        await stakeContract.undelegateStash(stashId);
        const balanceAfter = await PONDInstance.balanceOf(accounts[0]);
        assert(balanceBefore == balanceBefore);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.POND.toString() == clusterDelegationAfterUndelegation.POND.toString());
    });

    it("Undelegate MPOND stash", async () => {
        const amount = 710000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        const receipt = await stakeContract.createStashAndDelegate(1, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.MPOND - clusterInitialDelegation.MPOND == amount);
        const stashId = receipt.logs[0].args.stashId;

        const balanceBefore = await MPONDInstance.balanceOf(accounts[0]);
        await stakeContract.undelegateStash(stashId);
        const balanceAfter = await MPONDInstance.balanceOf(accounts[0]);
        assert(balanceBefore == balanceBefore);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.MPOND.toString() == clusterDelegationAfterUndelegation.MPOND.toString());
    });

    it("Undelegate POND stash that doesn't exists", async () => {
        const amount = 690000;
        await PONDInstance.approve(stakeContract.address, amount);
        const receipt = await stakeContract.createStashAndDelegate(0, amount, registeredCluster);
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
        const receipt = await stakeContract.createStashAndDelegate(1, amount, registeredCluster);
        const stashId = receipt.logs[0].args.stashId;
        await stakeContract.undelegateStash(stashId);

        await truffleAssert.reverts(stakeContract.undelegateStash(stashId));
    });

    it("Undelegate POND stash from a deregistered cluster", async () => {
        const amount = 670000;
        await PONDInstance.approve(stakeContract.address, amount);
        await clusterRegistry.register(5, deregisteredClusterRewardAddress, {
            from: deregisteredCluster
        });

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        const receipt = await stakeContract.createStashAndDelegate(0, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.POND - clusterInitialDelegation.POND == amount);
        const stashId = receipt.logs[0].args.stashId;

        await clusterRegistry.unregister({
            from: deregisteredCluster
        });

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.POND.toString() == clusterDelegationAfterUndelegation.POND.toString());
    });

    it("Undelegate MPOND stash from a deregistered cluster", async () => {
        const amount = 660000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);
        await clusterRegistry.register(5, deregisteredClusterRewardAddress, {
            from: deregisteredCluster
        });

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        const receipt = await stakeContract.createStashAndDelegate(1, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.MPOND - clusterInitialDelegation.MPOND == amount);
        const stashId = receipt.logs[0].args.stashId;
        
        await clusterRegistry.unregister({
            from: deregisteredCluster
        });

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.MPOND.toString() == clusterDelegationAfterUndelegation.MPOND.toString());
    });

    it("Withdraw POND before wait time", async () => {
        const amount = 650000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));

        const receipt = await stakeContract.createStashAndDelegate(0, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.POND - clusterInitialDelegation.POND == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.POND.toString() == clusterDelegationAfterUndelegation.POND.toString());

        await skipBlocks(appConfig.staking.undelegationWaitTime-2);

        await truffleAssert.reverts(stakeContract.withdrawStash(stashId));
    });

    it("Withdraw MPOND before wait time", async () => {
        const amount = 640000;
        await MPONDInstance.transfer(accounts[0], amount, {
            from: MPONDAccount
        });
        await MPONDInstance.approve(stakeContract.address, amount);
        
        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        const receipt = await stakeContract.createStashAndDelegate(1, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.MPOND - clusterInitialDelegation.MPOND == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.MPOND.toString() == clusterDelegationAfterUndelegation.MPOND.toString());

        await skipBlocks(appConfig.staking.undelegationWaitTime-2);

        await truffleAssert.reverts(stakeContract.withdrawStash(stashId));
    });

    it("Withdraw POND after wait time", async () => {
        const amount = 630000;
        await PONDInstance.approve(stakeContract.address, amount);

        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));

        const receipt = await stakeContract.createStashAndDelegate(0, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.POND - clusterInitialDelegation.POND == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.POND.toString() == clusterDelegationAfterUndelegation.POND.toString());

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
        
        const clusterInitialDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        const receipt = await stakeContract.createStashAndDelegate(1, amount, registeredCluster);
        const clusterDelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterDelegation.MPOND - clusterInitialDelegation.MPOND == amount);
        const stashId = receipt.logs[0].args.stashId;

        await stakeContract.undelegateStash(stashId);
        const clusterDelegationAfterUndelegation = (await clusterRegistry.getClusterDelegation(registeredCluster));
        assert(clusterInitialDelegation.MPOND.toString() == clusterDelegationAfterUndelegation.MPOND.toString());

        await skipBlocks(appConfig.staking.undelegationWaitTime-1);

        const balanceBefore = await MPONDInstance.balanceOf(accounts[0]);
        await stakeContract.withdrawStash(stashId);
        const balanceAfter = await MPONDInstance.balanceOf(accounts[0]);
        assert(balanceAfter - balanceBefore == amount)
    });

    async function createStash(tokenType, amount) {
        if(tokenType == 1) {
            await MPONDInstance.transfer(accounts[0], amount, {
                from: MPONDAccount
            });
            await MPONDInstance.approve(stakeContract.address, amount);
        } else if(tokenType == 0) {
            await PONDInstance.approve(stakeContract.address, amount);
        }
        const tx = await stakeContract.createStash(tokenType, amount);
        return (tx.logs[0].args.stashId);
    }

    async function skipBlocks(noOfBlocks) {
        for(let i=0; i < noOfBlocks; i++) {
            await PONDInstance.transfer(accounts[0], 0);
        }
    }
});