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
const web3Utils = require("web3-utils");

if (!process.env.PRIV_KEY) {
  console.log("PRIV_KEY not defined in env variables");
} else {
  web3.eth.accounts.wallet.add(process.env.PRIV_KEY);
}

const config = {
  governanceProxy: "0xd7f84c9Da683A63E37c9bC13AE304d9E631873E3",
  offlineSigner: "0xBA0882441CD9E664451138E7f7DE07550B32ffDb",
  deploymentConfig: {
    gas: 10000000,
    gasPrice: 1000000000,
    from: web3.eth.accounts.wallet[0].address,
  },
};

const tokenAddress = "0x27B064fE4B708fDa0fD0C4ff2b78a1e4DAB812D1";

const standardOracle = require("../build/contracts/StandardOracle.json");
const addressRegistry = require("../build/contracts/AddressRegistry.json");
const validatorRegistry = require("../build/contracts/ValidatorRegistry.json");
const stakeRegistry = require("../build/contracts/StakeRegistry.json");
const distribution = require("../build/contracts/Distribution.json");

async function deploy() {
  // deploy address registry
  console.log("-------------Deploying Address Registry--------------");
  const addressRegistryAddress = await deployContract(
    web3,
    addressRegistry.abi,
    addressRegistry.bytecode,
    [config.offlineSigner],
    config.deploymentConfig
  );
  console.log("-------------Deploying Validator Registry--------------");
  const validatorRegistryAddress = await deployContract(
    web3,
    validatorRegistry.abi,
    validatorRegistry.bytecode,
    [],
    config.deploymentConfig
  );
  console.log("-------------Deploying Stake Registry--------------");
  const stakeRegistryAddress = await deployContract(
    web3,
    stakeRegistry.abi,
    stakeRegistry.bytecode,
    [validatorRegistryAddress, config.governanceProxy],
    config.deploymentConfig
  );
  console.log("-------------Deploying Distribution--------------");
  const distributionAddress = await deployContract(
    web3,
    distribution.abi,
    distribution.bytecode,
    [
      validatorRegistryAddress,
      stakeRegistryAddress,
      addressRegistryAddress,
      tokenAddress,
    ],
    config.deploymentConfig
  );
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  console.log("Distribution address", distributionAddress);
  console.log("ValidatorRegistry address", validatorRegistryAddress);
  console.log("StakeRegistry address", stakeRegistryAddress);
  console.log("AddressRegistry address", addressRegistryAddress);
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  return;
}

// deploy().then(console.log).catch(console.log);
// addSource().then(console.log).catch(console.log);
// changeRewardPerEpoch("0x8cFC6733f26b5E920fD5b53340B893CE7A368683", "0").then(console.log).catch(console.log);
//  getRewardPerEpoch()
// changeAllRewardPerEpoch().then(console.log);
// tokenAddress: 0x7e88Aeaef1163bc6fA1D30cC360a3D5388e161ab
// ERC 677BridgeToken: 0xF9c7483851017744FE0A5D79607AC609619B9eA7

