const LINToken = artifacts.require("TokenLogic.sol");
const LINProxy = artifacts.require("TokenProxy.sol");

const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");
const utils = require("web3-utils");
const truffleAssert = require('truffle-assertions');

const appConfig = require("../app-config");

contract("Reward Pot", async function (accounts) {    
    let LINInstance;
    let PotInstance;
    let localConfig;

    it("Deploy all contracts", async () => {
        await LINProxy.deployed()
        .then(async (instance) => {
            LINInstance = await LINToken.at(instance.address);
            return LINInstance;
        });
        await PotProxy.deployed()
        .then(async (instance) => {
            PotInstance = await Pot.at(instance.address);
            return PotInstance;
        });
    })

    it("Initialize Pot", async () => {
        await LINInstance.initialize(appConfig.LINData.name, appConfig.LINData.symbol, appConfig.LINData.decimals);
        await truffleAssert.reverts(LINInstance.initialize(appConfig.LINData.name, appConfig.LINData.symbol, appConfig.LINData.decimals));
        console.log("LIN contract Initialized");
        let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
        let firstEpochStartBlock;
        let EthBlocksPerEpoch = appConfig.EthBlockPerEpoch;
        await web3.eth.getBlockNumber((err, blockNo) => {
            firstEpochStartBlock = blockNo + appConfig.potFirstEpochStartBlockDelay;
        });
        let roles = [];
        let distribution = [];
        let  claimWaitEpochs = [];
        for(let role in appConfig.roleParams) {
            let currentRole = appConfig.roleParams[role];
            roles.push(currentRole.roleId);
            distribution.push(currentRole.allocation);
            claimWaitEpochs.push(currentRole.epochsToWaitForClaims);
        }
        localConfig = {
            firstEpochStartBlock,
            roles
        };
        await PotInstance.initialize(governanceProxy, LINInstance.address, firstEpochStartBlock, EthBlocksPerEpoch, roles, distribution, claimWaitEpochs);
        await truffleAssert.reverts(PotInstance.initialize(governanceProxy, LINInstance.address, firstEpochStartBlock, EthBlocksPerEpoch, roles, distribution, claimWaitEpochs));
    })

    it("check initilization variables", async () => {
        assert(localConfig.firstEpochStartBlock == await PotInstance.firstEpochStartBlock(), "firstEpochStartBlock wasn't set");
        assert(appConfig.EthBlockPerEpoch == await PotInstance.EthBlocksPerEpoch(), "EthBlocksPerEpoch wasn't set");
        let {role, roleIndex} = getRole(-1);
        let roleId = await PotInstance.ids(role.roleId);
        assert(localConfig.roles[roleIndex] == roleId, `Role Ids not set, for index ${roleIndex} expected: ${localConfig.roles[roleIndex]}, got: ${roleId}`);
        let allocation = await PotInstance.potAllocation(localConfig.roles[roleIndex]);
        assert(role.allocation == allocation, 
            `Pot allocation failed, for  ${localConfig.roles[roleIndex]} allocation expected: ${role.allocation}, got: ${allocation}`);
        let epochsToWaitForClaims = await PotInstance.epochsToWaitForClaims(localConfig.roles[roleIndex]);
        assert(role.epochsToWaitForClaims == epochsToWaitForClaims, 
            `Epochs to wait for claims not set, for ${localConfig.roles[roleIndex]} expected: ${role.epochsToWaitForClaims}, got: ${epochsToWaitForClaims}`);
    });

    it("Governance decision implemented", async () => {
        let tempVerfierAddress = accounts[18];
        // add verifier
        await PotInstance.addVerifier(tempVerfierAddress, {from: accounts[appConfig.governanceProxyAccountIndex]});
        assert(await PotInstance.verifiers(tempVerfierAddress) == true, "Governance unable to add verifier");

        await truffleAssert.reverts(PotInstance.removeVerifier(tempVerfierAddress, {from: accounts[10]}), "Pot: Function can only be invoked by Governance Enforcer");
        assert(await PotInstance.verifiers(tempVerfierAddress) == true, "Random account is able to remove verifiers");
        // remove verifier
        await PotInstance.removeVerifier(tempVerfierAddress, {from: accounts[appConfig.governanceProxyAccountIndex]});
        assert(await PotInstance.verifiers(tempVerfierAddress) == false, "Governance unable to remove verifier");

        await truffleAssert.reverts(PotInstance.addVerifier(tempVerfierAddress, {from: accounts[10]}), "Pot: Function can only be invoked by Governance Enforcer");
        assert(await PotInstance.verifiers(tempVerfierAddress) == false, "Random account is able to add verifiers");
        // changeEpochsToWaitForClaims
        await PotInstance.changeEpochsToWaitForClaims(1217, "0x0", {from: accounts[appConfig.governanceProxyAccountIndex]});
        assert(await PotInstance.epochsToWaitForClaims("0x0") == 1217, "Governance unable to change epochsToWaitForClaims");

        await truffleAssert.reverts(PotInstance.changeEpochsToWaitForClaims(1000, "0x0", {from: accounts[10]}), "Pot: Function can only be invoked by Governance Enforcer");
        assert(await PotInstance.epochsToWaitForClaims("0x0") != 1000, "Random account is able to change epochsToWaitForClaims");
        // changeEthBlocksPerEpoch
        await PotInstance.changeEthBlocksPerEpoch(142, {from: accounts[appConfig.governanceProxyAccountIndex]});
        assert(await PotInstance.EthBlocksPerEpoch() == 142, "Governance unable to change EthBlocksPerEpoch");

        await truffleAssert.reverts(PotInstance.changeEthBlocksPerEpoch(172, {from: accounts[10]}), "Pot: Function can only be invoked by Governance Enforcer");
        assert(await PotInstance.EthBlocksPerEpoch() != 172, "Random account is able to change EthBlocksPerEpoch");
        // allocatePot
        await PotInstance.allocatePot(["0x3", "0x4"], [20, 80], {from: accounts[appConfig.governanceProxyAccountIndex]});
        assert(await PotInstance.potAllocation("0x4") == 80, "Governance unable to change allocations");
        let roleData = getRole(0);
        assert(await PotInstance.potAllocation(roleData.role.roleId) == 0, "Previous allocation are still present");

        await truffleAssert.reverts(PotInstance.allocatePot(["0x5", "0x6"], [61, 39], {from: accounts[10]}), "Pot: Function can only be invoked by Governance Enforcer");
        assert(await PotInstance.potAllocation("0x5") != 61, "Random account is able to change allocation");
    });

    it("check Epoch calculations", () => {

    });

    it("check adding funds to pot", () => {

    });

    it("check ticket claiming by verifier contracts", () => {

    });

    it("check fee reward claims by winners", () => {

    });

    function getRole(roleIndex) {
        if(roleIndex < 0 || roleIndex >= localConfig.roles.length) {
            roleIndex = parseInt(Math.random()*localConfig.roles.length);
        }
        if(roleIndex == localConfig.roles.length) {
            roleIndex = 0;
        }
        console.log(Object.keys(appConfig.roleParams)[roleIndex]);
        let role = appConfig.roleParams[Object.keys(appConfig.roleParams)[roleIndex]];
        return {role, roleIndex};
    }

});