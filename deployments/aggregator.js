const networks = require("./networks");
const deployContract = require("./helpers");

if (!networks[process.env.NETWORK]) {
  console.log("NETWORK not declared or valid in env variables");
  process.exit(1);
} else {
  console.log(`Deploying contracts on ${networks[process.env.NETWORK]}`);
}

const Web3 = require("web3");
const web3 = new Web3(networks[process.env.NETWORK]);

var proxyAdmin;

if (!process.env.PRIV_KEY) {
  console.log("PRIV_KEY not defined in env variables");
} else {
  web3.eth.accounts.wallet.add(process.env.PRIV_KEY);
}

const config = {
  deploymentConfig: {
    gas: 10000000,
    gasPrice: 35000000000,
    from: web3.eth.accounts.wallet[0].address,
  },
};

const aggregatorCompiled = require("../build/contracts/Aggregator.json");

async function deployAggregator() {
  console.log("-------------Deploying Aggregator--------------");
  const aggregatorAddress = await deployContract(
    web3,
    aggregatorCompiled.abi,
    aggregatorCompiled.bytecode,
    [],
    config.deploymentConfig
  );
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  console.log("Aggregator address", aggregatorAddress);
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  return;
}

deployAggregator();

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Aggregator address 0xd3D2042097fAD4B576F8d1601E25083A3d4e7ABC
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
