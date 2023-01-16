import { ethers, run, upgrades } from "hardhat";
import { Contract } from "ethers";
import * as fs from "fs";
const config = require('./config');

export async function deploy(network: string, rewardDelegators: string): Promise<Contract> {

  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  const chainConfig = config[chainId];

  var addresses: { [key: string]: { [key: string]: string } } = {};
  if (fs.existsSync("address.json")) {
    addresses = JSON.parse(fs.readFileSync("address.json", "utf8"));
  }

  if (addresses[chainId] === undefined) {
    addresses[chainId] = {};
  }

  const EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");
  if (addresses[chainId]["EpochSelector_"+network] !== undefined) {
    console.log("Existing deployment:", addresses[chainId]["EpochSelector_"+network]);
    return EpochSelector.attach(addresses[chainId]["EpochSelector_"+network]);
  }

  let signers = await ethers.getSigners();

  const epochSelector = await upgrades.deployProxy(EpochSelector, [
    chainConfig.admin,
    rewardDelegators,
    chainConfig.noOfClustersToSelect,
    chainConfig.selectionReward.token,
    chainConfig.selectionReward.amount
  ], {
    kind: "uups",
    constructorArgs: [chainConfig.startTime, chainConfig.epochLength]
  });

  console.log("Deployed addr:", epochSelector.address);

  addresses[chainId]["EpochSelector_"+network] = epochSelector.address;

  fs.writeFileSync("address.json", JSON.stringify(addresses, null, 2), "utf8");

  return epochSelector;
}

export async function verify(network: string) {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  const chainConfig = config[chainId];

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(fs.existsSync('address.json')) {
    addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
  }

  if(addresses[chainId] === undefined || addresses[chainId]["EpochSelector_"+network] === undefined) {
    throw new Error("Epoch Selector not deployed");
  }

  const implAddress = await upgrades.erc1967.getImplementationAddress(addresses[chainId]["EpochSelector_"+network]);

  await run("verify:verify", {
    address: implAddress,
    constructorArguments: [chainConfig.startTime, chainConfig.epochLength]
  });

  console.log("Epoch Selector verified");
}