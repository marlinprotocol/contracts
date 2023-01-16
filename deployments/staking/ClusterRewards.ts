import { ethers, run, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import * as fs from 'fs';
const config = require('./config');

export async function deploy(rewardDelegators: string, receiverStaking: string, epochSelectorMap: any): Promise<Contract> {
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

  const ClusterRewards = await ethers.getContractFactory('ClusterRewards');

  if(addresses[chainId]['ClusterRewards'] !== undefined) {
    console.log("Existing deployment:", addresses[chainId]['ClusterRewards']);
    return ClusterRewards.attach(addresses[chainId]['ClusterRewards']);
  }

  let signers = await ethers.getSigners();
  let addrs = await Promise.all(signers.map(a => a.getAddress()));

  const networkIds = [];
  const rewardWeights = [];
  const epochSelectors = [];

  for(let network in chainConfig.staking.rewardWeights) {
    networkIds.push(ethers.utils.id(network));
    rewardWeights.push(chainConfig.staking.rewardWeights[network]);
    epochSelectors.push(epochSelectorMap[network]);
  }

  let clusterRewards = await upgrades.deployProxy(ClusterRewards, [
    chainConfig.admin,
    rewardDelegators,
    receiverStaking,
    networkIds,
    rewardWeights,
    epochSelectors,
    chainConfig.totalRewardsPerEpoch
  ], { kind: "uups" });

  console.log("Deployed addr:", clusterRewards.address);

  addresses[chainId]['ClusterRewards'] = clusterRewards.address;

  fs.writeFileSync('address.json', JSON.stringify(addresses, null, 2), 'utf8');

  return clusterRewards;
}

export async function verify() {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(fs.existsSync('address.json')) {
    addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
  }

  if(addresses[chainId] === undefined || addresses[chainId]['ClusterRewards'] === undefined) {
    throw new Error("Cluster Rewards not deployed");
  }

  const implAddress = await upgrades.erc1967.getImplementationAddress(addresses[chainId]['ClusterRewards']);

  await run("verify:verify", {
    address: implAddress,
    constructorArguments: []
  });

  console.log("Cluster Rewards verified");
}