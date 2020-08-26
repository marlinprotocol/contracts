//TODO: remove this variable to use actual Governance Proxy
let governanceProxyAccountIndex = 6;

let relayerAccountIndex = 7;
// Number of blocks to Delay from the current block to start the pot
// This block should be start of first epoch
let potFirstEpochStartBlockDelay = 10;
// Number of Eth Blocks per epoch
let EthBlockPerEpoch = 5;
// Ensure that total allocation is 100
let roleParams = {
    "producer": {
        roleId: "0x0",
        allocation: 30,
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
        changeSteps: 20
    },
    "receiver": {
        roleId: "0x1",
        allocation: 70,
        luckTrailingEpochs: 5,
        targetClaims: 4,
        averaginingEpochs: 5,
        startingEpoch: 0,
        varianceTolerance: 20,
        changeSteps: 20
    }
};
// Number of epochs for clusters to wait before exiting the network.
let clusterExitWaitEpochs = 2;
// Minimum number of LIN to stake for a cluster to join network
let clusterMinStake = 10;

module.exports = {
    governanceProxyAccountIndex,
    potFirstEpochStartBlockDelay,
    EthBlockPerEpoch,
    roleParams,
    relayerAccountIndex,
    clusterExitWaitEpochs,
    clusterMinStake
}