import { ethers, run, upgrades } from "hardhat";
import { Contract } from "ethers";
import * as fs from "fs";
const config = require('./config');

export async function deploy(network: string, rewardDelegators: string, admin?: string, startTime?: number, epochLength?: number, selectionReward?: { token:string, amount: string}, noLog?: boolean): Promise<Contract> {

  let chainId = (await ethers.provider.getNetwork()).chainId;

  const chainConfig = config[chainId];

  const EpochSelector = await ethers.getContractFactory("EpochSelectorUpgradeable");

  var addresses: { [key: string]: { [key: string]: string } } = {};
  if(!noLog) {
    console.log("Chain Id:", chainId);

    if (fs.existsSync("address.json")) {
      addresses = JSON.parse(fs.readFileSync("address.json", "utf8"));
    }
  
    if (addresses[chainId] === undefined) {
      addresses[chainId] = {};
    }
  
    if (addresses[chainId]["EpochSelector_"+network] !== undefined) {
      console.log("Existing deployment:", addresses[chainId]["EpochSelector_"+network]);
      return EpochSelector.attach(addresses[chainId]["EpochSelector_"+network]);
    }
  }

  if(selectionReward === undefined) {
    selectionReward = {
      token: chainConfig.selectionReward.token,
      amount: chainConfig.selectionReward.amount
    };
  }

  if(admin == undefined) {
    admin = chainConfig.admin;
  }

  if(startTime == undefined) startTime = chainConfig.startTime;
  if(epochLength == undefined) epochLength = chainConfig.epochLength;

  const epochSelector = await upgrades.deployProxy(EpochSelector, [
    admin,
    rewardDelegators,
    chainConfig.noOfClustersToSelect,
    selectionReward.token,
    selectionReward.amount
  ], {
    kind: "uups",
    constructorArgs: [startTime, epochLength]
  });

  if(!noLog) {
    console.log("Deployed addr:", epochSelector.address);
    
    addresses[chainId]["EpochSelector_"+network] = epochSelector.address;

    fs.writeFileSync("address.json", JSON.stringify(addresses, null, 2), "utf8");
  }

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