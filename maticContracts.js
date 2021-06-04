const Web3 = require("web3");
// const web3 = new Web3(
//   "https://goerli.infura.io/v3/f69c3698961e47d7834969e8c4347c1b" //goerli
// );
const web3 = new Web3(
  "https://rpc-mumbai.maticvigil.com/v1/0576d7be18bbf8c43ae3cbeccaf541f80c6eed1a" //matic
);

const web3Utils = require("web3-utils");

const standardOracleCompiled = require("./build/contracts/StandardOracle.json");
const addressRegistryCompiled = require("./build/contracts/AddressRegistry.json");
const validatorRegistryCompiled = require("./build/contracts/ValidatorRegistry.json");
const stakeRegistryCompiled = require("./build/contracts/StakeRegistry.json");
const distributionCompiled = require("./build/contracts/Distribution.json");
const aggregatorCompiled = require("./build/contracts/Aggregator.json");
const MPondLogicCompiled = require("./build/contracts/MPondLogic.json");

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

// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Aggregator address 0x701Bc4e141C20C07B63ef554752DE4Ea4b9636B1
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

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
    "0xE8dcD0444B96beeD4A6Ad635A96508F8c350Eef0"
  );
  let result = distributionInstance.methods
    .getUnclaimedAmount()
    .call({from: "0x3e3666d42BEEa1AbB58BD93C973545c8a87954A7"});
  return result;
}

// ValidatorRegistry address 0x4a4521b507bC7EF071eF2D3d49d3B1B8EDd7A758
// StakeRegistry address 0xD026005DA7A9BFd38762B2Aa4891aC1d28BB2429
// AddressRegistry address 0x0Fa02d23ed5F24db1cB729563166a900274e530F

// 721fd596a0052f7cd74fbe2fb784377d7a52b01f6016116dffc22157ffb3d32d
// 0x36A8EEB273c5AcA3562CfC063789E96a07C3AB91

async function addSource() {
  let newSource = "0xb331222A8A5847349B07Cba5BC60e75076144837";
  let oracles = [
    "0x2af08cE9A1eCe86da46AC688e396eC5FD3a6fD8d",
    "0xB7627c0cF0Eb4B9D504BB5391Dd73E612418FaB9",
    "0xB11787fC7575CcD7aD0BB53bFa93a2e85730A0c8",
  ];
  for (let index = 0; index < oracles.length; index++) {
    const oracleAddress = oracles[index];
    let instance = new web3.eth.Contract(
      standardOracleCompiled.abi,
      oracleAddress
    );
    await instance.methods
      .addSource(newSource)
      .send({from: addresses[1], gas: 2000000, gasPrice: 1000000000});
    let sources = await instance.methods
      .numberOfSources()
      .call({from: addresses[1]});
    console.log({sources});

    let data = await instance.methods
      .sources(addresses[1])
      .call({from: addresses[1]});
    console.log({data});
  }
  return;
}

async function changeRewardPerEpoch() {
  let stakeRegistryInstance = new web3.eth.Contract(
    stakeRegistryCompiled.abi,
    "0xB7627c0cF0Eb4B9D504BB5391Dd73E612418FaB9"
  );
  let result = await stakeRegistryInstance.methods
    .changeRewardPerEpoch(new web3Utils.BN("5703125000000000"))
    .send({from: addresses[0], gas: 2000000, gasPrice: 1000000000});

  return result;
}

async function getRewardPerEpoch() {
  let stakeRegistryInstance = new web3.eth.Contract(
    stakeRegistryCompiled.abi,
    "0x3a1e969A6B4C8623879d4acaA263114117c5BEF8"
  );
  let result = await stakeRegistryInstance.methods
    .rewardPerEpoch()
    .call({from: addresses[0]});
  console.log(result);
  return;
}

async function checkBalance() {
  var tokenInstance = new web3.eth.Contract(
    MPondLogicCompiled.abi,
    "0xD439a0f22e0d8020764Db754efd7Af78100c6389"
  );
  let result = await tokenInstance.methods
    .balanceOf("0xE8dcD0444B96beeD4A6Ad635A96508F8c350Eef0")
    .call();
  return result;
}

async function checkAggregator() {
  let aggregatorInstance = new web3.eth.Contract(
    aggregatorCompiled.abi,
    "0x701Bc4e141C20C07B63ef554752DE4Ea4b9636B1"
  );
  let result = await aggregatorInstance.methods
    .getTotalPending(
      [
        "0x22BDBd03753298df08f2103BCaDD0a53922A34c6",
        "0x63E508BAd8119a601CC7B70FD71fe351aB5689a4",
      ],
      [
        "0x6094367346ef75c7ae080Fdb46b0e8C8f378583d",
        "0xa83688C27B8c0c1B0EfaCE18f5f738BF63e3298D",
      ],
      [
        "0x27F9C69F1a95E1283D71F876687E5fC72ecD1116",
        "0x442fcB562FB9dA4F9F3F92CDB19843E83b0c5690",
      ]
    )
    .call({from: "15a9cdbf563a613d4a07c890ac7a404a17157236"});
  return result;
}

