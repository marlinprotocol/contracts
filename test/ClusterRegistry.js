const truffleAssert = require("truffle-assertions");

const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");

contract("ClusterRegistry contract", async function(accounts) {
    let clusterRegistry;

    const proxyAdmin = accounts[1];
    const admin = accounts[2];
    const rewardAddress = accounts[3];
    const clientKey = accounts[4];

    const registeredCluster = accounts[5];
    const registeredCluster1 = accounts[9];
    const unregisteredCluster = accounts[6];

    const updatedRewardAddress = accounts[7];
    const updatedClientKey = accounts[8];

    it("Deploy cluster registry", async () => {
        const clusterRegistryDeployment = await ClusterRegistry.new();
        const clusterRegistryProxy = await ClusterRegistryProxy.new(clusterRegistryDeployment.address, proxyAdmin);
        clusterRegistry = await ClusterRegistry.at(clusterRegistryProxy.address);

        const selectors = [web3.utils.keccak256("COMMISSION_LOCK"), web3.utils.keccak256("SWITCH_NETWORK_LOCK"), web3.utils.keccak256("UNREGISTER_LOCK")];
        const lockWaitTimes = [20, 21, 22];

        await clusterRegistry.initialize(selectors, lockWaitTimes, admin);
        assert((await clusterRegistry.owner.call()).toString() == admin, "Admin not set correctly");
        assert((await clusterRegistry.lockWaitTime.call(selectors[0])).toString() == lockWaitTimes[0], "Lock times not set correctly");
    });

    it("Register cluster", async () => {
        await truffleAssert.reverts(clusterRegistry.register(web3.utils.keccak256("DOT"), 101, rewardAddress, clientKey, {
            from: registeredCluster
        }));
        await clusterRegistry.register(web3.utils.keccak256("DOT"), 7, rewardAddress, clientKey, {
            from: registeredCluster
        });
        await truffleAssert.reverts(clusterRegistry.register(web3.utils.keccak256("DOT"), 7, rewardAddress, clientKey, {
            from: registeredCluster
        }));
        const clusterData = await clusterRegistry.getCluster.call(registeredCluster);
        assert(clusterData.commission == 7, "Commission not correctly set");
        assert(clusterData.networkId == web3.utils.keccak256("DOT"), "NetworkId not correctly set");
        assert(clusterData.rewardAddress == rewardAddress, "Reward address not correctly set");
        assert(clusterData.isValidCluster, "Cluster not registered correctly");
    });

    it("Register cluster with same client key twice", async () => {
        await truffleAssert.reverts(clusterRegistry.register(web3.utils.keccak256("DOT"), 7, rewardAddress, clientKey, {
            from: registeredCluster1
        }), "CR:R - Client key is already used");
    });

    it("update commission", async () => {
        await truffleAssert.reverts(clusterRegistry.updateCommission(15, {
            from: unregisteredCluster
        }));
        const prevCommission = parseInt((await clusterRegistry.getCommission.call(registeredCluster)).toString());
        await clusterRegistry.updateCommission(15, {
            from: registeredCluster
        });
        const afterUpdateCommission = parseInt((await clusterRegistry.getCommission.call(registeredCluster)).toString());
        assert(prevCommission == afterUpdateCommission, "Commission shouldn't be updated instantly");
        await skipBlocks(20);
        const justBeforeUpdateCommission = parseInt((await clusterRegistry.getCommission.call(registeredCluster)).toString());
        assert(justBeforeUpdateCommission == prevCommission, "Commission shouldn't be updated before wait time");
        await skipBlocks(1);
        const afterWaitCommission = parseInt((await clusterRegistry.getCommission.call(registeredCluster)).toString());
        assert(afterWaitCommission == 15, "Commission not getting updated after wait time");
    });

    it("switch network", async () => {
        await truffleAssert.reverts(clusterRegistry.switchNetwork(web3.utils.keccak256("NEAR"), {
            from: unregisteredCluster
        }));
        const prevNetwork = parseInt((await clusterRegistry.getNetwork.call(registeredCluster)).toString());
        await clusterRegistry.switchNetwork(web3.utils.keccak256("NEAR"), {
            from: registeredCluster
        });
        const networkAfterSwitch = parseInt((await clusterRegistry.getNetwork.call(registeredCluster)).toString());
        assert(prevNetwork == networkAfterSwitch, "Network shouldn't be switched instantly");
        await skipBlocks(21);
        const justBeforeSwitchNetwork = parseInt((await clusterRegistry.getNetwork.call(registeredCluster)).toString());
        assert(justBeforeSwitchNetwork == prevNetwork, "Network shouldn't be switched before wait time");
        await skipBlocks(1);
        const afterSwitchNetwork = parseInt((await clusterRegistry.getNetwork.call(registeredCluster)).toString());
        assert(afterSwitchNetwork == web3.utils.keccak256("NEAR"), "Network not getting switched after wait time");
    });

    it("update reward address", async () => {
        await truffleAssert.reverts(clusterRegistry.updateRewardAddress(updatedRewardAddress, {
            from: unregisteredCluster
        }));
        const prevRewardAddress = await clusterRegistry.getRewardAddress.call(registeredCluster);
        await clusterRegistry.updateRewardAddress(updatedRewardAddress, {
            from: registeredCluster
        });
        const afterUpdateAddress = await clusterRegistry.getRewardAddress.call(registeredCluster);
        assert(prevRewardAddress != afterUpdateAddress, "Reward address didn't change");
        assert(afterUpdateAddress == updatedRewardAddress, "Reward address updated to new address");
    });

    it("update client key", async () => {
        await truffleAssert.reverts(clusterRegistry.updateClientKey(updatedClientKey, {
            from: unregisteredCluster
        }));
        const prevClientKey = await clusterRegistry.getClientKey.call(registeredCluster);
        await clusterRegistry.updateClientKey(updatedClientKey, {
            from: registeredCluster
        });
        const afterClientKey = await clusterRegistry.getClientKey.call(registeredCluster);
        assert(prevClientKey != afterClientKey, "Client key didn't change");
        assert(afterClientKey == updatedClientKey, "Client Key updated to new one");
    });

    it("update cluster params", async () => {
        await truffleAssert.reverts(clusterRegistry.updateCluster(7, web3.utils.keccak256("DOT"), rewardAddress, clientKey, {
            from: unregisteredCluster
        }));
        const clusterData = await clusterRegistry.getCluster.call(registeredCluster);
        await clusterRegistry.updateCluster(7, web3.utils.keccak256("DOT"), rewardAddress, clientKey, {
            from: registeredCluster
        });
        const clusterDataAfterUpdate = await clusterRegistry.getCluster.call(registeredCluster);
        assert(clusterData.clientKey != clusterDataAfterUpdate.clientKey, "Client key didn't change");
        assert(clusterDataAfterUpdate.clientKey == clientKey, "Client Key updated to new one");
        assert(clusterData.rewardAddress != clusterDataAfterUpdate.rewardAddress, "reward address didn't change");
        assert(clusterDataAfterUpdate.rewardAddress == rewardAddress, "Reward address updated to new one");
        assert(clusterData.commission.toString() == clusterDataAfterUpdate.commission.toString(), "Commission shouldn't change instantly");
        assert(clusterData.networkId == clusterDataAfterUpdate.networkId, "Network shouldn't change instantly");
        await skipBlocks(20);
        const justBeforeUpdateCommission = parseInt((await clusterRegistry.getCommission.call(registeredCluster)).toString());
        assert(justBeforeUpdateCommission == parseInt(clusterData.commission.toString()), "Commission shouldn't be updated before wait time");
        await skipBlocks(1);
        const afterWaitCommission = parseInt((await clusterRegistry.getCommission.call(registeredCluster)).toString());
        assert(afterWaitCommission == 7, "Commission not getting updated after wait time");
        const justBeforeSwitchNetwork = parseInt((await clusterRegistry.getNetwork.call(registeredCluster)).toString());
        assert(justBeforeSwitchNetwork == clusterData.networkId, "Network shouldn't be switched before wait time");
        await skipBlocks(1);
        const afterSwitchNetwork = parseInt((await clusterRegistry.getNetwork.call(registeredCluster)).toString());
        assert(afterSwitchNetwork == web3.utils.keccak256("DOT"), "Network not getting switched after wait time");
    });
    
    it("Unregister cluster", async () => {
        await truffleAssert.reverts(clusterRegistry.unregister({
            from: unregisteredCluster
        }));
        assert((await clusterRegistry.isClusterValid.call(registeredCluster)), "Cluster not registered");
        await clusterRegistry.unregister({
            from: registeredCluster
        });
        assert((await clusterRegistry.isClusterValid.call(registeredCluster)), "Cluster shouldn't be unregistered instantly");
        await skipBlocks(21);
        assert((await clusterRegistry.isClusterValid.call(registeredCluster)), "Cluster shouldn't be unregistered before wait time");
        await skipBlocks(2);
        assert(!(await clusterRegistry.isClusterValid.call(registeredCluster)), "Cluster should get unregistered after wait time");
    });

    async function skipBlocks(blocks) {
        for(let i=0; i < blocks; i++) {
            await clusterRegistry.getNetwork(unregisteredCluster);
        }
    }
});