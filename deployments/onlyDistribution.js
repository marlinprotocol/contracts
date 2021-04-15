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

const distribution = require("../build/contracts/Distribution.json");

const tokenAddress = "0x27B064fE4B708fDa0fD0C4ff2b78a1e4DAB812D1";
// const tokenAddress = "0xd871906eBb5A1F53411e58F8ddd04c526Ae2217b"; // this is jus testing

async function deploy(
  validatorRegistryAddress,
  stakeRegistryAddress,
  addressRegistryAddress
) {
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
  console.log(distributionAddress);
  console.log(`----------------------------------------------------`);
}

async function deployAll() {
  let allMajorContrats = [
    {
      name: "polkadot",
      validatorRegistryAddress: "0xF67d3E8BCb72F0603C3d78da720322645B54B28b",
      stakeRegistryAddress: "0x4ab72Ca6b3dF67676EcA7c11afAB4E2B2F04EE18",
      addressRegistryAddress: "0xDef9961bB454943bB5E74a9D626Db842a69fDB78",
    },
    {
      name: "bsc",
      validatorRegistryAddress: "0x1bd356291b6e45C150B56c3d2600335eEFfE9d04",
      stakeRegistryAddress: "0x4874e852D2FDCcA5F0B3C27f7d7D3c031c5B78a8",
      addressRegistryAddress: "0xeF39741327B98784D5dd4F363D36478340Dc2F91",
    },
    {
      name: "iris",
      validatorRegistryAddress: "0x99009EF8B6792218E2815f63fE3B6eDbdBC8D510",
      stakeRegistryAddress: "0x5216748ec4F387fDe4f6aF3A0283967F87BEeA17",
      addressRegistryAddress: "0x739fA5B3Bb0fdF80C648c982D7E05D01Ee09c2AE",
    },
    {
      name: "cosmos",
      validatorRegistryAddress: "0xfD489D37332058CC44E7A4F450095C8511954AC6",
      stakeRegistryAddress: "0xe79282eC349bcBE1cfa3e0EeD97c5f01e4cdC24e",
      addressRegistryAddress: "0x1737EA50A8A1B715F09Cd0566E3C9AD2e4E5F836",
    },
    {
      name: "near",
      validatorRegistryAddress: "0x0E4C2d7267fE126e25784D866C0Ff3fD65b27A20",
      stakeRegistryAddress: "0xeC19845b2E43cbE1a028F182649d1ce9e6740feb",
      addressRegistryAddress: "0xb50B82D9d9e6b1bEa90305E5fe776e55C4258324",
    },
    {
      name: "lto",
      validatorRegistryAddress: "0x3334936a7fB2A2C03E466d52eB2a84a5deD74114",
      stakeRegistryAddress: "0x8cFC6733f26b5E920fD5b53340B893CE7A368683",
      addressRegistryAddress: "0x21B3333098Ded3Df3dfD932f18BD6D4A9750eB43",
    },
    {
      name: "matic",
      validatorRegistryAddress: "0x97D79F4d00A00d918De165DBf47BA606BD6B7164",
      stakeRegistryAddress: "0xFC82374Afa1C1852325692246bB88f081a2019f1",
      addressRegistryAddress: "0x6Fa241246A61CF427d7620664c44E0F4fA3B92f9",
    },
  ];

  for (let index = 0; index < allMajorContrats.length; index++) {
    const {
      name,
      validatorRegistryAddress,
      stakeRegistryAddress,
      addressRegistryAddress,
    } = allMajorContrats[index];
    console.log(`---------------------${name}-----------------`);
    await deploy(
      validatorRegistryAddress,
      stakeRegistryAddress,
      addressRegistryAddress
    );
  }
}

async function check() {
  let distributionInstance = new web3.eth.Contract(
    distribution.abi,
    "0x2ef72f4cb462421c17a4d90e08c568b9e0aa5ee7"
  );
  let result = distributionInstance.methods
    .getUnclaimedAmount()
    .call({from: "0x0b7f59b78e3ddae9a693c3ebf90f7e5de7749b89"});
  return result;
}
// deployAll().then(console.log).catch(console.log);

check().then(console.log).catch(console.log);
//