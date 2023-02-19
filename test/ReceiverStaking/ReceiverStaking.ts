import { ethers, network, upgrades } from "hardhat";
import { BigNumber as BN, Signer, Contract } from "ethers";
import { expect } from "chai";

const timeToStart = 24 * 60 * 60;
const runs = 100;

const EPOCH_LENGTH = 4 * 60 * 60;

describe("Receiver Staking before start", function () {
  let signers: Signer[];
  let signerAddresses: string[];
  let receiverStaking: Contract;
  let stakingToken: Contract;
  let START_TIME: number;
  let admin: Signer;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    admin = signers[signers.length - 1];
    signerAddresses = await Promise.all(signers.map((signer) => signer.getAddress()));
    const stakingTokenFactory = await ethers.getContractFactory("Pond");
    stakingToken = await (await upgrades.deployProxy(stakingTokenFactory, ["Marlin", "POND"], { kind: "uups" })).deployed();
    const receiverStakingFactory = await ethers.getContractFactory("ReceiverStaking");
    START_TIME = (await ethers.provider.getBlock("latest")).timestamp + timeToStart;
    // Note: Initialized
    receiverStaking = await (
      await upgrades.deployProxy(receiverStakingFactory, [await admin.getAddress()], {
        kind: "uups",
        constructorArgs: [START_TIME, EPOCH_LENGTH, stakingToken.address],
      })
    ).deployed();
  });

  it.only("deposit and withdraw before start", async () => {
    const user: Signer = signers[1];
    const signerAddress: string = await signers[2].getAddress();
    const anotherUser: Signer = signers[3];
    const anotherSignerAddress: string = await signers[4].getAddress();;
    const amount: BN = BN.from(parseInt(Math.random() * 1000 + "") + "0000000000000000");
    const anotherAmount: BN = BN.from(parseInt(Math.random() * 1000 + "") + "0000000000000000");
    const withdrawAmount: BN = amount.mul(Math.floor(Math.random() * 10000)).div(10000);
    const anotherWithdrawAmount: BN = anotherAmount.mul(Math.floor(Math.random() * 10000)).div(10000);

    const userAddress = await user.getAddress();
    await stakingToken.transfer(userAddress, amount);
    await stakingToken.connect(user).approve(receiverStaking.address, amount);
    // deposit in 2 parts
    const firstPartOfDeposit: BN = amount.mul(Math.floor(Math.random() * 9999 + 1)).div(10000);
    await receiverStaking.connect(user)["deposit(uint256,address)"](firstPartOfDeposit, signerAddress);

    const anotherUserAddress = await anotherUser.getAddress();
    await stakingToken.transfer(anotherUserAddress, anotherAmount);
    await stakingToken.connect(anotherUser).approve(receiverStaking.address, anotherAmount);
    // deposit in 2 parts
    const anotherFirstPartOfDeposit: BN = anotherAmount.mul(Math.floor(Math.random() * 9999 + 1)).div(10000);
    await receiverStaking.connect(anotherUser)["deposit(uint256,address)"](anotherFirstPartOfDeposit, anotherSignerAddress);

    // check balances after first deposit
    expect(await receiverStaking.balanceOf(userAddress)).to.equal(firstPartOfDeposit);
    expect(await receiverStaking.balanceOf(anotherUserAddress)).to.equal(anotherFirstPartOfDeposit);
    expect(await receiverStaking.totalSupply()).to.equal(firstPartOfDeposit.add(anotherFirstPartOfDeposit));

    // deposit remaining amount
    await receiverStaking.connect(user)["deposit(uint256)"](amount.sub(firstPartOfDeposit));
    await receiverStaking.connect(anotherUser)["deposit(uint256)"](anotherAmount.sub(anotherFirstPartOfDeposit));

    // cant get data for 0th epoch
    await expect(receiverStaking.getEpochInfo(0)).to.be.revertedWith("ERC20Snapshot: id is 0");
    // cant get data for future epochs
    await expect(receiverStaking.getEpochInfo(1)).to.be.revertedWith("ERC20Snapshot: nonexistent id");
    await expect(receiverStaking.getEpochInfo(4)).to.be.revertedWith("ERC20Snapshot: nonexistent id");

    // check balances after deposit
    expect(await receiverStaking.balanceOf(userAddress)).to.equal(amount);
    expect(await receiverStaking.balanceOf(anotherUserAddress)).to.equal(anotherAmount);
    expect(await receiverStaking.totalSupply()).to.equal(anotherAmount.add(amount));

    // TODO: Add test for withdraw from random address which might not have balance
    // can't withdraw more than what is deposited
    await expect(receiverStaking.connect(user).withdraw(amount.add(1))).to.be.revertedWith("ERC20: burn amount exceeds balance");
    await expect(receiverStaking.connect(anotherUser).withdraw(anotherAmount.add(1))).to.be.revertedWith("ERC20: burn amount exceeds balance");

    // withdraw some part of deposit
    await receiverStaking.connect(user).withdraw(withdrawAmount);
    await receiverStaking.connect(anotherUser).withdraw(anotherWithdrawAmount);

    // check balances after withdraw
    expect(await receiverStaking.balanceOf(userAddress)).to.equal(amount.sub(withdrawAmount));
    expect(await receiverStaking.balanceOf(anotherUserAddress)).to.equal(anotherAmount.sub(anotherWithdrawAmount));
    expect(await receiverStaking.totalSupply()).to.equal(anotherAmount.add(amount).sub(withdrawAmount).sub(anotherWithdrawAmount));

    await timeTravel(timeToStart);

    const {totalStake, currentEpoch} = await receiverStaking.getEpochInfo(1);
    expect(currentEpoch).to.equal(1, "Incorrect epoch at start");
    // check user balances
    expect(await receiverStaking.balanceOf(user)).to.equal(amount.sub(withdrawAmount), "incorrect user balance");
    expect(await receiverStaking.balanceOfAt(user, 1).to.equal(amount.sub(withdrawAmount), "incorrect user balance at epoch 1"));
    expect(await receiverStaking.balanceOfSignerAt(signerAddress, 1)).to.equal(amount.sub(withdrawAmount), "incorrect user balance by signer at epoch 1");
    // check another user balances
    expect(await receiverStaking.balanceOf(anotherUser)).to.equal(anotherAmount.sub(anotherWithdrawAmount), "incorrect user balance");
    expect(await receiverStaking.balanceOfAt(anotherUser, 1).to.equal(anotherAmount.sub(anotherWithdrawAmount), "incorrect user balance at epoch 1"));
    expect(await receiverStaking.balanceOfSignerAt(anotherSignerAddress, 1)).to.equal(anotherAmount.sub(anotherWithdrawAmount), "incorrect user balance by signer at epoch 1");
    // check total supply
    expect(await receiverStaking.totalSupply()).to.equal(amount.add(anotherAmount).sub(withdrawAmount).sub(anotherWithdrawAmount), "incorrect total supply");
    expect(await receiverStaking.totalSupplyAt(1)).to.equal(amount.add(anotherAmount).sub(withdrawAmount).sub(anotherWithdrawAmount), "incorrect total supply at epoch 1");
  });

  describe.only("Deposit before start", async () => {
    const user: Signer = signers[1];
    const signerAddress: string = await signers[2].getAddress();
    const anotherUser: Signer = signers[3];
    const anotherSignerAddress: string = await signers[4].getAddress();;
    const amount: BN = BN.from(parseInt(Math.random() * 1000 + "") + "0000000000000000");
    const anotherAmount: BN = BN.from(parseInt(Math.random() * 1000 + "") + "0000000000000000");

    beforeEach(async () => {
      const userAddress = await user.getAddress();
      await stakingToken.transfer(userAddress, amount);
      await stakingToken.connect(user).approve(receiverStaking.address, amount);
      await receiverStaking.connect(user)["deposit(uint256,address)"](amount, signerAddress);

      const anotherUserAddress = await anotherUser.getAddress();
      await stakingToken.transfer(anotherUserAddress, anotherAmount);
      await stakingToken.connect(anotherUser).approve(receiverStaking.address, anotherAmount);
      await receiverStaking.connect(anotherUser)["deposit(uint256,address)"](anotherAmount, anotherSignerAddress);

      await timeTravel(timeToStart);
    });

    it("check balances for epoch 1", async () => {
      const {totalStake, currentEpoch} = await receiverStaking.getEpochInfo(1);
      expect(currentEpoch).to.equal(1, "Incorrect epoch at start");
      // check user balances
      expect(await receiverStaking.balanceOf(user)).to.equal(amount, "incorrect user balance");
      expect(await receiverStaking.balanceOfAt(user, 1).to.equal(amount, "incorrect user balance at epoch 1"));
      expect(await receiverStaking.balanceOfSignerAt(signerAddress, 1)).to.equal(amount, "incorrect user balance by signer at epoch 1");
      // check another user balances
      expect(await receiverStaking.balanceOf(anotherUser)).to.equal(anotherAmount, "incorrect user balance");
      expect(await receiverStaking.balanceOfAt(anotherUser, 1).to.equal(anotherAmount, "incorrect user balance at epoch 1"));
      expect(await receiverStaking.balanceOfSignerAt(anotherSignerAddress, 1)).to.equal(anotherAmount, "incorrect user balance by signer at epoch 1");
      // check total supply
      expect(await receiverStaking.totalSupply()).to.equal(amount.add(anotherAmount), "incorrect total supply");
      expect(await receiverStaking.totalSupplyAt(1)).to.equal(amount.add(anotherAmount), "incorrect total supply at epoch 1");
    });

    it("more withdrawals and deposits in first epoch", async ()  => {
      
    })
  });

  it("State at start", async () => {
    const early = 1000;
    await timeTravel(timeToStart - early);
    // Note: Snapshot id starts from 1, 0 is invalid.
    await expect(receiverStaking.balanceOfAt(signerAddresses[0], 1)).to.be.reverted;
    await expect(receiverStaking.totalSupplyAt(1)).to.be.reverted;

    await timeTravel(early);
    // Note: Snapshot id starts from 1, 0 is invalid.
    const {
      totalStake: totalSupplyAtStakingStart,
      currentEpoch,
    } = await receiverStaking.getEpochInfo(1);
    const balanceAtStakingStart = await receiverStaking.balanceOfAt(signerAddresses[0], currentEpoch);
    expect(balanceAtStakingStart).to.equal(0, "starting balance non zero at start");
    expect(totalSupplyAtStakingStart).to.equal(0, "total balance non zero at start");
    expect(currentEpoch).to.equal(1, "Wrong epoch number calc");
    expect(await receiverStaking.STAKING_TOKEN()).to.equal(stakingToken.address);
    expect(await receiverStaking.START_TIME()).to.equal(START_TIME);
    expect(await receiverStaking.EPOCH_LENGTH()).to.equal(EPOCH_LENGTH);
  });
});