async function getAddressFromStakeRegistry() {
  let addressRegistryInstance = new web3.eth.Contract(
    addressRegistryCompiled.abi,
    "0x3a1e969A6B4C8623879d4acaA263114117c5BEF8"
  );

  let stakingAddressHash = await addressRegistryInstance.methods
    .reverseMap("0xdeff2cd841bd47592760ce068a113b8e594f8553")
    .call({from: "0xdeff2cd841bd47592760ce068a113b8e594f8553"});
  return stakingAddressHash;
}

// getAddressFromStakeRegistry().then(console.log).catch(console.log);

// checkBalance().then(console.log);
// checkAggregator().then(console.log);
checkDistributionContract().then(console.log).catch(console.log);
// deploy();
// deployAggregator();
// addSource().then(console.log).catch(console.log);
// changeRewardPerEpoch().then(console.log).catch(console.log);
// getRewardPerEpoch().then(console.log).catch(console.log);

//polkadot addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x27F9C69F1a95E1283D71F876687E5fC72ecD1116
// ValidatorRegistry address 0xC1423350f37c6F4a6E9F96435d50D70f95bBE499
// StakeRegistry address 0x22BDBd03753298df08f2103BCaDD0a53922A34c6
// AddressRegistry address 0x6094367346ef75c7ae080Fdb46b0e8C8f378583d
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// bsc addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x442fcB562FB9dA4F9F3F92CDB19843E83b0c5690
// ValidatorRegistry address 0x1c2cA415B14f96b17b64B9EE8b91191278953A0D
// StakeRegistry address 0x63E508BAd8119a601CC7B70FD71fe351aB5689a4
// AddressRegistry address 0xa83688C27B8c0c1B0EfaCE18f5f738BF63e3298D
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// iris addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xE8dcD0444B96beeD4A6Ad635A96508F8c350Eef0
// ValidatorRegistry address 0x37CcDC267B980Adb1f5e339CFc90D61e94B46037
// StakeRegistry address 0x3a1e969A6B4C8623879d4acaA263114117c5BEF8
// AddressRegistry address 0xd8630627d8c61aD2996dd945096818Cf8A8B333e
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// cosmos addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x24b712418d57C6f9b37FFfc0510B4cC591d38B94
// ValidatorRegistry address 0x9D227Cd7884D63596705885248DEB17EFd253f98
// StakeRegistry address 0x47498aa0d952b141538ab2312e1ECc2A1D736D8e
// AddressRegistry address 0x72Bb2cD5236a011AB04a7dbFd97e07C1A09536c3
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// near addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x355Dab58331109b64889eE7fd95550864602EE16
// ValidatorRegistry address 0x7af1cF644cE79E3be532Bb0B4E137bB1ea53d4B2
// StakeRegistry address 0x53dFc52FF52838122178587067980cf1139DF6b3
// AddressRegistry address 0x9be1E2F39c68300bB5d28B1DbEE36354C97f20b7
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// lto addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x4aA66ED1Fc82714852a09501fc7b2A7e9eFd5a55
// ValidatorRegistry address 0x376289b38CF6B271b82aAC8BCe9e603D8c33C2cC
// StakeRegistry address 0x863d74a7Fb677A8D931d0aAA373dFf7258ba2034
// AddressRegistry address 0x93Fd304D842907625a18A2EA331c3c03832a032B
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

// matic addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0x1501E3edDFfDc7cEfBdb49b636494Ae23583AddD
// ValidatorRegistry address 0x4a4521b507bC7EF071eF2D3d49d3B1B8EDd7A758
// StakeRegistry address 0xD026005DA7A9BFd38762B2Aa4891aC1d28BB2429
// AddressRegistry address 0x0Fa02d23ed5F24db1cB729563166a900274e530F
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

//fantom addresses
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
// Distribution address 0xD7564E6351e4e855469A8Ac847aBB8CCac5C7Bd8
// ValidatorRegistry address 0xB11787fC7575CcD7aD0BB53bFa93a2e85730A0c8
// StakeRegistry address 0xB7627c0cF0Eb4B9D504BB5391Dd73E612418FaB9
// AddressRegistry address 0x2af08cE9A1eCe86da46AC688e396eC5FD3a6fD8d
// %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%