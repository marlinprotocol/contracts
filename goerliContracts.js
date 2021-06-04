const Web3 = require("web3");
const web3 = new Web3(
  "https://goerli.infura.io/v3/f69c3698961e47d7834969e8c4347c1b" //goerli
);

const mPondLogicCompiled = require("./build/contracts/mPondLogic.json");
const mPondProxyCompiled = require("./build/contracts/mPondProxy.json");

var tokenProxyAddress;
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
    gas: 8000000,
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
  tokenProxyAddress = mPondProxyAddress;
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  console.log("mPondLogic address", mPondLogicAddress);
  console.log("mPondProxy address", mPondProxyAddress);
  console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
  return;
}

async function init() {
  let distributionContractAddress =
    "0x0744bFE7c9F034cB54FEd508f50eF1bA3F29b80A";
  var tokenInstance = new web3.eth.Contract(
    mPondLogicCompiled.abi,
    tokenProxyAddress // kovan address
  );
  let result = await tokenInstance.methods
    .initialize(
      "0xeFb71eC54B8f12DFDA1a5569345744c52ffb4e88",
      distributionContractAddress
    )
    // externalAddress, distribution address
    .send({from: addresses[0], gas: 2000000, gasPrice: 1000000000});
  return result;
}

deploy().then(init).then(console.log);

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// mPondLogic address 0x22BDBd03753298df08f2103BCaDD0a53922A34c6
// mPondProxy address 0x27F9C69F1a95E1283D71F876687E5fC72ecD1116
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
