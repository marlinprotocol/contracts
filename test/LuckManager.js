const LINToken = artifacts.require("TokenLogic.sol");
const LINProxy = artifacts.require("TokenProxy.sol");

const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");

const Luck = artifacts.require("LuckManager.sol");
const LuckProxy = artifacts.require("LuckManagerProxy.sol");

const appConfig = require("../app-config");

var LuckInstance;
var PotInstance;
var LinInstance;

contract.skip("Luck Manager", function (accounts) {
  let LuckInstance;
  let PotInstance;
  it("deploy all contracts", async function () {
    let potDeployment = await Pot.new();
    // let potProxyInstance = await PotProxy.new(potDeployment.address);
    // PotInstance = await Pot.at(potProxyInstance.address);
    PotInstance = await Pot.at(potDeployment.address);
    let luckDeployment = await Luck.new();
    let luckProxyInstance = await LuckProxy.new(luckDeployment.address);
    LuckInstance = await Luck.at(luckProxyInstance.address);
    let linDeployment = await LINToken.new();
    let linProxy = await LINProxy.new(linDeployment.address);
    LinInstance = await LINToken.at(linProxy.address);
  });

  it("Initialize all contracts", () => {
    // address _governanceEnforcerProxy,
    // address _pot,
    // bytes32[] memory _roles,
    // uint256[][] memory _luckPerRoles
    let {name, symbol, decimals} = appConfig.LINData;

    return LinInstance.initialize(name, symbol, decimals)
      .then(async function () {
        let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
        let firstEpochStartBlock;
        let EthBlocksPerEpoch = appConfig.EthBlockPerEpoch;
        await web3.eth.getBlockNumber((err, blockNo) => {
          firstEpochStartBlock =
            blockNo + appConfig.potFirstEpochStartBlockDelay;
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
        return PotInstance.initialize(
          governanceProxy,
          firstEpochStartBlock,
          EthBlocksPerEpoch,
          roles,
          distribution,
          [appConfig.LINData.id],
          [LinInstance.address],
          claimWaitEpochs
        );
      })
      .then(function () {
        let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
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

        return LuckInstance.initialize(
          governanceProxy,
          PotInstance.address,
          [producer.roleId, receiver.roleId],
          luckRoleParams
        );
      });
  });

  it("Check all initilization params", () => {
    // check  if luckTrailingEpochs, targetClaims, averagingEpochs, startingEpoch,
    // varianceTolerance, changeSteps are initialized correctly
    // check if initialLuckLimit was set
    let {producer, receiver} = appConfig.roleParams;
    return LuckInstance.luckByRoles(producer.roleId)
      .then(function (luckByRole) {
        assert.equal(
          luckByRole.luckTrailingEpochs,
          producer.luckTrailingEpochs,
          "luckTrailingEpochs should be equal"
        );
        assert.equal(
          luckByRole.targetClaims,
          producer.targetClaims,
          "targetClaims should be equal"
        );
        assert.equal(
          luckByRole.averagingEpochs,
          producer.averaginingEpochs,
          "averagingEpochs should be equal"
        );
        assert.equal(
          luckByRole.varianceTolerance,
          producer.varianceTolerance,
          "varianceTolerance should be equal"
        );
        assert.equal(
          luckByRole.changeSteps,
          producer.changeSteps,
          "changeSteps should be equal"
        );
        return LuckInstance.luckByRoles(receiver.roleId);
      })
      .then(function (luckByRole) {
        assert.equal(
          luckByRole.luckTrailingEpochs,
          receiver.luckTrailingEpochs,
          "luckTrailingEpochs should be equal"
        );
        assert.equal(
          luckByRole.targetClaims,
          receiver.targetClaims,
          "targetClaims should be equal"
        );
        assert.equal(
          luckByRole.averagingEpochs,
          receiver.averaginingEpochs,
          "averagingEpochs should be equal"
        );
        assert.equal(
          luckByRole.varianceTolerance,
          receiver.varianceTolerance,
          "varianceTolerance should be equal"
        );
        assert.equal(
          luckByRole.changeSteps,
          receiver.changeSteps,
          "changeSteps should be equal"
        );
      });
  });

  it("initialize luck for a role", async () => {
    // Initialize luck for role with non governance account
    // bytes32 _role,
    // uint256 _luckTrailingEpochs,
    // uint256 _targetClaims,
    // uint256 _averagingEpochs,
    // uint256 _startingEpoch,
    // uint256 _varianceTolerance,
    // uint256 _changeSteps,
    // uint256 _initialLuck
    let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
    let {producer} = appConfig.roleParams;
    return LuckInstance.initializeLuckForRole(
      producer.roleId,
      producer.luckTrailingEpochs,
      producer.targetClaims,
      producer.averaginingEpochs,
      producer.startingEpoch,
      producer.varianceTolerance,
      producer.changeSteps,
      producer.initialLuck,
      {from: governanceProxy}
    )
      .then(function () {
        return LuckInstance.luckByRoles(producer.roleId);
      })
      .then(function (luckByRole) {
        assert.equal(
          luckByRole.luckTrailingEpochs,
          producer.luckTrailingEpochs,
          "updated params"
        );
        assert.equal(
          luckByRole.targetClaims,
          producer.targetClaims,
          "updated params"
        );
        assert.equal(
          luckByRole.averagingEpochs,
          producer.averaginingEpochs,
          "updated params"
        );
        assert.equal(
          luckByRole.startingEpoch,
          producer.startingEpoch,
          "updated params"
        );
        assert.equal(
          luckByRole.varianceTolerance,
          producer.varianceTolerance,
          "updated params"
        );
        assert.equal(
          luckByRole.changeSteps,
          producer.changeSteps,
          "updated params"
        );
        return addBlocks(parseInt(appConfig.EthBlockPerEpoch * 2), accounts);
      })
      .then(function () {
        return execute(
          LuckInstance.getCurrentLuck,
          producer.roleId,
          parseInt(appConfig.EthBlockPerEpoch * 20)
        );
      });
  });

  it("Get luck for a specific epoch and role", async () => {
    // Try getting luck for future epochs and verify against expected
    // Try getting luck for startingEpoch+1 and verify against expected
    // Try getting luck for startingEpoch+5 and verify against expected basically skip some epochs so that it computes luck for skipped epochs recursively
    // Try getting a alreday fetched luck and see that gas costs should be very low and verify against expected

    let startingEpoch;
    let startingEpoch_plus_1;
    let startingEpoch_plus_5;
    let luckAtStartingEpoch;
    let luckAtStartingEpoch_plus_1;
    let luckAtStartingEpoch_plus_5;
    let {producer} = appConfig.roleParams;
    return LinInstance.approve(PotInstance.address, 4000)
      .then(function () {
        return LinInstance.mint(accounts[0], 4000);
      })
      .then(function () {
        return addBlocks(parseInt(appConfig.EthBlockPerEpoch * 2), accounts);
      })
      .then(function () {
        return PotInstance.getCurrentEpoch();
      })
      .then(function (epoch) {
        // console.log(epoch);
        startingEpoch = epoch;
        return LuckInstance.getLuck.call(epoch, producer.roleId);
      })
      .then(function (luck) {
        luckAtStartingEpoch = luck;
        return addBlocks(parseInt(appConfig.EthBlockPerEpoch), accounts);
      })
      .then(function () {
        return PotInstance.getCurrentEpoch();
      })
      .then(function (epoch) {
        // console.log(epoch);
        startingEpoch_plus_1 = epoch;
        return LuckInstance.getLuck.call(epoch, producer.roleId);
      })
      .then(function (luck) {
        luckAtStartingEpoch_plus_1 = luck;
        return addBlocks(parseInt(appConfig.EthBlockPerEpoch * 4), accounts);
      })
      .then(function () {
        return PotInstance.getCurrentEpoch();
      })
      .then(function (epoch) {
        startingEpoch_plus_5 = epoch;
        return LuckInstance.getLuck.call(epoch, producer.roleId);
      })
      .then(function (luck) {
        luckAtStartingEpoch_plus_5 = luck;
        return;
      })
      .then(function () {
        // assert conditions here
        console.log({
          startingEpoch: startingEpoch.toString(),
          startingEpoch_plus_1: startingEpoch_plus_1.toString(),
          startingEpoch_plus_5: startingEpoch_plus_5.toString(),
          luckAtStartingEpoch: luckAtStartingEpoch.toString(),
          luckAtStartingEpoch_plus_1: luckAtStartingEpoch_plus_1.toString(),
          luckAtStartingEpoch_plus_5: luckAtStartingEpoch_plus_5.toString(),
        });
      });
  });

  it("Get current luck based on previous luck and avergeclaims", async () => {
    // Try getting luck when avergaeclaims are less than target by small margin
    // Try getting luck when avergaeclaims are less than target by large margin
    // Try getting luck when avergaeclaims are greater than target by small margin
    // Try getting luck when avergaeclaims are greater than target by large margin
    let {producer} = appConfig.roleParams;
    let startingLuck;
    let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
    let verifier = accounts[appConfig.verifiedClaimAccountIndex];
    let luckAfter1ClaimInNextEpoch;
    let rewardAddress1 = accounts[appConfig.reward1ClaimerIndex];
    let rewardAddress2 = accounts[appConfig.reward2ClaimerIndex];
    await LinInstance.mint(accounts[0], 4000);
    await LinInstance.mint(accounts[8], 4000);
    await LinInstance.approve(PotInstance.address, 4000);
    await LinInstance.approve(PotInstance.address, 4000, {from: accounts[8]});
    let epoch = await PotInstance.getCurrentEpoch();
    await PotInstance.addToPot(
      [epoch, epoch + 1],
      accounts[0],
      appConfig.LINData.id,
      [1800, 1850]
    );
    await PotInstance.addToPot(
      [epoch, epoch + 1],
      accounts[8],
      appConfig.LINData.id,
      [1800, 1850]
    );
    startingLuck = await LuckInstance.getLuck.call(epoch, producer.roleId);
    await PotInstance.addVerifier(verifier, {from: governanceProxy});
    await PotInstance.claimTicket(
      [producer.roleId],
      [rewardAddress1],
      [epoch],
      {from: verifier}
    );
    await PotInstance.claimTicket(
      [producer.roleId],
      [rewardAddress1],
      [epoch],
      {from: verifier}
    );
    let startingEpoch = await PotInstance.getCurrentEpoch.call();
    await execute(
      LuckInstance.getCurrentLuck,
      producer.roleId,
      parseInt(appConfig.EthBlockPerEpoch)
    );
    // this is luck in next epoch
    let endingEpoch = await PotInstance.getCurrentEpoch.call();
    luckAfter1ClaimInNextEpoch = await LuckInstance.getCurrentLuck.call(
      producer.roleId
    );
    console.log({
      startingLuck: startingLuck.toString(),
      luckAfter1ClaimInNextEpoch: luckAfter1ClaimInNextEpoch.toString(),
      startingEpoch: startingEpoch.toString(),
      endingEpoch: endingEpoch.toString(),
    });
  });

  it("Change Role params with goverance", async () => {
    // Check if changeLuckTrailingEpochs is being set with and without governance
    // Check if changeTargetClaims is being set with and without governance
    // Check if changeAveragingEpochs is being set with and without governance
    // Check if changeVarianceTolerance is being set with and without governance
    // Check if changeChangeSteps is being set with and without governance
  });
});

async function increaseBlocks(accounts) {
  // this transactions is only to increase the few block
  return web3.eth.sendTransaction({
    from: accounts[1],
    to: accounts[2],
    value: 1,
  });
}

async function addBlocks(count, accounts) {
  for (let index = 0; index < count; index++) {
    await increaseBlocks(accounts);
  }
  return;
  // await web3.currentProvider.send({
  //   jsonrpc: "2.0",
  //   method: "evm_mine",
  //   id: 12345
  // });
  // return;
}

async function execute(contractCall, param, count) {
  for (let index = 0; index < count; index++) {
    await contractCall(param);
  }
  return;
}
