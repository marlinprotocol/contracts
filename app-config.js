//TODO: remove this variable to use actual Governance Proxy
let governanceProxyAccountIndex = 6;
let verifiedClaimAccountIndex = 13;
let reward1ClaimerIndex = 14;
let reward2ClaimerIndex = 14;
let reward3ClaimerIndex = 14;
let relayerAccountIndex = 7;
// Number of blocks to Delay from the current block to start the pot
// This block should be start of first epoch
let potFirstEpochStartBlockDelay = 1;
// Number of Eth Blocks per epoch
let EthBlockPerEpoch = 1;
// Ensure that total allocation is 100
let roleParams = {
  producer: {
    roleId:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    allocation: 30,
    // Epochs to wait before claiming fee rewards
    epochsToWaitForClaims: 1,
    // Epochs by which luck will trail
    // Last confirmed luck depends on how many epochs are allowed to submit tickets
    luckTrailingEpochs: 5,
    // target number of claims per epoch
    targetClaims: 4,
    // How many epoch average is considered to decide on changes necessary to current luck
    averaginingEpochs: 5,
    // start epoch for calculating luck for the role
    startingEpoch: 0,
    // Maximum variance from average of previous epochs during which luck doesn't change (in %)
    varianceTolerance: 20,
    // Steps in which luck changes (in %)
    changeSteps: 20,
    // inital luck user
    initialLuck: 20,
  },
  receiver: {
    roleId:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    allocation: 70,
    epochsToWaitForClaims: 5,
    luckTrailingEpochs: 5,
    targetClaims: 4,
    averaginingEpochs: 5,
    startingEpoch: 0,
    varianceTolerance: 20,
    changeSteps: 20,
    initialLuck: 45,
  },
};
// Number of epochs for clusters to wait before exiting the network.
let clusterExitWaitEpochs = 2;
// Minimum number of LIN to stake for a cluster to join network
let clusterMinStake = 10;

let PONDData = {
  name: "Marlin Protocol",
  symbol: "POND",
  decimals: 18,
  id: "0xce802da114f69a4ecceeef68321cb8ad9b268d4419375940651a2ec028713744", // keccak256("POND")
};

let MPONDData = {
  name: "Marlin Protocol - Governance",
  symbol: "MPOND",
  decimals: 18,
  id: "0x9d76bde6f6a1e9bf8e29a98238a6cb26e11f790c4377a675d10c5b375109dbc8", // keccak256("MPOND")
};

let staking = {
  undelegationWaitTime: 3
}

module.exports = {
  governanceProxyAccountIndex,
  potFirstEpochStartBlockDelay,
  EthBlockPerEpoch,
  roleParams,
  relayerAccountIndex,
  clusterExitWaitEpochs,
  clusterMinStake,
  PONDData,
  MPONDData,
  verifiedClaimAccountIndex,
  reward1ClaimerIndex, reward2ClaimerIndex, reward3ClaimerIndex,
  staking
};
