import { ethers, run } from "hardhat";
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

  let EpochSelector = await ethers.getContractFactory("EpochSelector");
  let epochSelector = await EpochSelector.deploy(
    addrs[0].address,
    5,
    blockData.timestamp,
    "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557", // should be pond address
    0
  );

  console.log("waiting for the transaction to deploy");
  await epochSelector.deployTransaction.wait(6);
  console.log("epoch selectors tx deploy complete");

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

// deploy().then(pump).then(console.log);

async function pump(contractAddress = epochSelectorAddress) {
  const EpochSelector = await ethers.getContractFactory("EpochSelector");
  const addressesPerBatch = 100;
  const epochSelector = EpochSelector.attach(contractAddress);

  const addresses = [];
  const balances = [];

  const times = 100;

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
  return "Done";
}

pump().then(console.log);

function randomAddressGenerator(rand: string): string {
  let address = keccak256(Buffer.from(rand)).toString().slice(0, 42);
  return address;
}

function getRandomNumber(): number {
  return Math.floor(Math.random() * 10000000000000) + 1;
}
