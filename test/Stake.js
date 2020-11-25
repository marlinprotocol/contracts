const PONDToken = artifacts.require("TokenLogic.sol");
const PONDProxy = artifacts.require("TokenProxy.sol");

const MPONDToken = artifacts.require("MPondLogic.sol");
const MPONDProxy = artifacts.require("MPondProxy.sol");

const Stake = artifacts.require("Stake.sol");

const { it } = require("ethers/wordlists");
const appConfig = require("../app-config");

Contract("Stake contract", async function(accounts) {

    let PONDInstance;
    let MPONDInstance;
    let stakeContract;

    it("deploy stake contract and initialize tokens", async () => {
        const PONDDeployment = await PONDToken.new();
        const pondProxyInstance = await PONDProxy.new(PONDDeployment.address);
        PONDInstance = await PONDToken.at(pondProxyInstance.address);

        const MPONDDeployment = await MPONDToken.new();
        const MpondProxyInstance = await MPONDProxy.new(MPONDDeployment.address);
        MPONDInstance = await MPONDToken.at(MpondProxyInstance.address);

        await PONDInstance.initalize(
            appConfig.PONDData.name,
            appConfig.PONDData.symbol,
            appConfig.PONDData.decimals
        );
        await MPONDInstance.initalize(
            appConfig.MPONDData.name,
            appConfig.MPONDData.symbol,
            appConfig.MPONDData.decimals
        );

        stakeContract = Stake.new(PONDInstance.address, MPONDInstance.address, appConfig.staking.undelegationWaitTime);
    });

    it("create POND stash", async () => {
        
    });

    it("create MPOND stash", async () => {
        const 
    });

    it("Delegate POND stash", async () => {
        const 
    });

    it("Delegate MPOND stash", async () => {
        const 
    });

    it("Delegate random token to stash", async () => {

    });

    it("Delegate POND to invalid cluster", async () => {

    });

    it("Delegate MPOND to invalid cluster", async () => {

    });

    it("Delegate MPOND to deregistered cluster", async () => {

    });

    it("create and Delegate POND stash", async () => {
        const 
    });

    it("create and Delegate MPOND stash", async () => {
        const 
    });

    it("Undelegate POND stash", async () => {
        
    });

    it("Undelegate MPOND stash", async () => {
        
    });

    it("Undelegate POND stash that doesn't exists", async () => {
        
    });

    it("Undelegate MPOND stash that doesn't exists", async () => {
        
    });

    it("Undelegate POND stash from a deregistered cluster", async () => {
        
    });

    it("Withdraw POND before wait time", async () => {

    });

    it("Withdraw MPOND before wait time", async () => {

    });

    it("Withdraw POND after wait time", async () => {

    });

    it("Withdraw MPOND after wait time", async () => {

    });
});