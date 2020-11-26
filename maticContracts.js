const Web3 = require("web3");
// const web3 = new Web3(
//   "https://goerli.infura.io/v3/f69c3698961e47d7834969e8c4347c1b" //goerli
// );
const web3 = new Web3(
  "https://rpc-mumbai.maticvigil.com/v1/0576d7be18bbf8c43ae3cbeccaf541f80c6eed1a" //matic
);
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

const childChainManagerProxy = "0xb5505a6d998549090530911180f38aC5130101c6";
const tokenAddress = "0xD439a0f22e0d8020764Db754efd7Af78100c6389"; // this was deployed from remix browser
const tokenDeployedFrom = "0x0744bFE7c9F034cB54FEd508f50eF1bA3F29b80A";

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
  console.log("-------------Deploying Distribution--------------");
  const distributionAddress = await deployContract(
    web3,
    distributionCompiled.abi,
    distributionCompiled.bytecode,
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
}
async function checkDistributionContract() {
  let distributionInstance = new web3.eth.Contract(
    distributionCompiled.abi,
    "0x27F9C69F1a95E1283D71F876687E5fC72ecD1116"
  );
  let result = distributionInstance.methods
    .getUnclaimedAmount()
    .call({from: "fb22c0b729bf5f56ad904f71307fc247a82c2af5"});
  return result;
}

// checkDistributionContract().then(console.log).catch(console.log);

deploy();

//polkadot addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x27F9C69F1a95E1283D71F876687E5fC72ecD1116
// ValidatorRegistry address 0xC1423350f37c6F4a6E9F96435d50D70f95bBE499
// StakeRegistry address 0x22BDBd03753298df08f2103BCaDD0a53922A34c6
// AddressRegistry address 0x6094367346ef75c7ae080Fdb46b0e8C8f378583d
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// bsc addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xcEB30db2fBCE607f962d4412C434E0fF13d2b642
// ValidatorRegistry address 0x29dccB73766ff32247733Eeaa3db084234F5b328
// StakeRegistry address 0x3A45d13aB4F70f7C327Cb60Ce8D35856aacDFa2d
// AddressRegistry address 0xDfD511Ed1cbFC85B9ba4B7E4C21bE67A5C3FAd76
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%