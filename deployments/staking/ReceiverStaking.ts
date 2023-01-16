import { ethers, run, upgrades } from 'hardhat';
import { Contract } from 'ethers';
import * as fs from 'fs';
const config = require('./config');


export async function deploy(): Promise<Contract> {
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

  const ReceiverStaking = await ethers.getContractFactory('ReceiverStaking');
  if(addresses[chainId]['ReceiverStaking'] !== undefined) {
    console.log("Existing deployment:", addresses[chainId]['ReceiverStaking']);
    return ReceiverStaking.attach(addresses[chainId]['ReceiverStaking']);
  }

  let signers = await ethers.getSigners();
  let addrs = await Promise.all(signers.map(a => a.getAddress()));

  let receiverStaking = await upgrades.deployProxy(ReceiverStaking, [ chainConfig.admin ], { 
    kind: "uups",
    constructorArgs: [
        chainConfig.startTime,
        chainConfig.epochLength,
        chainConfig.staking.receiver.token
    ]
  });

  console.log("Deployed addr:", receiverStaking.address);

  addresses[chainId]['ReceiverStaking'] = receiverStaking.address;

  fs.writeFileSync('address.json', JSON.stringify(addresses, null, 2), 'utf8');

  return receiverStaking;
}

export async function verify() {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  const chainConfig = config[chainId];

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(fs.existsSync('address.json')) {
    addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
  }

  if(addresses[chainId] === undefined || addresses[chainId]['ReceiverStaking'] === undefined) {
    throw new Error("Receiver Staking not deployed");
  }

  const implAddress = await upgrades.erc1967.getImplementationAddress(addresses[chainId]['ReceiverStaking']);

  await run("verify:verify", {
    address: implAddress,
    constructorArguments: [
      chainConfig.startTime,
      chainConfig.epochLength,
      chainConfig.staking.receiver.token
    ]
  });

  console.log("Receiver Staking verified");
}