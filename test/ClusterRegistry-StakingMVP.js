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
const { it } = require("ethers/wordlists");

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
        clusterRegistry = await ClusterRegistry.at(clusterRegistryAddress);

        const perfOracleAddress = await clusterRegistry.oracle();
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
});