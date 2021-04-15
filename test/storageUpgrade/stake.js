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

contract("Stake contract - testing storage upgrade", async function(accounts) {

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

        await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));

        await PONDInstance.transfer(perfOracle.address, appConfig.staking.rewardPerEpoch*100);

        await stakeContract.updateLockWaitTime(web3.utils.keccak256("REDELEGATION_LOCK"), 5, {
            from: stakeManagerOwner
        });
        assert((await stakeContract.lockWaitTime(web3.utils.keccak256("REDELEGATION_LOCK"))) == 5, "Waittime not set correctly");
    });

    it("",() => {

    });
});