// polkadot (source: 0xAFCE0a493E59665d9B3a2A845A166c34E27B11dD) (rewardPerEpoch: 365000000000000000)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x175fa5aDC16Df1819832CDcDd5fc513Ba3B8c206
// ValidatorRegistry address 0xbfcF2159eEF214De2C0810dA653c4a0a36Bd4921
// StakeRegistry address 0x189822D70222db1E2411EeA9953637906e04D0CE
// AddressRegistry address 0xa9Df661074D195b21086ef65162695350426F02C
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// cosmos (source: 0x666997eF80ef6e6BF1BE1Bc172Ef5BA77b504F8c) (rewardPerEpoch: 2433333333333333)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xe09984Acf7BE1F422Ac4a925BcB7A4E432d8Ae0b
// ValidatorRegistry address 0x501bF51daAf6927385782a4dB6a9a0b953673F30
// StakeRegistry address 0x4c8209b6eD31798DA22A1505F6EE2C6808673Fc6
// AddressRegistry address 0x8589dB76F16FD8317BD6949c676ae48aBd44E952
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// iris (source: 0x39112A2B773164426df1936bbFe3905C70f5933c) (rewardPerEpoch: 2433333333333333)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xbBE2AD9b0E4a39210908d4018F2C6842F6a56f3c
// ValidatorRegistry address 0xf68201eA9Ef406E8EA3788304d9d2388325F60c5
// StakeRegistry address 0x95C2d75CE279aA7443F3479Dc3C288219a50fa2E
// AddressRegistry address 0xb40f94001a2e2F0f884628216061Ebb1CFCcCC6A
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// near (source: 0xc01888600B88dFD7294E9A3d8af9461F4DA1c179) (rewardPerEpoch: 650000000000000)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x45410b0aC369Fa7775DbeA63455849D9eE310b6f
// ValidatorRegistry address 0x15fA5A21eb848A43F55483fD6Dd346F4f22df41A
// StakeRegistry address 0x55A415e38D4F60f9B03D44562127028C15bBE361
// AddressRegistry address 0xE223cdd6BbA4CCBF87524D6Fef71Ef00B0B06eEe
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// lto (source: 0xF93ecffF6b9b536cEF0576d1E9BB0f454B4478fE) (rewardPerEpoch: 935600000000000)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x1CF9fb9Bc4d4CB896e9f0e32bab51A9BCF4A477C
// ValidatorRegistry address 0x94AfdfA782a6AB6BC6E910e7750f9bC365De1e2e
// StakeRegistry address 0xeF05aCD9c7216f7f3B86f69A0b1F4904a2dFE3D3
// AddressRegistry address 0xc2869dE0588F3824347D0DB1be862922D21E3DE0
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// bsc (source: 0x2c4693147A5cBd999EF124abF58eb38d4cf1D393) (rewardPerEpoch: 3761000000000000)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xE1001FDE563882fc89BE84122Af9d1C2DBAc661E
// ValidatorRegistry address 0xC1319CC04cd3B905faD98fB4b1E5a729fB0b1E3E
// StakeRegistry address 0x1d56D39e02FBeBAd486A640e55D12946c0f8A167
// AddressRegistry address 0xbb8530F922DC4a39d953f82675eCDA7cB1b73DE4
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// matic (source: 0x8DfFDb94AA11918f0eb1310d3195Ad0BA7343CFE) (rewardPerEpoch: 0)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x5ee77A7a41E72d9cB2aa2F8eC553880B2A090b35
// ValidatorRegistry address 0xc5CB95F281A0144c6E8f129ac91c486CbFd67D2a
// StakeRegistry address 0x4dB6CA88214733d154726F4FCd3A0f7755bC7597
// AddressRegistry address 0xD5794185FD3eDfa54c5f6d57D6A7131C260F850A
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// fantom (source: 0x97600d2F926c630C157B5F8dF7eb1068f117c11C) (rewardPerEpoch: 0)
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x13C68DC51e595e57e08b4A4e4dA9F39f6B1AD73B
// ValidatorRegistry address 0x8612b1C94Aa05dF0c2924dfF02220Af189fC616f
// StakeRegistry address 0x0Af8C66320D30924F6f3452a9b79E31F2ECc3bEc
// AddressRegistry address 0x08D30A26E0002d62d5568638d789755Fb94bc20F
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

async function addSource() {
  let newSource = "0x97600d2F926c630C157B5F8dF7eb1068f117c11C";
  let oracles = [
    "0x8612b1C94Aa05dF0c2924dfF02220Af189fC616f",
    "0x0Af8C66320D30924F6f3452a9b79E31F2ECc3bEc",
    "0x08D30A26E0002d62d5568638d789755Fb94bc20F",
  ];
  for (let index = 0; index < oracles.length; index++) {
    const oracleAddress = oracles[index];
    let instance = new web3.eth.Contract(standardOracle.abi, oracleAddress);
    await instance.methods.addSource(newSource).send(config.deploymentConfig);

    let sources = await instance.methods
      .numberOfSources()
      .call(config.deploymentConfig);
    console.log({sources});

    let data = await instance.methods
      .sources(newSource)
      .call(config.deploymentConfig);
    console.log({data});
  }
  return;
}

async function changeRewardPerEpoch(address, valueString) {
  let stakeRegistryInstance = new web3.eth.Contract(stakeRegistry.abi, address);
  let result = await stakeRegistryInstance.methods
    .changeRewardPerEpoch(new web3Utils.BN(valueString))
    .send(config.deploymentConfig);

  return result;
}

async function getRewardPerEpoch() {
  let stakeRegistryInstance = new web3.eth.Contract(
    stakeRegistry.abi,
    "0x8cFC6733f26b5E920fD5b53340B893CE7A368683"
  );
  let result = await stakeRegistryInstance.methods
    .rewardPerEpoch()
    .call(config.deploymentConfig);
  console.log(result);
  return;
}

async function changeAllRewardPerEpoch() {
  let allRewardContracts = [
    "0x4ab72Ca6b3dF67676EcA7c11afAB4E2B2F04EE18",
    "0x4874e852D2FDCcA5F0B3C27f7d7D3c031c5B78a8",
    "0x5216748ec4F387fDe4f6aF3A0283967F87BEeA17",
    "0xe79282eC349bcBE1cfa3e0EeD97c5f01e4cdC24e",
    "0xeC19845b2E43cbE1a028F182649d1ce9e6740feb",
    "0x8cFC6733f26b5E920fD5b53340B893CE7A368683",
    "0xFC82374Afa1C1852325692246bB88f081a2019f1",
  ];
  let rewardChanges = [
    "312857142900000000",
    "2172619048000000",
    "6257142857000000",
    "6257142857000000",
    "4345238095000000",
    "6517857143000000",
    "4345238095000000",
  ];
  for (let index = 0; index < allRewardContracts.length; index++) {
    const contractAddress = allRewardContracts[index];
    const newReward = rewardChanges[index];
    let result = await changeRewardPerEpoch(contractAddress, newReward);
    console.log({result});
  }
  return;
}
