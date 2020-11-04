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
    "0x3b312Ce51E2f0A43429269a69aBCE6bA0697516E" // kovan address
  );
  let result = await tokenInstance.methods
    .initialize(
      "0xf55B1947e877e3Fa87ad13fA8169df82c544f1ef",
      "0xe7e8fDD11763D15Ed0FEc41cA0643a2D79050195"
    )
    // externalAddress, distribution address
    .send({from: addresses[0], gas: 2000000, gasPrice: 1000000000});
  return result;
}

async function checkBalance() {
  var tokenInstance = new web3.eth.Contract(
    mPondLogicCompiled.abi,
    "0xac6ca2e26Ecc6d22daFDd5B22a053942C71f1b45" // kovan address
  );
  let result = await tokenInstance.methods
    .balanceOf("0xdbC24f9b687C2D8C476887C20fa2506FE13C8Cb5")
    .call();
  return result;
}

async function abi(){
    return distributionCompiled.abi;
}

// abi().then(print).catch(console.log)
// checkBalance().then(console.log).catch(console.log);
init().then(console.log).catch(console.log);

// deploy();

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xe7e8fDD11763D15Ed0FEc41cA0643a2D79050195
// ValidatorRegistry address 0x9F73337709661cC82A0074E2649c1Aac85876A24
// StakeRegistry address 0xD6a6A8d4EC0ED0a50A46d1ac0eF3055031b813de
// AddressRegistry address 0x6Bc46F905d4660d03ca3D462Eb65fC2b2D528A60
// mPondLogic address 0xcd0c328282A5ceaa9b86E432cB5aCBB8F9405Fa3
// mPondProxy address 0x3b312Ce51E2f0A43429269a69aBCE6bA0697516E
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

function print(data){
    console.log(JSON.stringify(data, null, 4));
}