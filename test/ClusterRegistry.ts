import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber as BN, Signer, Contract } from 'ethers';
import exp from 'constants';
import { sign } from 'crypto';
import cluster from 'cluster';
const appConfig = require("../app-config");

declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}

describe('ClusterRegistry Deployment', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRegistryOwner: Signer;
  let clusterRegistryInstance: Contract;
  const COMMISSION_LOCK = "0x7877e81172e1242eb265a9ff5a14c913d44197a6e15e0bc1d984f40be9096403";
  const SWITCH_NETWORK_LOCK = "0x18981a75d138782f14f3fbd4153783a0dc1558f28dc5538bf045e7de84cb2ae2";
  const UNREGISTER_LOCK = "0x027b176aae0bed270786878cbabc238973eac20b1957aae44b82a73cc8c7080c";
  const DOTHASH = "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f";
  let rewardAddress: string;
  let clientKey: string;
  let registeredCluster: Signer;
  let registeredCluster1: Signer;
  let unregisteredCluster: Signer;
  let updatedRewardAddress: string;
  let updatedClientKey: string;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    //MpondAccount = signers[3];
    clusterRegistryOwner = signers[5];
    rewardAddress = addrs[6];
    clientKey = addrs[7];
    registeredCluster = signers[8];
    registeredCluster1 = signers[9];
    unregisteredCluster = signers[10];
    updatedRewardAddress = addrs[11];
    updatedClientKey = addrs[12];
    //clusterRewardsOwner = addrs[6];
    //feeder = addrs[7];
    //rewardDelegatorsOwner = addrs[8];
    //stakeManagerOwner = signers[9];
  });

  it('deploys with initialization disabled', async function () {

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
    clusterRegistryInstance = await ClusterRegistry.deploy();
    await expect(clusterRegistryInstance.initialize(selectors, lockWaitTimes, await clusterRegistryOwner.getAddress())).to.be.reverted;

  });


  it('deploys as proxy and initializes', async function () {

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
    clusterRegistryInstance = await upgrades.deployProxy(ClusterRegistry, [selectors, lockWaitTimes,await clusterRegistryOwner.getAddress()],{ kind: "uups" });

    expect((await clusterRegistryInstance.owner()).toString()).to.equal(await clusterRegistryOwner.getAddress());
    expect((await clusterRegistryInstance.lockWaitTime(selectors[0])).toString()).to.equal(lockWaitTimes[0].toString());
  });

  it('upgrades', async function () {

    const selectors = [COMMISSION_LOCK, SWITCH_NETWORK_LOCK, UNREGISTER_LOCK];
    const lockWaitTimes = [20, 21, 22];
    const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
    await upgrades.upgradeProxy(clusterRegistryInstance.address, ClusterRegistry.connect(clusterRegistryOwner),{kind: "uups"});

    expect((await clusterRegistryInstance.owner()).toString()).to.equal(await clusterRegistryOwner.getAddress());
    expect((await clusterRegistryInstance.lockWaitTime(selectors[0])).toString()).to.equal(lockWaitTimes[0].toString());
  });

  it('does not upgrade without admin', async function () {

    const ClusterRegistry = await ethers.getContractFactory('ClusterRegistry');
    await expect(upgrades.upgradeProxy(clusterRegistryInstance.address, ClusterRegistry.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });

  it("Register cluster", async () => {
    await expect(clusterRegistryInstance.connect(registeredCluster).register(DOTHASH,  101, rewardAddress, clientKey)).to.be.reverted;
    
    await clusterRegistryInstance.connect(registeredCluster).register(DOTHASH, 7, rewardAddress, clientKey);
    await expect(clusterRegistryInstance.register(DOTHASH,7, rewardAddress, clientKey)).to.be.reverted;

    const clusterData = await clusterRegistryInstance.callStatic.getCluster(await registeredCluster.getAddress());
    expect(clusterData.commission).to.equal(7);
    expect(clusterData.networkId).to.equal(DOTHASH);
    expect(clusterData.rewardAddress).to.equal(rewardAddress);
    expect(clusterData.isValidCluster).to.be.true;
  });
  
  it("Register cluster with same client key twice", async () => {

    await expect(clusterRegistryInstance.connect(registeredCluster1).register(DOTHASH, 7, rewardAddress, clientKey)).to.be.reverted;
  });

  it("update commission", async () => {

    await expect(clusterRegistryInstance.connect(unregisteredCluster).updateCommission(15)).to.be.reverted;
    
    const prevCommission = parseInt((await clusterRegistryInstance.callStatic.getCommission(await registeredCluster.getAddress())).toString());
    await clusterRegistryInstance.connect(registeredCluster).updateCommission(15);

    const afterUpdateCommission = parseInt((await clusterRegistryInstance.callStatic.getCommission(await registeredCluster.getAddress())).toString());
    expect(prevCommission).to.equal(afterUpdateCommission);
    
    await skipBlocks(20);
    const justBeforeUpdateCommission = parseInt((await clusterRegistryInstance.callStatic.getCommission(await registeredCluster.getAddress())).toString());
    expect(justBeforeUpdateCommission).to.equal(prevCommission);

    await skipBlocks(1);
    const afterWaitCommission = parseInt((await clusterRegistryInstance.callStatic.getCommission(await registeredCluster.getAddress())).toString());
    expect(afterWaitCommission).to.equal(15);
  });

  it("switch network", async () => {
    const NEARHASH = ethers.utils.id("NEAR");
    await expect(clusterRegistryInstance.connect(unregisteredCluster).switchNetwork(NEARHASH)).to.be.reverted;
    const prevNetwork = await clusterRegistryInstance.callStatic.getNetwork(await registeredCluster.getAddress());
    await clusterRegistryInstance.connect(registeredCluster).switchNetwork(NEARHASH);
    const networkAfterSwitch = await clusterRegistryInstance.callStatic.getNetwork(await registeredCluster.getAddress());
    expect(prevNetwork).to.equal(networkAfterSwitch);
  
    await skipBlocks(21);
    const justBeforeSwitchNetwork = await clusterRegistryInstance.callStatic.getNetwork(await registeredCluster.getAddress());
    expect(justBeforeSwitchNetwork).to.equal(prevNetwork);
    
    await skipBlocks(1);
    const afterSwitchNetwork = await clusterRegistryInstance.callStatic.getNetwork(await registeredCluster.getAddress());
    expect(afterSwitchNetwork).to.equal(NEARHASH);
  });

  it("update reward address", async () => {

    await expect(clusterRegistryInstance.connect(unregisteredCluster).updateRewardAddress(updatedRewardAddress)).to.be.reverted;
    const prevRewardAddress = await clusterRegistryInstance.getRewardAddress(await registeredCluster.getAddress());
    await clusterRegistryInstance.connect(registeredCluster).updateRewardAddress(updatedRewardAddress);
    const afterUpdateAddress = await clusterRegistryInstance.getRewardAddress(await registeredCluster.getAddress());
    expect(prevRewardAddress).to.not.equal(afterUpdateAddress);
    expect(afterUpdateAddress).to.equal(updatedRewardAddress);
  });

  it("update client key", async () => {
    await expect(clusterRegistryInstance.connect(unregisteredCluster).updateClientKey(updatedClientKey)).to.be.reverted;
    const prevClientKey = await clusterRegistryInstance.callStatic.getClientKey(await registeredCluster.getAddress());
    await clusterRegistryInstance.connect(registeredCluster).updateClientKey(updatedClientKey);
    const afterClientKey = await clusterRegistryInstance.callStatic.getClientKey(await registeredCluster.getAddress());
    expect(prevClientKey).to.not.equal(afterClientKey);
    expect(afterClientKey).to.equal(updatedClientKey);
  });

  it("update cluster params", async () => {
    await expect(clusterRegistryInstance.connect(unregisteredCluster).updateCluster(7, DOTHASH,rewardAddress,clientKey)).to.be.reverted;

    const clusterData = await clusterRegistryInstance.callStatic.getCluster(await registeredCluster.getAddress());
    await clusterRegistryInstance.connect(registeredCluster).updateCluster(7, DOTHASH, rewardAddress, clientKey);
    const clusterDataAfterUpdate = await clusterRegistryInstance.callStatic.getCluster(await registeredCluster.getAddress());
    expect(clusterData.clientKey).to.not.equal(clusterDataAfterUpdate.clientKey);
    expect(clusterDataAfterUpdate.clientKey).to.equal(clientKey);
    expect(clusterData.rewardAddress).to.not.equal(clusterDataAfterUpdate.rewardAddress);
    expect(clusterDataAfterUpdate.rewardAddress).to.equal(rewardAddress);
    expect(clusterData.commission.toString()).to.equal(clusterDataAfterUpdate.commission.toString());
    expect(clusterData.networkId).to.equal(clusterDataAfterUpdate.networkId);
    await skipBlocks(20);
    const justBeforeUpdateCommission = parseInt((await clusterRegistryInstance.callStatic.getCommission(await registeredCluster.getAddress())).toString());
    expect(justBeforeUpdateCommission).to.equal(parseInt(clusterData.commission.toString()));
    await skipBlocks(1);
    const afterWaitCommission = parseInt((await clusterRegistryInstance.callStatic.getCommission(await registeredCluster.getAddress())).toString());
    expect(afterWaitCommission).to.equal(7);
    const justBeforeSwitchNetwork = await clusterRegistryInstance.callStatic.getNetwork(await registeredCluster.getAddress());
    expect(justBeforeSwitchNetwork).to.equal(clusterData.networkId);
    await skipBlocks(1);
    const afterSwitchNetwork = await clusterRegistryInstance.callStatic.getNetwork(await registeredCluster.getAddress());
    expect(afterSwitchNetwork).to.equal(DOTHASH);
  });

  it("Unregister cluster", async () => {
    await expect(clusterRegistryInstance.connect(unregisteredCluster).unregister()).to.be.reverted;

    expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress())).to.be.true;
    await clusterRegistryInstance.connect(registeredCluster).unregister();
    expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress())).to.be.true;
    await skipBlocks(21);
    expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress())).to.be.true;
    await skipBlocks(2);
    expect(await clusterRegistryInstance.callStatic.isClusterValid(await registeredCluster.getAddress())).to.be.false;
  });;

  async function skipBlocks(blocks: Number) {
    const unregisteredClusterAddress = await unregisteredCluster.getAddress();
    for(let i=0; i < blocks; i++) {
        await clusterRegistryInstance.getNetwork(unregisteredClusterAddress);
    }
  }
});



