const Web3 = require("web3");
const web3 = new Web3(
  "https://kovan.infura.io/v3/dd408c1672464e64bb74631ca8541967"
);
const mPondLogicCompiled = require("./build/contracts/mPondLogic.json");
const mPondProxyCompiled = require("./build/contracts/mPondProxy.json");
const addressRegistryCompiled = require("./build/contracts/AddressRegistry.json");
const validatorRegistryCompiled = require("./build/contracts/ValidatorRegistry.json");
const stakeRegistryCompiled = require("./build/contracts/StakeRegistry.json");
const distributionCompiled = require("./build/contracts/Distribution.json");

const privKeys = [
  "1b83be2fc81050af5c5ebc714105d87f52636edc01dc2c62257fef7f562fc654",
  "1eae96f17cfe5ca1995530ca9f3b595583d713052a6e3898f1e1c441e89eae51",
];
const addresses = [
  "0xFC57cBd6d372d25678ecFDC50f95cA6759b3162b",
  "0xdeFF2Cd841Bd47592760cE068a113b8E594F8553",
];

const config = {
  governanceProxy: addresses[0],
  offlineSigner: addresses[0],
  deploymentConfig: {
    gas: 10000000,
    gasPrice: 1000000000,
  },
};

for (let index = 0; index < privKeys.length; index++) {
  const privateKey = privKeys[index];
  web3.eth.accounts.wallet.add(privateKey);
}

async function deployContract(web3, abi, bytecode, arguments, config) {
  const contract = new web3.eth.Contract(abi);
  const receiptPromise = new Promise((resolve, reject) => {
    contract
      .deploy({
        data: bytecode,
        arguments,
      })
      .send({
        from: addresses[1],
        gas: config.gas,
        gasPrice: config.gasPrice,
      })
      .on("transactionHash", console.log)
      .on("receipt", (receipt) => {
        resolve(receipt.contractAddress);
      })
      .on("error", (error) => {
        reject(error);
      });
  });

  return receiptPromise;
}

async function deploy() {
  // deploy address registry
  console.log("-------------Deploying Address Registry--------------");
  const addressRegistryAddress = await deployContract(
    web3,
    addressRegistryCompiled.abi,
    addressRegistryCompiled.bytecode,
    [config.offlineSigner],
    config.deploymentConfig
  );
  console.log("-------------Deploying Validator Registry--------------");
  const validatorRegistryAddress = await deployContract(
    web3,
    validatorRegistryCompiled.abi,
    validatorRegistryCompiled.bytecode,
    [],
    config.deploymentConfig
  );
  console.log("-------------Deploying Stake Registry--------------");
  const stakeRegistryAddress = await deployContract(
    web3,
    stakeRegistryCompiled.abi,
    stakeRegistryCompiled.bytecode,
    [validatorRegistryAddress, config.governanceProxy],
    config.deploymentConfig
  );
  console.log("-------------Deploying MPOND Logic--------------");
  const mPondLogicAddress = await deployContract(
    web3,
    mPondLogicCompiled.abi,
    mPondLogicCompiled.bytecode,
    [],
    config.deploymentConfig
  );
  console.log("-------------Deploying MPOND Proxy--------------");
  const mPondProxyAddress = await deployContract(
    web3,
    mPondProxyCompiled.abi,
    mPondProxyCompiled.bytecode,
    [mPondLogicAddress],
    config.deploymentConfig
  );
  console.log("-------------Deploying Distribution--------------");
  const distributionAddress = await deployContract(
    web3,
    distributionCompiled.abi,
    distributionCompiled.bytecode,
    [
      validatorRegistryAddress,
      stakeRegistryAddress,
      addressRegistryAddress,
      mPondProxyAddress,
    ],
    config.deploymentConfig
  );
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  console.log("Distribution address", distributionAddress);
  console.log("ValidatorRegistry address", validatorRegistryAddress);
  console.log("StakeRegistry address", stakeRegistryAddress);
  console.log("AddressRegistry address", addressRegistryAddress);
  console.log("mPondLogic address", mPondLogicAddress);
  console.log("mPondProxy address", mPondProxyAddress);
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
}

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x7b45587B7a993aE4481A713de4a4b487C05308C2
// ValidatorRegistry address 0x56dF8F7306DceECf9Bb91b2ee861032D575E0972
// StakeRegistry address 0x04149a2cCb98f649302BbdCc4a3D7118B7ABcAf5
// AddressRegistry address 0x63B222F4222ac71DE4be09A06cE5C4Fd0B5a2635
// mPondLogic address 0x49F86fAff3cf45C66872b1C1135f309Cd6468DB9
// mPondProxy address 0x9c2B9044e1e52f2fAC04A4A843C2d4cE9f5Ff3f0
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

var distributionContractAddress = "0x7b45587B7a993aE4481A713de4a4b487C05308C2";
var tokenProxyAddress = "0x9c2B9044e1e52f2fAC04A4A843C2d4cE9f5Ff3f0";

async function init() {
  var tokenInstance = new web3.eth.Contract(
    mPondLogicCompiled.abi,
    tokenProxyAddress // kovan address
  );
  let result = await tokenInstance.methods
    .initialize(
      "0xf55B1947e877e3Fa87ad13fA8169df82c544f1ef",
      distributionContractAddress
    )
    // externalAddress, distribution address
    .send({from: addresses[0], gas: 2000000, gasPrice: 1000000000});
  return result;
}

async function checkBalance() {
  var tokenInstance = new web3.eth.Contract(
    mPondLogicCompiled.abi,
    tokenProxyAddress // kovan address
  );
  let result = await tokenInstance.methods
    .balanceOf(distributionContractAddress)
    .call();
  return result;
}

async function abi() {
  return distributionCompiled.abi;
}

async function checkDistributionContract() {
  let distributionInstance = new web3.eth.Contract(
    distributionCompiled.abi,
    distributionContractAddress
  );
  let result = distributionInstance.methods
    .getUnclaimedAmount()
    .call({from: "0x2a63a4188082270f172ff8988fbab252e4201bee"});
  return result;
}

checkDistributionContract().then(console.log).catch(console.log);

// abi().then(print).catch(console.log)
// checkBalance().then(console.log).catch(console.log);
// init().then(console.log).catch(console.log);

// deploy();

function print(data) {
  console.log(JSON.stringify(data, null, 4));
}
