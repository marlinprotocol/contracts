import { ethers, upgrades } from "hardhat";
import { BigNumber, BigNumberish, Signer, utils, Wallet } from "ethers";
import { deploy as deployClusterRewards } from "../../deployments/staking/ClusterRewards";
import { deploy as deployClusterSelector } from "../../deployments/staking/ClusterSelector";
import { deploy as deployReceiverStaking } from "../../deployments/staking/ReceiverStaking";

import { ArbGasInfo__factory } from "../../typechain-types"

const EPOCH_LENGTH = 15 * 60;

export async function deployFixture() {
  const signers = await ethers.getSigners();
  const addrs = await Promise.all(signers.map((a) => a.getAddress()));

  const blockNum = await ethers.provider.getBlockNumber();
  const blockData = await ethers.provider.getBlock(blockNum);

  const Pond = await ethers.getContractFactory("Pond");
  const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
    kind: "uups",
  });

  const mockArbGas = await new ArbGasInfo__factory().connect(signers[0]).deploy()
  mockArbGas.setPrices(10000, 10000 ,10000);

  const receiverStaking = await deployReceiverStaking(addrs[0], blockData.timestamp, EPOCH_LENGTH, pond.address, true);

  const clusterSelector = await deployClusterSelector(
    "ETH",
    addrs[1],
    mockArbGas.address,
    addrs[0],
    blockData.timestamp,
    EPOCH_LENGTH,
    "10000000",
    ethers.utils.parseEther("1").toString(),
    true
  );

  const clusterRewards = await deployClusterRewards(
    addrs[1], // reward delegators is mocked, ideally this should be reward delegators
    receiverStaking.address,
    {
      ETH: clusterSelector.address,
    },
    pond.address,
    addrs[0],
    true
  );

  return {
    pond,
    receiverStaking,
    clusterSelector,
    clusterRewards,
    admin: signers[0],
    rewardDelegatorsMock: signers[1],
  };
}

export async function initDataFixture() {
  const nodesToInsert: number = 75;
  const receiverCount: number = 100;

  const signers = await ethers.getSigners();
  const preAllocEthSigner = signers[8];

  const { pond, receiverStaking, clusterSelector, clusterRewards, admin, rewardDelegatorsMock } = await deployFixture();

  const tokenSupply: BigNumber = await pond.totalSupply();

  const clusters: string[] = [];
  const balances: BigNumberish[] = [];
  const receivers: Signer[] = [];
  const receiverSigners: Signer[] = [];

  // generate clusters and balance data
  for (let i = 0; i < nodesToInsert; i++) {
    const address = Wallet.createRandom().address;
    clusters.push(address);
    balances.push(BigNumber.from(ethers.utils.randomBytes(32)).mod(tokenSupply.div(utils.parseEther(nodesToInsert + ""))));
  }

  // insert clusterData into selector
  for (let i = 0; i < clusters.length; i += 50) {
    await clusterSelector.connect(rewardDelegatorsMock).upsertMultiple(clusters.slice(i, i + 50), balances.slice(i, i + 50));
  }

  for (let i = 0; i < receiverCount; i++) {
    // create receiver and stake
    const receiver = Wallet.createRandom().connect(ethers.provider);
    const receiverSigner = Wallet.createRandom().connect(ethers.provider);
    receivers.push(receiver);
    receiverSigners.push(receiverSigner);
    const depositAmount = BigNumber.from(ethers.utils.randomBytes(32)).mod(tokenSupply.div(receiverCount));
    await preAllocEthSigner.sendTransaction({
      to: receiver.address,
      value: utils.parseEther("0.5").toString(),
    });
    await preAllocEthSigner.sendTransaction({
      to: receiverSigner.address,
      value: utils.parseEther("0.5").toString(),
    });
    await pond.transfer(receiver.address, depositAmount);
    await pond.connect(receiver).approve(receiverStaking.address, depositAmount);
    await receiverStaking.connect(receiver)["depositFor(uint256,address)"](depositAmount, receiver.address);
    await receiverStaking.connect(receiver).setSigner(receiverSigner.address);
  }

  return {
    pond,
    receiverStaking,
    clusterSelector,
    clusterRewards,
    admin,
    rewardDelegatorsMock,
    nodesInserted: nodesToInsert,
    receivers,
    receiverSigners,
  };
}