describe("Admin calls", async () => {
  let signers: Signer[];
  let signerAddresses: string[];
  let receiverStaking: Contract;
  let stakingToken: Contract;
  let START_TIME: number;
  let admin: Signer;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    admin = signers[signers.length - 1];
    signerAddresses = await Promise.all(signers.map((signer) => signer.getAddress()));
    const stakingTokenFactory = await ethers.getContractFactory("Pond");
    stakingToken = await (await upgrades.deployProxy(stakingTokenFactory, ["Marlin", "POND"], { kind: "uups" })).deployed();
    const receiverStakingFactory = await ethers.getContractFactory("ReceiverStaking");
    START_TIME = (await ethers.provider.getBlock("latest")).timestamp + timeToStart;
    // Note: Initialized
    receiverStaking = await (
      await upgrades.deployProxy(receiverStakingFactory, [await admin.getAddress()], {
        kind: "uups",
        constructorArgs: [START_TIME, EPOCH_LENGTH, stakingToken.address],
      })
    ).deployed();
    await timeTravel(timeToStart);
  });

  // it("only admin can update staking token", async () => {
  //     const stakingTokenFactory = await ethers.getContractFactory("Pond");
  //     const newStakingToken = await (await upgrades.deployProxy(stakingTokenFactory, ["Marlin", "POND"], { kind: "uups" })).deployed();
  //     await expect(receiverStaking.connect(signers[2]).updateStakingToken(newStakingToken.address)).to.be.reverted;
  //     await expect(receiverStaking.connect(admin).updateStakingToken(newStakingToken.address))
  //         .to.emit(receiverStaking, "StakingTokenUpdated")
  //         .withArgs(newStakingToken.address);
  //     const setNewStakingToken = await receiverStaking.stakingToken();
  //     expect(setNewStakingToken).to.equal(newStakingToken.address);

  //     // can't deposit old tokens if staking token updated
  //     const user = signers[5];
  //     const userAddress = await user.getAddress();
  //     const amount = BN.from(Math.floor(Math.random() * 10) + "000000000000000000");
  //     await stakingToken.transfer(userAddress, amount);
  //     await stakingToken.connect(user).approve(receiverStaking.address, amount);
  //     await expect(receiverStaking.connect(user)["deposit(uint256,address)"](amount)).to.be.reverted;
  // });

  it("upgrade contract", async () => {
    let receiverStakingFactory = await ethers.getContractFactory("ReceiverStaking");
    const prevImplAddress = await upgrades.erc1967.getImplementationAddress(receiverStaking.address);
    await expect(
      upgrades.upgradeProxy(receiverStaking.address, receiverStakingFactory, {
        kind: "uups",
        constructorArgs: [START_TIME, EPOCH_LENGTH, stakingToken.address],
      })
    ).to.be.reverted;
    receiverStakingFactory = receiverStakingFactory.connect(admin);
    const stakingTokenFactory = await ethers.getContractFactory("Pond");
    const newStakingToken = await (await upgrades.deployProxy(stakingTokenFactory, ["Marlin", "POND"], { kind: "uups" })).deployed();
    const contractStakingToken = await receiverStaking.STAKING_TOKEN();
    expect(contractStakingToken).to.equal(stakingToken.address);
    await upgrades.upgradeProxy(receiverStaking.address, receiverStakingFactory, {
      kind: "uups",
      constructorArgs: [START_TIME, EPOCH_LENGTH, newStakingToken.address],
    });
    const updatedImplAddress = await upgrades.erc1967.getImplementationAddress(receiverStaking.address);
    expect(prevImplAddress).not.equal(updatedImplAddress);
    const contractNewStakingToken = await receiverStaking.STAKING_TOKEN();
    expect(contractNewStakingToken).to.equal(newStakingToken.address);
    expect(contractNewStakingToken).not.equal(stakingToken.address);
  });
});

