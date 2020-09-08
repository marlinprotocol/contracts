// Initialize
//Producer.sol
//ClusterRegistry.sol
//LuckManager.sol
//Pot.sol
//FundManager.sol
//Verifier_Producer.sol

const appConfig = require("../app-config");

const LINToken = artifacts.require("TokenLogic.sol");
const LINProxy = artifacts.require("TokenProxy.sol");

const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");

const Luck = artifacts.require("LuckManager.sol");
const LuckProxy = artifacts.require("LuckManagerProxy.sol");

const Producer = artifacts.require("Producer.sol");
const ProducerProxy = artifacts.require("ProducerProxy.sol");

const ProducerVerifier  = artifacts.require("VerifierProducer.sol");
const ProducerVerifierProxy  = artifacts.require("Verifier_ProducerProxy.sol");

const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");

const Fund = artifacts.require("FundManager.sol");
const FundProxy = artifacts.require("FundManagerProxy.sol");

const defaultCluster = artifacts.require("ClusterDefault.sol");
const defaultClusterProxy = artifacts.require("ClusterDefaultProxy.sol");

contract.skip("Producer Verifier", (accounts) => {
    let LINInstance;
    let PotInstance;
    let LuckInstance;
    let FundInstance;
    let ProducerInstance;
    let DefaultClusterInstance;
    let ClusterRegistryInstance;
    let VerifierInstance;

    it("deploy all contracts", async () => {
        let LINDeployment = await LINToken.new();
        let LINProxyInstance = await LINProxy.new(LINDeployment.address);
        LINInstance = await LINToken.at(LINProxyInstance.address);

        let PotDeployment = await Pot.new();
        let PotProxyInstance = await PotProxy.new(PotDeployment.address);
        PotInstance = await Pot.at(PotProxyInstance.address);

        let luckDeployment = await Luck.new();
        let luckProxyInstance = await LuckProxy.new(luckDeployment.address);
        LuckInstance = await Luck.at(luckProxyInstance.address);

        let VerifierDeployment = await ProducerVerifier.new();
        let VerifierProxyInstance = await ProducerVerifierProxy.new(VerifierDeployment.address);
        VerifierInstance = await ProducerVerifier.at(VerifierProxyInstance.address);

        let ClusterRegistryDeployment = await ClusterRegistry.new();
        let ClusterRegistryProxyInstance = await ClusterRegistryProxy.new(ClusterRegistryDeployment.address);
        ClusterRegistryInstance = await ClusterRegistry.at(ClusterRegistryProxyInstance.address);

        let ProducerDeployment = await Producer.new();
        let ProducerProxyInstance = await ProducerProxy.new(ProducerDeployment.address);
        ProducerInstance = await Producer.at(ProducerProxyInstance.address);

        let fundDeployment = await Fund.new();
        let fundProxyInstance = await FundProxy.new(fundDeployment.address);
        FundInstance = await Fund.at(fundProxyInstance.address);

        let defaultClusterDeployment = await defaultCluster.new();
        let defaultClusterProxyInstance = await defaultClusterProxy.new(defaultClusterDeployment.address);
        DefaultClusterInstance = await defaultCluster.at(defaultClusterProxyInstance.address);
    });

    it("Initialize all contracts", async () => {
        await LINInstance.initialize(
            appConfig.LINData.name,
            appConfig.LINData.symbol,
            appConfig.LINData.decimals
        );
        let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
        let firstEpochStartBlock;
        let EthBlocksPerEpoch = appConfig.EthBlockPerEpoch;
        await web3.eth.getBlockNumber((err, blockNo) => {
            firstEpochStartBlock = blockNo + appConfig.potFirstEpochStartBlockDelay;
        });
        let roles = [];
        let distribution = [];
        let claimWaitEpochs = [];
        for (let role in appConfig.roleParams) {
            let currentRole = appConfig.roleParams[role];
            roles.push(currentRole.roleId);
            distribution.push(currentRole.allocation);
            claimWaitEpochs.push(currentRole.epochsToWaitForClaims);
        }
        await PotInstance.initialize(
            governanceProxy,
            firstEpochStartBlock,
            EthBlocksPerEpoch,
            roles,
            distribution,
            [appConfig.LINData.id],
            [LINInstance.address],
            claimWaitEpochs
        );
    
        await FundInstance.initialize(LINInstance.address, governanceProxy, appConfig.LINData.id);

        let {producer, receiver} = appConfig.roleParams;
        let luckRoleParams = [producer, receiver].map(function (entity) {
        return [
                entity.luckTrailingEpochs,
                entity.targetClaims,
                entity.averaginingEpochs,
                entity.startingEpoch,
                entity.varianceTolerance,
                entity.changeSteps,
                entity.initialLuck,
            ];
        });

        await LuckInstance.initialize(
            governanceProxy,
            PotInstance.address,
            [producer.roleId, receiver.roleId],
            luckRoleParams
        );

        await ProducerInstance.initialize();

        await DefaultClusterInstance.initialize(accounts[0]);

        await ClusterRegistryInstance.initialize(
            DefaultClusterInstance.address,
            appConfig.clusterExitWaitEpochs,
            appConfig.clusterMinStake,
            LINInstance.address,
            PotInstance.address,
            governanceProxy
        );

        await VerifierInstance.initialize(
            ProducerInstance.address,
            ClusterRegistryInstance.address,
            LuckInstance.address,
            PotInstance.address,
            FundInstance.address,
            appConfig.roleParams.producer.roleId,
            appConfig.LINData.id
        );
    })

    it("Setup flow for producer to claim ticket", async () => {
        let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
        // Mint some tokens
        await LINInstance.mint(accounts[0], 1000000);
        // Allocate tokens to Fund
        await LINInstance.transfer(FundInstance.address, 100000);
        // Create Pot From fund
        let currentEpoch = parseInt(
            await PotInstance.getEpoch(await web3.eth.getBlockNumber()),
            "hex"
        );
        await FundInstance.createFund(
            PotInstance.address,
            1000,
            currentEpoch + 50,
            currentEpoch,
            {from: governanceProxy}
          );
        // register producer
        // ProducerInstance
    });
})