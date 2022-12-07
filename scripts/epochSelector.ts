import { ethers, run, upgrades } from "hardhat";
import { keccak256 } from "ethers/lib/utils";

const epochSelectorAddress = "0xf1e710E6bb605Bcc7878994Cd88d53Ba6a960959";

async function deploy() {
  let signers = await ethers.getSigners();

  const addrs = await Promise.all(
    signers.map(async (a) => {
      return {
        address: await a.getAddress(),
        balance: (await a.getBalance()).toString(),
      };
    })
  );
  console.log("Signer addrs:", addrs);

  const blockNum = await ethers.provider.getBlockNumber();
  const blockData = await ethers.provider.getBlock(blockNum);

  let EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");
  let epochSelector = await upgrades.deployProxy(EpochSelector, [
    addrs[0].address,
    5,
    "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557", // should be pond address
    0
  ], {
    kind: "uups",
    constructorArgs: [blockData.timestamp]
  });

  console.log("waiting for the transaction to deploy");
  await epochSelector.deployTransaction.wait(5);
  console.log("EpochSelector Contract deploy complete");

  
  let role = await epochSelector.UPDATER_ROLE();
  let tx = await epochSelector.grantRole(role, addrs[0].address);
  await tx.wait();
  console.log("update role complete");

  await run("verify:verify", {
    address: epochSelector.address,
    constructorArguments: [
      addrs[0].address,
      5,
      blockData.timestamp,
      "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557", // should be pond address
      0,
    ],
    contract: "contracts/staking/EpochSelector.sol:EpochSelector",
  });

  return epochSelector.address;
}

deploy().then(pump).then(console.log);

async function pump(contractAddress = epochSelectorAddress) {
  const EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");
  const addressesPerBatch = 100;
  const epochSelector = EpochSelector.attach(contractAddress);

  const addresses = [];
  const balances = [];

  const times = 2;

  for (let j_index = 0; j_index < times; j_index++) {
    for (let index = 0; index < addressesPerBatch; index++) {
      const address = randomAddressGenerator("salt" + index + new Date().valueOf().toString());
      addresses.push(address);
      balances.push(getRandomNumber());
    }

    const tx = await epochSelector.insertMultiple(addresses, balances);
    await tx.wait();

    console.log(`Complete ${j_index}/${times}`);
  }

  console.log("Selecting clusters");
  const tx = await epochSelector.selectClusters();
  await tx.wait();
  console.log("Selecting clusters complete");

  return "Done";
}

// pump().then(console.log);

function randomAddressGenerator(rand: string): string {
  let address = keccak256(Buffer.from(rand)).toString().slice(0, 42);
  return address;
}

function getRandomNumber(): number {
  return Math.floor(Math.random() * 1000) + 1;
}
