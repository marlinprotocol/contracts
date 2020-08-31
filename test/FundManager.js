// Token
const LINProxy = artifacts.require("TokenProxy.sol");
const LINToken = artifacts.require("TokenLogic.sol");

const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");

const Fund = artifacts.require("FundManager.sol");
const FundProxy = artifacts.require("FundManagerProxy.sol");

const appConfig = require("../app-config");
const truffleAssertions = require("truffle-assertions");
const { BigNumber } = require("ethers/utils");
const { utils } = require("ethers");

contract("Fund Manager", function (accounts) {
  let LINInstance;
  let FundInstance;
  let PotInstance;
  it("deploy all contracts", async function () {
    let LINDeployment = await LINToken.new();
    let proxyInstance = await LINProxy.new(LINDeployment.address);
    LINInstance = await LINToken.at(proxyInstance.address);
    let potDeployment = await Pot.new();
    let potProxyInstance = await PotProxy.new(potDeployment.address);
    PotInstance = await Pot.at(potProxyInstance.address);
    let fundDeployment = await Fund.new();
    let fundProxyInstance = await FundProxy.new(fundDeployment.address);
    FundInstance = await Fund.at(fundProxyInstance.address);
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

    localConfig = {
      firstEpochStartBlock,
      roles,
    };
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

    await FundInstance.initialize(
      LINInstance.address,
      governanceProxy
    );
  });

  it("verify all initilized variables", async () => {
    // check MAX_INT
    // check LIN contraact
    // check governance  contract
  });

  it("update LIN allocation", async () => {
    // give allocation of LIN to fund
    await LINInstance.mint(accounts[0], 1000000000, {from: accounts[0]})
    await LINInstance.transfer(FundInstance.address, 100, {from: accounts[0]});
    await FundInstance.updateLINAllocation();
    assert(await FundInstance.fundBalance() == 100, "Fund not allocated");
    assert(await FundInstance.unallocatedBalance() == 100, "Unallocated Balance not updated");
    // increase the allocation and check if unallocated balance and fund balance is getting updated
    await LINInstance.transfer(FundInstance.address, 100000, {from: accounts[0]});
    await FundInstance.updateLINAllocation();
    assert(await FundInstance.fundBalance() == 100100, "Fund not allocated");
    assert(await FundInstance.unallocatedBalance() == 100100, "Unallocated Balance not updated");
    await truffleAssertions.reverts(FundInstance.updateLINAllocation(), "Fund Balance is as per the current balance");
  });

  it("Check if fund creation works", async () => {
    let originalEpoch = parseInt(await PotInstance.getEpoch(
      await web3.eth.getBlockNumber()
    ), "hex");
    let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
    // create a fund without governance
    await truffleAssertions.reverts(FundInstance.createFund(PotInstance.address, 1000, originalEpoch+1, originalEpoch), "Function can only be invoked by Governance Enforcer");
    // create a fund with end epoch equal to startepoch(lastDrawnEpoch)
    await truffleAssertions.reverts(FundInstance.createFund(PotInstance.address, 1000, originalEpoch+1, originalEpoch+1, {from: governanceProxy}), "Fund should start before endEpoch");
    // create a fund with governance but with more money than the unallocated balance
    let fundBalance = await FundInstance.fundBalance();
    let unallocatedBalance = await FundInstance.unallocatedBalance();
    console.log(parseInt(fundBalance, "hex"), parseInt(unallocatedBalance, "hex"));
    await truffleAssertions.reverts(FundInstance.createFund(PotInstance.address, 1002, originalEpoch+100, originalEpoch, {from: governanceProxy}), "Fund not sufficient to allocate");
    // create a fund with governance but with exactly equal money than the unallocated balance
    await FundInstance.createFund(PotInstance.address, 1001, originalEpoch+100, originalEpoch, {from: governanceProxy});
    // check if inflation, endEpoch, lastDrawnEpoch and pot are correctly set
    let fundDetails = await FundInstance.funds(PotInstance.address);
    assert(parseInt(fundDetails.inflationPerEpoch) == 1001 && 
      parseInt(fundDetails.endEpoch) == originalEpoch+100 && 
      parseInt(fundDetails.lastDrawnEpoch) == originalEpoch && 
      fundDetails.pot == PotInstance.address &&
      parseInt(fundDetails.nextInflation) == 0 &&
      parseInt(fundDetails.unclaimedInflationChangewithdrawal) == 0 ,
      "Fund Details not set correctly");
  });

  it("Update Fund Inflation", async () => {
    let originalEpoch = parseInt(await PotInstance.getEpoch(
      await web3.eth.getBlockNumber()
    ), "hex");
    let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
    // try updating inflation without governance
    await truffleAssertions.reverts(FundInstance.updateFundInflation(100, originalEpoch+10, PotInstance.address), "Function can only be invoked by Governance Enforcer");
    // try to update inflation of past and current epoch
    await truffleAssertions.reverts(FundInstance.updateFundInflation(100, originalEpoch, PotInstance.address, {from: governanceProxy}), "Can't update inflation of previous epochs");
    await truffleAssertions.reverts(FundInstance.updateFundInflation(100, originalEpoch+3, PotInstance.address, {from: governanceProxy}), "Can't update inflation of previous epochs");
    // try to update inflation for a pot that doesn't exist
    await truffleAssertions.reverts(
      FundInstance.updateFundInflation(100, originalEpoch+25, accounts[15], {from: governanceProxy})
    );
    // update inflation before the fund ends and with higher inflation such that unallocated balance is not sufficient
    await truffleAssertions.reverts(FundInstance.updateFundInflation(1002, originalEpoch+15, PotInstance.address, {from: governanceProxy}));
    // update inflation before fund ends and with lower inflation
    let unallocatedBalancePrev = await FundInstance.unallocatedBalance();
    await FundInstance.updateFundInflation(100, originalEpoch+25, PotInstance.address, {from: governanceProxy});
    let unallocatedBalanceCurrent = await FundInstance.unallocatedBalance();
    console.log(parseInt(unallocatedBalancePrev), parseInt(unallocatedBalanceCurrent));
    //todo:add assert for diff in unallocated balance 
    // update inflation before the fund ends and with higher inflation such that unallocated balance is sufficient
    unallocatedBalancePrev = await FundInstance.unallocatedBalance();
    await FundInstance.updateFundInflation(1000, originalEpoch+25, PotInstance.address, {from: governanceProxy});
    unallocatedBalanceCurrent = await FundInstance.unallocatedBalance();
    console.log(parseInt(unallocatedBalancePrev), parseInt(unallocatedBalanceCurrent));
    //todo:add assert for diff in unallocated balance 
    // update inflation before a new inflation took effect
    unallocatedBalancePrev = await FundInstance.unallocatedBalance();
    await FundInstance.updateFundInflation(900, originalEpoch+25, PotInstance.address, {from: governanceProxy});
    unallocatedBalanceCurrent = await FundInstance.unallocatedBalance();
    console.log(parseInt(unallocatedBalancePrev), parseInt(unallocatedBalanceCurrent));
    //todo:add assert for diff in unallocated balance 
    let fundDetails = await FundInstance.funds(PotInstance.address);
    assert(parseInt(fundDetails.nextInflation) == 900, "Next inflation isn't updated");
    // dummy tx to increase the epoch
    for(let i=0; i < 5; i++) {
      await LINInstance.mint(accounts[0], 1, {from: accounts[0]});
    }
    // update inflation after a new inflation took effect but no one draw from pot, so wasn't updated
    await FundInstance.updateFundInflation(1001, originalEpoch+100, PotInstance.address, {from: governanceProxy});
  });

  it("Update End epoch of fund", async () => {
    let currentEpoch = parseInt(await PotInstance.getEpoch(
      await web3.eth.getBlockNumber()
    ), "hex");
    let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
    await truffleAssertions.reverts(FundInstance.updateEndEpoch(currentEpoch+100, PotInstance.address, {from: governanceProxy}));
    await before();
    let originalEpoch = parseInt(await PotInstance.getEpoch(
      await web3.eth.getBlockNumber()
    ), "hex");
    await FundInstance.createFund(PotInstance.address, 800, originalEpoch+100, originalEpoch, {from: governanceProxy});
    // try updating end epoch without governance
    await truffleAssertions.reverts(FundInstance.updateEndEpoch(originalEpoch+2, PotInstance.address), "Function can only be invoked by Governance Enforcer");
    // try updating inflation for a pot that doesn't exist
    await truffleAssertions.reverts(FundInstance.updateEndEpoch(originalEpoch+2, accounts[15], {from: governanceProxy}));
    // try updating end epoch in the past or current epoch
    await truffleAssertions.reverts(FundInstance.updateEndEpoch(originalEpoch, PotInstance.address, {from: governanceProxy}), "Can't change endEpoch to previous or ongoing epochs");
    await truffleAssertions.reverts(FundInstance.updateEndEpoch(originalEpoch+5, PotInstance.address, {from: governanceProxy}), "Can't change endEpoch to previous or ongoing epochs");
    // update end epoch if it is later than the current end epoch and there is no inflation update set
    let unallocatedBalancePrev = await FundInstance.unallocatedBalance();
    await FundInstance.updateEndEpoch(originalEpoch+105, PotInstance.address, {from: governanceProxy})
    let unallocatedBalanceCurrent = await FundInstance.unallocatedBalance();
    assert(unallocatedBalancePrev - unallocatedBalanceCurrent == 4000);
    // update end epoch if it is later than the current end epoch and there is inflation update set
    await FundInstance.updateFundInflation(1001, currentEpoch+50, PotInstance.address, {from: governanceProxy});
    unallocatedBalancePrev = await FundInstance.unallocatedBalance();
    await FundInstance.updateEndEpoch(originalEpoch+110, PotInstance.address, {from: governanceProxy})
    unallocatedBalanceCurrent = await FundInstance.unallocatedBalance();
    assert(unallocatedBalancePrev - unallocatedBalanceCurrent == 1001*5);
    // update end epoch if it is before current end epoch and inflation update is before new end epoch
    
    // update end epoch if it is before current end epoch and inflation update is after new end epoch
    // Fund a pot after it ended
    // update inflation after the fund ends
  });

  it("update fund pot", async () => {
    // try updating fund pot without governance
    // update pot fund address with governance and without governance
    // check if previous fund was remove and new one was added
  });

  it("Draw from pot", async () => {
    // try drawing from a pot that doesn't exist
    // try drawing from  a block which is already drawn
    // try drawing when there was a inflation change after last drawn epoch to drawn block
    // try drawing when fund ended
    // try drawing when fund hasn't ended and check updated data as well as return value
  });

  async function before() {
    let LINDeployment = await LINToken.new();
    let proxyInstance = await LINProxy.new(LINDeployment.address);
    LINInstance = await LINToken.at(proxyInstance.address);
    let potDeployment = await Pot.new();
    let potProxyInstance = await PotProxy.new(potDeployment.address);
    PotInstance = await Pot.at(potProxyInstance.address);
    let fundDeployment = await Fund.new();
    let fundProxyInstance = await FundProxy.new(fundDeployment.address);
    FundInstance = await Fund.at(fundProxyInstance.address);

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

    localConfig = {
      firstEpochStartBlock,
      roles,
    };
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

    await FundInstance.initialize(
      LINInstance.address,
      governanceProxy
    );
    await LINInstance.mint(accounts[0], 1000000000, {from: accounts[0]})
    await LINInstance.transfer(FundInstance.address, 100000, {from: accounts[0]});
    await FundInstance.updateLINAllocation();
  }
});
