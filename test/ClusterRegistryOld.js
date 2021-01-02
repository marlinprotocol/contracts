//initialize the following contracts
// clusterRegistry
// cluserDefault

const ClusterDefaultProxy = artifacts.require("ClusterDefaultProxy.sol");
const ClusterDefault = artifacts.require("ClusterDefault.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");
const ClusterRegistry = artifacts.require("ClusterRegistryOld.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const TokenLogic = artifacts.require("TokenLogic.sol");
const PotProxy = artifacts.require("PotProxy.sol");
const Pot = artifacts.require("Pot.sol");
const GovernorAlpha = artifacts.require("GovernorAlpha.sol");
const appConfig = require("../app-config");

var clusterInstance;
var tokenInstance;
var defaultInstance;
var potInstance;
var govInstance;
var governanceProxy;

contract.skip("Cluster Registry", function (accounts) {
  it("deploy and initialise the contracts", function () {
    return TokenProxy.deployed({from: accounts[1]})
      .then(function () {
        return TokenLogic.at(TokenProxy.address);
      })
      .then(function (instance) {
        tokenInstance = instance;
        return ClusterRegistryProxy.deployed({from: accounts[1]});
      })
      .then(function () {
        return ClusterRegistry.at(ClusterRegistryProxy.address);
      })
      .then(function (instance) {
        clusterInstance = instance;
        return ClusterDefaultProxy.deployed({from: accounts[1]});
      })
      .then(function (instance) {
        return ClusterDefault.at(instance.address);
      })
      .then(function (instance) {
        defaultInstance = instance;
        return GovernorAlpha.deployed();
      })
      .then(function (instance) {
        govInstance = instance;
        return PotProxy.deployed({from: accounts[1]});
      })
      .then(function (instance) {
        return Pot.at(instance.address);
      })
      .then(function (instance) {
        potInstance = instance;
        return;
      });
  });

  it("initialize contracts", async function () {
    // address _governanceEnforcerProxy,
    // uint _firstEpochStartBlock,
    // uint _EthBlocksPerEpoch,
    // bytes32[] memory _ids,
    // uint[] memory _fractionPerCent,
    // bytes32[] memory _tokens,
    // address[] memory _tokenContracts,
    // uint[] memory _epochsToWaitForClaims

    governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
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

    //what params should be added to make sure that pot is 100% filled
    // replace governanceProxy with govInstance.address during integration
    return potInstance
      .initialize(
        governanceProxy,
        firstEpochStartBlock,
        EthBlocksPerEpoch,
        roles,
        distribution,
        [appConfig.LINData.id],
        [tokenInstance.address],
        claimWaitEpochs
      )
      .then(function () {
        return defaultInstance.initialize(accounts[0], {from: accounts[0]});
      })
      .then(function () {
        return tokenInstance.initialize("Marlin Protocol", "LIN", 18);
      })
      .then(function () {
        // address _defaultCluster,
        // uint _clusterExitWaitEpochs,
        // uint _minStakeAmount,
        // address _LINToken,
        // address _pot

        return clusterInstance.initialize(
          defaultInstance.address,
          0x5,
          0xff,
          tokenInstance.address,
          potInstance.address,
          governanceProxy
        );
      });
  });

  it("add cluster", function () {
    return clusterInstance
      .GovernanceEnforcerProxy({from: governanceProxy})
      .then(function (govProxy) {
        assert.equal(govProxy, governanceProxy, "gov proxy must be same");
        return clusterInstance.openClusterRegistry({from: governanceProxy});
      })
      .then(function () {
        return tokenInstance.mint(accounts[0], 0xabcde);
      })
      .then(function () {
        return tokenInstance.approve(clusterInstance.address, 0xabcde);
      })
      .then(function () {
        return clusterInstance.addCluster(0xabcde / 0x2);
      })
      .then(function () {
        return clusterInstance.addCluster(0xabcde / 0x2);
      })
      .then(function (tx) {
        // console.log(tx);
        return clusterInstance.closeClusterRegistry({from: governanceProxy});
      });
  });

  it("check cluster status", function () {
    return clusterInstance.getClusterStatus
      .call(accounts[0])
      .then(function (status) {
        assert.equal(status, 1, "status should be waiting to join");
        return addBlocks(10, accounts);
      })
      .then(function () {
        return clusterInstance.getClusterStatus.call(accounts[0]);
      })
      .then(function (status) {
        assert.equal(status, 2, "status should be active");
        return clusterInstance.clusters.call(accounts[0]);
      })
      .then(function (cluster) {
        console.log(cluster);
        return clusterInstance.proposeExit();
      })
      .then(function () {
        return clusterInstance.getClusterStatus.call(accounts[0]);
      })
      .then(function (status) {
        assert.equal(status, 3, "status should be exiting");
        return potInstance.getCurrentEpoch();
      })
      .then(function (epoch) {
        console.log(epoch);
        return addBlocks(5, accounts);
      })
      .then(function () {
        return potInstance.getCurrentEpoch();
      })
      .then(function (epoch) {
        console.log(epoch);
        return addBlocks(30, accounts);
      })
      .then(function () {
        return clusterInstance.exit();
      });
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
