const Web3 = require("web3");
const web3 = new Web3("https://kovan.infura.io/v3/dd408c1672464e64bb74631ca8541967");
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
    gasPrice: 1000000000
  }
};

for (let index = 0; index < privKeys.length; index++) {
  const privateKey = privKeys[index];
  web3.eth.accounts.wallet.add(privateKey);
}

async function deployContract(web3, abi, bytecode, arguments, config) {
  const contract = new web3.eth.Contract(abi);
  const receiptPromise = new Promise((resolve, reject) => {
    contract.deploy({
      data: bytecode,
      arguments
    }).send({
      from: addresses[1],
      gas: config.gas,
      gasPrice: config.gasPrice
    }).on("transactionHash", console.log)
    .on("receipt", (receipt) => {
      resolve(receipt.contractAddress)
    })
    .on("error", (error) => {
      reject(error);
    });
  });
  
  return receiptPromise ;
}

async function deploy() {
  // deploy address registry
  console.log("-------------Deploying Address Registry--------------");
  const addressRegistryAddress = await deployContract(web3, addressRegistryCompiled.abi, addressRegistryCompiled.bytecode, [config.offlineSigner], config.deploymentConfig);
  console.log("-------------Deploying Validator Registry--------------");
  const validatorRegistryAddress = await deployContract(web3, validatorRegistryCompiled.abi, validatorRegistryCompiled.bytecode, [], config.deploymentConfig);
  console.log("-------------Deploying Stake Registry--------------");
  const stakeRegistryAddress = await deployContract(web3, stakeRegistryCompiled.abi, stakeRegistryCompiled.bytecode, [validatorRegistryAddress, config.governanceProxy], config.deploymentConfig);
  console.log("-------------Deploying MPOND Logic--------------");
  const mPondLogicAddress = await deployContract(web3, mPondLogicCompiled.abi, mPondLogicCompiled.bytecode, [], config.deploymentConfig);
  console.log("-------------Deploying MPOND Proxy--------------");
  const mPondProxyAddress = await deployContract(web3, mPondProxyCompiled.abi, mPondProxyCompiled.bytecode, [mPondLogicAddress], config.deploymentConfig);
  console.log("-------------Deploying Distribution--------------");
  const distributionAddress = await deployContract(web3, distributionCompiled.abi, distributionCompiled.bytecode, [
    validatorRegistryAddress,
    stakeRegistryAddress,
    addressRegistryAddress,
    mPondProxyAddress
  ], config.deploymentConfig);
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  console.log("Distribution address", distributionAddress);
  console.log("ValidatorRegistry address", validatorRegistryAddress);
  console.log("StakeRegistry address", stakeRegistryAddress);
  console.log("AddressRegistry address", addressRegistryAddress);
  console.log("mPondLogic address", mPondLogicAddress);
  console.log("mPondProxy address", mPondProxyAddress);
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
}

deploy();

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x5799aBfCa8FFe00DA0Ca92eaD94f9847994FE869
// ValidatorRegistry address 0x49Bd513724C45360B22f8f0BC26A40c8bd8Eaf68
// StakeRegistry address 0x8702a3Dc371b7650DD8Cb07a0F69B54Be3cD6053
// AddressRegistry address 0x8554f51659f9c467cE2aB061c411d70Ab5839454
// mPondLogic address 0x2C3682eCEaD6F0A102902CC694202fb7421f830c
// mPondProxy address 0x3D9ca700eaa2ef95bb3DA1BDEdBE4BdDBb60ae4F
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%