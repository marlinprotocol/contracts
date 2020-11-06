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

async function init() {
  var tokenInstance = new web3.eth.Contract(
    mPondLogicCompiled.abi,
    "0x30f7F459f8C89E45FBbf2C3b679c65b0ea8d4682" // kovan address
  );
  let result = await tokenInstance.methods
    .initialize(
      "0xf55B1947e877e3Fa87ad13fA8169df82c544f1ef",
      "0xdCbF36893f911182F22a678cDbb5f43D5Ba7e3c1"
    )
    // externalAddress, distribution address
    .send({from: addresses[0], gas: 2000000, gasPrice: 1000000000});
  return result;
}

async function checkBalance() {
  var tokenInstance = new web3.eth.Contract(
    mPondLogicCompiled.abi,
    "0x30f7F459f8C89E45FBbf2C3b679c65b0ea8d4682" // kovan address
  );
  let result = await tokenInstance.methods
    .balanceOf("0xdCbF36893f911182F22a678cDbb5f43D5Ba7e3c1")
    .call();
  return result;
}

async function abi(){
    return distributionCompiled.abi;
}

// abi().then(print).catch(console.log)
checkBalance().then(console.log).catch(console.log);
// init().then(console.log).catch(console.log);

// deploy();

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xdCbF36893f911182F22a678cDbb5f43D5Ba7e3c1
// ValidatorRegistry address 0xEec0feDfFD07337d219B0CEf06E8dD39af880470
// StakeRegistry address 0x512d1f7dCd6f57c61052a20d14677ba0806a13Da
// AddressRegistry address 0xCB0A4AEA8EE5825C6bdb4e05F5124C7Ae03E7DdE
// mPondLogic address 0x019151e837586ABdDed35b38ebf81e4945D3359C
// mPondProxy address 0x30f7F459f8C89E45FBbf2C3b679c65b0ea8d4682
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

function print(data){
    console.log(JSON.stringify(data, null, 4));
}