//initialize the following contracts
// clusterRegistry
// cluserDefault

const ClusterDefaultProxy = artifacts.require("ClusterDefaultProxy.sol");
const ClusterDefault = artifacts.require("ClusterDefault.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");
const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const TokenProxy = artifacts.require("TokenProxy.sol");
const TokenLogic = artifacts.require("TokenLogic.sol");
const PotProxy = artifacts.require("PotProxy.sol");
const Pot = artifacts.require("Pot.sol");
const GovernorAlpha = artifacts.require("GovernorAlpha.sol");

var clusterInstance;
var tokenInstance;
var defaultInstance;
var potInstance;
var govInstance;

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

  it("initialize contracts", function () {
    // address _governanceEnforcerProxy,
    // uint _firstEpochStartBlock,
    // uint _EthBlocksPerEpoch,
    // bytes32[] memory _ids,
    // uint[] memory _fractionPerCent,
    // bytes32[] memory _tokens,
    // address[] memory _tokenContracts,
    // uint[] memory _epochsToWaitForClaims

    //what params should be added to make sure that pot is 100% filled
    return potInstance
      .initialize(govInstance.address, 0xff, 0xff, [], [], [], [], [])
      .then(function () {
        return defaultInstance.initialize(accounts[0], {from: accounts[1]});
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

        //using accounts[9] as default cluster
        return clusterInstance.initialize(
          accounts[9],
          0xff,
          0xff,
          tokenInstance.address,
          potInstance.address
        );
      });
  });
});
