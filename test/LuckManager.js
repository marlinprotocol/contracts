const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");

const Luck = artifacts.require("LuckManager.sol");
const LuckProxy = artifacts.require("LuckManagerProxy.sol");

contract.skip("Luck Manager", function (accounts) {
  let LuckInstance;
  let PotInstance;
  it("deploy all contracts", async function () {
    let potDeployment = await Pot.new();
    let potProxyInstance = await PotProxy.new(potDeployment.address);
    PotInstance = await Pot.at(potProxyInstance.address);
    let luckDeployment = await Luck.new();
    let luckProxyInstance = await LuckProxy.new(luckDeployment.address);
    LuckInstance = await Pot.at(luckProxyInstance.address);
  });

  it("Initialize all contracts", async () => {});

  it("Check all initilization params", async () => {
    // check  if luckTrailingEpochs, targetClaims, averagingEpochs, startingEpoch,
    // varianceTolerance, changeSteps are initialized correctly
    // check if initialLuckLimit was set
  });

  it("initialize luck for a role", async () => {
    // Initialize luck for role with non governance account
    // check  if luckTrailingEpochs, targetClaims, averagingEpochs, startingEpoch,
    // varianceTolerance, changeSteps are correctly set
    // check if initialLuckLimit was set
  });

  it("Get luck for a specific epoch and role", async () => {
    // Try getting luck for future epochs and verify against expected
    // Try getting luck for startingEpoch+1 and verify against expected
    // Try getting luck for startingEpoch+5 and verify against expected basically skip some epochs so that it computes luck for skipped epochs recursively
    // Try getting a alreday fetched luck and see that gas costs should be very low and verify against expected
  });

  it("Get current luck based on previous luck and avergeclaims", async () => {
    // Try getting luck when avergaeclaims are less than target by small margin
    // Try getting luck when avergaeclaims are less than target by large margin
    // Try getting luck when avergaeclaims are greater than target by small margin
    // Try getting luck when avergaeclaims are greater than target by large margin
  });

  it("Change Role params with goverance", async () => {
    // Check if changeLuckTrailingEpochs is being set with and without governance
    // Check if changeTargetClaims is being set with and without governance
    // Check if changeAveragingEpochs is being set with and without governance
    // Check if changeVarianceTolerance is being set with and without governance
    // Check if changeChangeSteps is being set with and without governance
  });
});