describe("Receiver Staking at start", async () => {
  let signers: Signer[];
  let signerAddresses: string[];
  let receiverStaking: Contract;
  let stakingToken: Contract;
  let START_TIME: number;
  let admin: Signer;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    admin = signers[signers.length - 1];
    signerAddresses = await Promise.all(signers.map((signer) => signer.getAddress()));
    const stakingTokenFactory = await ethers.getContractFactory("Pond");
    stakingToken = await (await upgrades.deployProxy(stakingTokenFactory, ["Marlin", "POND"], { kind: "uups" })).deployed();
    const receiverStakingFactory = await ethers.getContractFactory("ReceiverStaking");
    START_TIME = (await ethers.provider.getBlock("latest")).timestamp + timeToStart;
    // Note: Initialized
    receiverStaking = await (
      await upgrades.deployProxy(receiverStakingFactory, [await admin.getAddress()], {
        kind: "uups",
        constructorArgs: [START_TIME, EPOCH_LENGTH, stakingToken.address],
      })
    ).deployed();
    await timeTravel(timeToStart);
  });

  it("can't initialize again", async () => {
    await expect(receiverStaking.initialize(await admin.getAddress())).to.be.reverted;
  });

  it("Epoch calculation", async () => {
    let time = 0;
    for (let i = 0; i < runs; i++) {
      const timeToTravel = Math.floor(Math.random() * 1000000);
      time += timeToTravel;
      await timeTravel(timeToTravel);
      const { currentEpoch } = await receiverStaking.getEpochInfo(1);
      const calculatedEpoch = Math.floor(time / EPOCH_LENGTH + 1);
      expect(currentEpoch).to.equal(calculatedEpoch);
    }
  });

  it("deposit without enough balance", async () => {
    const user = signers[3];
    const signerAddress = await signers[5].getAddress();
    const amount = parseInt(Math.random() * 100 + "");
    await expect(receiverStaking.connect(user)["deposit(uint256,address)"](amount, signerAddress)).to.be.reverted;
  });

  it("deposit with not enough allowance", async () => {
    const user = signers[2];
    const signerAddress = await signers[6].getAddress();
    const userAddress = await user.getAddress();
    const amount = parseInt(Math.random() * 100 + "");
    await stakingToken.transfer(userAddress, amount);
    await expect(receiverStaking.connect(user)["deposit(uint256,address)"](amount, signerAddress)).to.be.reverted;
  });

  it("deposit with enough allowance check before snapshot", async () => {
    const user = signers[5];
    const signerAddress = await signers[7].getAddress();
    const userAddress = await user.getAddress();
    receiverStaking = receiverStaking.connect(user);
    const amount = BN.from(parseInt((Math.random() * 99 + 1) + "") + "00000000000000000");
    await stakingToken.transfer(userAddress, amount);
    await stakingToken.connect(user).approve(receiverStaking.address, amount);
    await expect(receiverStaking["deposit(uint256,address)"](amount, signerAddress)).to.changeTokenBalances(stakingToken, [receiverStaking, user], [amount, "-" + amount]);

    const { currentEpoch } = await receiverStaking.getEpochInfo(1);

    const balance = await receiverStaking.balanceOf(userAddress);
    expect(balance).to.equal(amount, "incorrect balance after deposit");
    const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
    expect(epochBalance).to.equal(0, `incorrect epoch balance after deposit expected: 0, got: ${epochBalance}`);
  });

  it("deposit with enough allowance", async () => {
    const user = signers[5];
    const signerAddress = await signers[6].getAddress();
    const userAddress = await user.getAddress();
    const amount = BN.from(parseInt((Math.random() * 99 + 1) + "") + "00000000000000000");
    await stakingToken.transfer(userAddress, amount);
    await stakingToken.connect(user).approve(receiverStaking.address, amount);
    await receiverStaking.connect(user)["deposit(uint256,address)"](amount, signerAddress);
    await timeTravel(EPOCH_LENGTH);

    const { currentEpoch } = await receiverStaking.getEpochInfo(1);

    const balance = await receiverStaking.balanceOf(userAddress);
    expect(balance).to.equal(amount, "incorrect balance after deposit");
    const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
    expect(epochBalance).to.equal(amount, `incorrect epoch balance after deposit expected: ${amount}, got: ${epochBalance}`);
  });

  it("deposit and withdraw check before transfer", async () => {
    const user = signers[7];
    const signerAddress = await signers[6].getAddress();
    const userAddress = await user.getAddress();
    const amount = BN.from(parseInt((Math.random() * 99 + 1) + "") + "00000000000000000");
    await stakingToken.transfer(userAddress, amount);
    await stakingToken.connect(user).approve(receiverStaking.address, amount);
    await receiverStaking.connect(user)["deposit(uint256,address)"](amount, signerAddress);

    const withdrawalAmount = amount.div(3);
    await receiverStaking.connect(user).withdraw(withdrawalAmount);

    const { currentEpoch } = await receiverStaking.getEpochInfo(1);

    const balance = await receiverStaking.balanceOf(userAddress);
    expect(balance).to.equal(amount.sub(withdrawalAmount), "incorrect balance after deposit");
    const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
    expect(epochBalance).to.equal(0, "incorrect epoch balance after deposit");
  });

  it("deposit and withdraw", async () => {
    const user = signers[7];
    const signerAddress = await signers[6].getAddress();
    const userAddress = await user.getAddress();
    const amount = BN.from(parseInt((Math.random() * 99 + 1) + "") + "00000000000000000");
    await stakingToken.transfer(userAddress, amount);
    await stakingToken.connect(user).approve(receiverStaking.address, amount);
    await receiverStaking.connect(user)["deposit(uint256,address)"](amount, signerAddress);
    await timeTravel(EPOCH_LENGTH);

    const withdrawalAmount = amount.div(3);
    await receiverStaking.connect(user).withdraw(withdrawalAmount);

    const { currentEpoch } = await receiverStaking.getEpochInfo(1);

    const balance = await receiverStaking.balanceOf(userAddress);
    expect(balance).to.equal(amount.sub(withdrawalAmount), "incorrect balance after deposit and withdraw");
    const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
    const epochTotalSupply = await receiverStaking.totalSupplyAt(currentEpoch.toString());
    expect(epochBalance.toString()).to.equal(amount.sub(withdrawalAmount), "incorrect user epoch balance after deposit and withdraw");
    expect(epochTotalSupply).to.equal(epochBalance, "incorrect supply after deposit and withdraw");
  });

  it("snapshot maintains min balance during epoch", async () => {
    const user = signers[7];
    const signerAddress = await signers[7].getAddress();
    const userAddress = await user.getAddress();
    const amount = BN.from(parseInt((Math.random() * 99 + 1) + "") + "00000000000000000");
    await stakingToken.transfer(userAddress, amount.mul(2));
    await stakingToken.connect(user).approve(receiverStaking.address, amount.mul(2));
    await receiverStaking.connect(user)["deposit(uint256,address)"](amount, signerAddress);
    await timeTravel(EPOCH_LENGTH);

    await receiverStaking.connect(user).withdraw(amount.div(5));
    await receiverStaking.connect(user)["deposit(uint256)"](amount.mul(2).div(5));

    const { currentEpoch } = await receiverStaking.getEpochInfo(1);

    const userBalance = await receiverStaking.balanceOf(userAddress);
    expect(userBalance).to.equal(amount.mul(6).div(5), "incorrect balance after deposit");
    const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
    const epochTotalSupply = await receiverStaking.totalSupplyAt(currentEpoch.toString());
    expect(epochBalance.toString()).to.equal(amount.mul(4).div(5), "incorrect epoch balance after deposit");
    expect(epochTotalSupply.toString()).to.equal(amount.mul(4).div(5), "incorrect epoch balance after deposit");
  });

  it("snapshot maintain min balance over multiple epochs and multiple deposits per epoch", async () => {
    const user = signers[8];
    const signerAddress = await signers[6].getAddress();
    await receiverStaking.connect(user).setSigner(signerAddress);
    const userAddress = await user.getAddress();
    const amount = BN.from(parseInt((Math.random() * 999 +  1) + "") + "000000000000000");
    const numberOfEpochs = 10;
    const numberOfActionsInEpoch = 100;
    await stakingToken.transfer(userAddress, amount.mul(numberOfEpochs * numberOfActionsInEpoch));
    let expectedBalance = BN.from(0);
    for (let i = 0; i < numberOfEpochs; i++) {
      let minBalance = await receiverStaking.balanceOf(userAddress);
      let travelTime = 0;
      for (let j = 0; j < numberOfActionsInEpoch; j++) {
        const rand = parseInt(Math.random() * 2 + "");
        if (rand == 0) {
          const randAmount = BN.from(parseInt((Math.random() * 999 + 1) + "") + "000000000000000");
          expectedBalance = expectedBalance.add(randAmount);
          await stakingToken.connect(user).approve(receiverStaking.address, randAmount);
          await receiverStaking.connect(user)["deposit(uint256)"](randAmount);
        } else if (rand == 1) {
          const balance = await receiverStaking.balanceOf(userAddress);
          const withdrawAmount = balance.mul(Math.floor(Math.random() * 10000)).div(10000);
          expectedBalance = expectedBalance.sub(withdrawAmount);
          await receiverStaking.connect(user).withdraw(withdrawAmount);
          minBalance = balance.sub(withdrawAmount).lt(minBalance) ? balance.sub(withdrawAmount) : minBalance;
        }
        const timeToTravel = Math.floor((EPOCH_LENGTH / numberOfActionsInEpoch) * Math.random());
        travelTime += timeToTravel;
        await timeTravel(timeToTravel);
      }
      const { currentEpoch } = await receiverStaking.getEpochInfo(1);
      await timeTravel(EPOCH_LENGTH - travelTime);
      const { currentEpoch: newEpoch } = await receiverStaking.getEpochInfo(1);
      expect(newEpoch.sub(currentEpoch)).to.equal(1);

      const userBalance = await receiverStaking.balanceOf(userAddress);
      expect(userBalance).to.equal(expectedBalance, "incorrect balance after deposit");
      const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch);
      expect(epochBalance).to.equal(minBalance, `incorrect epoch balance after deposit in epoch ${currentEpoch} at index ${i}`);
    }
  }).timeout(100000);
});

async function timeTravel(time: number) {
  await network.provider.send("evm_increaseTime", [time]);
  await network.provider.send("evm_mine");
}
