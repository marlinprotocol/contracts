import { ethers, upgrades, run } from 'hardhat';
import { Contract } from 'ethers';
import * as fs from 'fs';
import { upgrade as upgradeUtil } from '../utils/Upgrade';

export async function deploy(noLog?: boolean): Promise<Contract> {
  let chainId = (await ethers.provider.getNetwork()).chainId;

  const MarketV1 = await ethers.getContractFactory('MarketV1');

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(!noLog) {
    console.log("Chain Id:", chainId);

    if(fs.existsSync('address.json')) {
      addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
    }
  
    if(addresses[chainId] === undefined) {
      addresses[chainId] = {};
    }
  
    if(addresses[chainId]['MarketV1'] !== undefined) {
      console.log("Existing deployment:", addresses[chainId]['MarketV1']);
      return MarketV1.attach(addresses[chainId]['MarketV1']);
    }
  }

  // TODO: Add RATE_LOCK to config
  let marketV1 = await upgrades.deployProxy(MarketV1, [
    addresses[chainId]['Pond'],
    [ethers.utils.id('RATE_LOCK')],
    [300],
  ], { kind: "uups" });

  if(!noLog) {
    console.log("Deployed addr:", marketV1.address);

    addresses[chainId]['MarketV1'] = marketV1.address;

    fs.writeFileSync('address.json', JSON.stringify(addresses, null, 2), 'utf8');
  }

  return marketV1;
}

export async function upgrade() {
  await upgradeUtil('MarketV1', 'MarketV1', []);
}

export async function verify() {
  let chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("Chain Id:", chainId);

  var addresses: {[key: string]: {[key: string]: string}} = {};
  if(fs.existsSync('address.json')) {
    addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
  }

  if(addresses[chainId] === undefined || addresses[chainId]['MarketV1'] === undefined) {
    throw new Error("MarketV1 not deployed");
  }

  const implAddress = await upgrades.erc1967.getImplementationAddress(addresses[chainId]['MarketV1']);

  await run("verify:verify", {
    address: implAddress,
    constructorArguments: []
  });

  console.log("MarketV1 verified");
}