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
    "0x6777AD9f8d50D6d1500e623035b17A2daf6932D7" // kovan address
  );
  let result = await tokenInstance.methods
    .initialize(
      "0xf55B1947e877e3Fa87ad13fA8169df82c544f1ef",
      "0xB46a01e8D723796686daea50619a61fcb4cB5ebA"
    )
    // externalAddress, distribution address
    .send({from: addresses[0], gas: 2000000, gasPrice: 1000000000});
  return result;
}

async function checkBalance() {
  var tokenInstance = new web3.eth.Contract(
    mPondLogicCompiled.abi,
    "0x6777AD9f8d50D6d1500e623035b17A2daf6932D7" // kovan address
  );
  let result = await tokenInstance.methods
    .balanceOf("0xB46a01e8D723796686daea50619a61fcb4cB5ebA")
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
// Distribution address 0xB46a01e8D723796686daea50619a61fcb4cB5ebA
// ValidatorRegistry address 0x5AEb660972796a3bDd3C18373fD536FA32d987F8
// StakeRegistry address 0x59F36dec32121B73150d65E11FE3D1c02B18A762
// AddressRegistry address 0x22757E52b8Ea645D5D3D5005f0Fe9249E0BBdeA0
// mPondLogic address 0x84330B1239F0F5611665d10A6D5e94C57B033A66
// mPondProxy address 0x6777AD9f8d50D6d1500e623035b17A2daf6932D7
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

function print(data){
    console.log(JSON.stringify(data, null, 4));
}