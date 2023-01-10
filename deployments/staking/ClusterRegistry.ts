import { ethers, upgrades, run } from 'hardhat';
import { BigNumber as BN, Contract } from 'ethers';
import * as fs from 'fs';
const config = require('./config');

declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}


export async function deploy(rewardDelegatorsAddress: string): Promise<Contract> {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  const chainConfig = config[chainId];

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(fs.existsSync('address.json')) {
    addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
  }

  if(addresses[chainId] === undefined) {
    addresses[chainId] = {};
  }

  const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
  if(addresses[chainId]['ClusterRegistry'] !== undefined) {
    console.log("Existing deployment:", addresses[chainId]['ClusterRegistry']);
    return ClusterRegistry.attach(addresses[chainId]['ClusterRegistry']);
  }

  let signers = await ethers.getSigners();
  let addrs = await Promise.all(signers.map(a => a.getAddress()));

  const waitTimes = chainConfig.cluster.waitTimes;

  let clusterRegistry = await upgrades.deployProxy(ClusterRegistry, [waitTimes, rewardDelegatorsAddress], { kind: "uups" });

  console.log("Deployed addr:", clusterRegistry.address);

  addresses[chainId]['ClusterRegistry'] = clusterRegistry.address;

  fs.writeFileSync('address.json', JSON.stringify(addresses, null, 2), 'utf8');

  return clusterRegistry;
}

export async function verify() {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(fs.existsSync('address.json')) {
    addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
  }

  if(addresses[chainId] === undefined || addresses[chainId]['ClusterRegistry'] === undefined) {
    throw new Error("Cluster Registry not deployed");
  }

  const implAddress = await upgrades.erc1967.getImplementationAddress(addresses[chainId]['ClusterRegistry']);

  await run("verify:verify", {
    address: implAddress,
    constructorArguments: []
  });

  console.log("Cluster Registry verified");
}