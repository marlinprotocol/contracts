import { ethers, run, upgrades } from "hardhat";
import { Contract } from "ethers";
import * as fs from "fs";
import { upgrade as upgradeUtil } from './Upgrade';
const config = require('./config');

export async function deploy(network: string, rewardDelegators: string, arbGasInfo?: string, admin?: string, startTime?: number, epochLength?: number, gasRefund?: string, maxGasPrice?: number, maxBaseL1Gas?: number, noLog?: boolean): Promise<Contract> {

  let chainId = (await ethers.provider.getNetwork()).chainId;

  const chainConfig = config[chainId];

  const ClusterSelector = await ethers.getContractFactory("ClusterSelector");

  var addresses: { [key: string]: { [key: string]: string } } = {};
  if(!noLog) {
    console.log("Chain Id:", chainId);

    if (fs.existsSync("address.json")) {
      addresses = JSON.parse(fs.readFileSync("address.json", "utf8"));
    }

    if (addresses[chainId] === undefined) {
      addresses[chainId] = {};
    }

    if (addresses[chainId]["ClusterSelector_"+network] !== undefined) {
      console.log("Existing deployment:", addresses[chainId]["ClusterSelector_"+network]);
      return ClusterSelector.attach(addresses[chainId]["ClusterSelector_"+network]);
    }
  }

  if(gasRefund === undefined) {
    gasRefund = chainConfig.clusterSelection.gasRefund;
  }

  if(admin == undefined) {
    admin = chainConfig.admin;
  }

  if(startTime == undefined) startTime = chainConfig.startTime;
  if(epochLength == undefined) epochLength = chainConfig.epochLength;
  if(arbGasInfo == undefined) arbGasInfo = chainConfig.arbGasInfo;
  if(maxGasPrice == undefined) maxGasPrice = chainConfig.clusterSelection.maxGasPrice;
  if(maxBaseL1Gas == undefined) maxBaseL1Gas = chainConfig.clusterSelection.maxBaseL1Gas;

  const clusterSelector = await upgrades.deployProxy(ClusterSelector, [
    admin,
    rewardDelegators,
    gasRefund
  ], {
    kind: "uups",
    constructorArgs: [startTime, epochLength, arbGasInfo, maxGasPrice, maxBaseL1Gas]
  });

  if(!noLog) {
    console.log("Deployed addr:", clusterSelector.address);

    addresses[chainId]["ClusterSelector_"+network] = clusterSelector.address;

    fs.writeFileSync("address.json", JSON.stringify(addresses, null, 2), "utf8");
  }

  return clusterSelector;
}

export async function upgrade(network: string, startTime?: string, epochLength?: number, arbGasInfo?: string, maxGasPrice?: number, maxBaseL1Gas?: number) {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  const chainConfig = config[chainId];

  if(startTime == undefined) startTime = chainConfig.startTime;
  if(epochLength == undefined) epochLength = chainConfig.epochLength;
  if(arbGasInfo == undefined) arbGasInfo = chainConfig.arbGasInfo;
  if(maxGasPrice == undefined) maxGasPrice = chainConfig.clusterSelection.maxGasPrice;
  if(maxBaseL1Gas == undefined) maxBaseL1Gas = chainConfig.clusterSelection.maxBaseL1Gas;

  await upgradeUtil("ClusterSelector", `ClusterSelector_${network}`, [
    startTime, epochLength, arbGasInfo, maxGasPrice, maxBaseL1Gas
  ]);
}

export async function verify(network: string) {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  const chainConfig = config[chainId];

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(fs.existsSync('address.json')) {
    addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
  }

  if(addresses[chainId] === undefined || addresses[chainId]["ClusterSelector_"+network] === undefined) {
    throw new Error("Cluster Selector not deployed");
  }

  const implAddress = await upgrades.erc1967.getImplementationAddress(addresses[chainId]["ClusterSelector_"+network]);

  await run("verify:verify", {
    address: implAddress,
    constructorArguments: [chainConfig.startTime, chainConfig.epochLength, chainConfig.arbGasInfo, chainConfig.clusterSelection.maxGasPrice, chainConfig.clusterSelection.maxBaseL1Gas]
  });

  console.log("Cluster Selector verified");
}