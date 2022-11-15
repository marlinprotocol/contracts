import { ethers, network, upgrades } from "hardhat";
import { BigNumber as BN, Signer, Contract, BigNumber, providers } from "ethers";
import { expect } from "chai";
import { time, timeStamp } from "console";

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
      await upgrades.deployProxy(receiverStakingFactory, [stakingToken.address, await admin.getAddress()], {
        kind: "uups",
        constructorArgs: [START_TIME, EPOCH_LENGTH],
      })
    ).deployed();
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
      userStake: balanceAtStakingStart,
      totalStake: totalSupplyAtStakingStart,
      currentEpoch,
    } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);
    expect(balanceAtStakingStart).to.equal(0, "starting balance non zero at start");
    expect(totalSupplyAtStakingStart).to.equal(0, "total balance non zero at start");
    expect(currentEpoch).to.equal(1, "Wrong epoch number calc");
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
        await upgrades.deployProxy(receiverStakingFactory, [stakingToken.address, await admin.getAddress()], {
            kind: "uups",
            constructorArgs: [START_TIME, EPOCH_LENGTH],
        })
        ).deployed();
        await timeTravel(timeToStart);
    });

    it("can't initialize again", async () => {
        await expect(receiverStaking.initialize(stakingToken.address, (await admin.getAddress()))).to.be.reverted;
    });

    it("Epoch calculation", async () => {
        let time = 0;
        for (let i = 0; i < runs; i++) {
            const timeToTravel = parseInt(Math.random() * 1000000 + "");
            time += timeToTravel;
            await timeTravel(timeToTravel);
            const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);
            const calculatedEpoch = parseInt(time / EPOCH_LENGTH + 1 + "");
            expect(currentEpoch).to.equal(calculatedEpoch);
        }
    });

    it("update staking token", async () => {
        const stakingTokenInContract = await receiverStaking.stakingToken();
        expect(stakingTokenInContract).to.equal(stakingToken.address, "Incorrect staking token contract");

        const newStakingTokenFactory = await ethers.getContractFactory("Pond");
        const newStakingToken = await (await upgrades.deployProxy(newStakingTokenFactory, ["Marlin", "POND"], { kind: "uups" })).deployed();

        await receiverStaking.connect(admin).updateStakingToken(newStakingToken.address);

        const newStakingTokenInContract = await receiverStaking.stakingToken();
        expect(newStakingTokenInContract).to.equal(newStakingToken.address, `Staking token not updated, expected: ${newStakingToken.address}, actual: ${newStakingTokenInContract}`);
    });

    it("deposit without enough balance", async () => {
        const user = signers[3];
        const amount = parseInt(Math.random() * 100 + "");
        await expect(receiverStaking.connect(user).deposit(amount)).to.be.reverted;
    });

    it("deposit with not enough allowance", async () => {
        const user = signers[2];
        const userAddress = await user.getAddress();
        const amount = parseInt(Math.random() * 100 + "");
        await stakingToken.transfer(userAddress, amount);
        await expect(receiverStaking.connect(user).deposit(amount)).to.be.reverted;
    });

    it("deposit with enough allowance check before snapshot", async () => {
        const user = signers[5];
        const userAddress = await user.getAddress();
        receiverStaking = receiverStaking.connect(user);
        const amount = parseInt(Math.random() * 10 + "") + "000000000000000000";
        await stakingToken.transfer(userAddress, amount);
        await stakingToken.connect(user).approve(receiverStaking.address, amount);
        await expect(receiverStaking.deposit(amount)).to.changeTokenBalances(
            stakingToken,
            [receiverStaking, user],
            [amount, "-"+amount]
        );

        const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);

        const balance = await receiverStaking.balanceOf(userAddress);
        expect(balance).to.equal(amount, "incorrect balance after deposit");
        const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
        expect(epochBalance).to.equal(0, `incorrect epoch balance after deposit expected: 0, got: ${epochBalance}`);
    });

    it("deposit with enough allowance", async () => {
        const user = signers[5];
        const userAddress = await user.getAddress();
        const amount = parseInt(Math.random() * 10 + "") + "000000000000000000";
        await stakingToken.transfer(userAddress, amount);
        await stakingToken.connect(user).approve(receiverStaking.address, amount);
        await receiverStaking.connect(user).deposit(amount);
        await timeTravel(EPOCH_LENGTH);

        const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);

        const balance = await receiverStaking.balanceOf(userAddress);
        expect(balance).to.equal(amount, "incorrect balance after deposit");
        const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
        expect(epochBalance).to.equal(amount, `incorrect epoch balance after deposit expected: ${amount}, got: ${epochBalance}`);
    });

    it("deposit and withdraw check before transfer", async () => {
        const user = signers[7];
        const userAddress = await user.getAddress();
        const amount = BigNumber.from(parseInt(Math.random() * 10 + "") + "000000000000000000");
        await stakingToken.transfer(userAddress, amount);
        await stakingToken.connect(user).approve(receiverStaking.address, amount);
        await receiverStaking.connect(user).deposit(amount);

        const withdrawalAmount = amount.div(3);
        await receiverStaking.connect(user).withdraw(withdrawalAmount);

        const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);

        const balance = await receiverStaking.balanceOf(userAddress);
        expect(balance).to.equal(amount.sub(withdrawalAmount), "incorrect balance after deposit");
        const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
        expect(epochBalance).to.equal(0, "incorrect epoch balance after deposit");
    });

    it("deposit and withdraw", async () => {
        const user = signers[7];
        const userAddress = await user.getAddress();
        const amount = BigNumber.from(parseInt(Math.random() * 10 + "") + "000000000000000000");
        await stakingToken.transfer(userAddress, amount);
        await stakingToken.connect(user).approve(receiverStaking.address, amount);
        await receiverStaking.connect(user).deposit(amount);
        await timeTravel(EPOCH_LENGTH);

        const withdrawalAmount = amount.div(3);
        await receiverStaking.connect(user).withdraw(withdrawalAmount);

        const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);

        const balance = await receiverStaking.balanceOf(userAddress);
        expect(balance).to.equal(amount.sub(withdrawalAmount), "incorrect balance after deposit");
        const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
        expect(epochBalance.toString()).to.equal(amount.sub(withdrawalAmount), "incorrect epoch balance after deposit");
    });

    it("snapshot maintains min balance during epoch", async () => {
        const user = signers[7];
        const userAddress = await user.getAddress();
        const amount = BigNumber.from(parseInt(Math.random() * 10 + "") + "000000000000000000");
        await stakingToken.transfer(userAddress, amount.mul(2));
        await stakingToken.connect(user).approve(receiverStaking.address, amount.mul(2));
        await receiverStaking.connect(user).deposit(amount);
        await timeTravel(EPOCH_LENGTH);

        await receiverStaking.connect(user).withdraw(amount.div(5));
        await receiverStaking.connect(user).deposit(amount.mul(2).div(5));

        const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);

        const userBalance = await receiverStaking.balanceOf(userAddress);
        expect(userBalance).to.equal(amount.mul(6).div(5), "incorrect balance after deposit");
        const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch.toString());
        expect(epochBalance.toString()).to.equal(amount.mul(4).div(5), "incorrect epoch balance after deposit");
    });


    it("snapshot maintain min balance over multiple epochs and multiple deposits per epoch", async () => {
        const user = signers[8];
        const userAddress = await user.getAddress();
        const amount = BigNumber.from(parseInt(Math.random() * 10 + "") + "000000000000000000");
        const numberOfEpochs = 10;
        const numberOfActionsInEpoch = 100;
        await stakingToken.transfer(userAddress, amount.mul(numberOfEpochs*numberOfActionsInEpoch));
        let expectedBalance = BigNumber.from(0);
        for(let i=0; i < numberOfEpochs; i++) {
            let minBalance = await receiverStaking.balanceOf(userAddress);
            let travelTime = 0;
            for(let j=0; j < numberOfActionsInEpoch; j++) {
                const rand = parseInt(Math.random() * 2 + "");
                if(rand == 0) {
                    const randAmount = BigNumber.from(parseInt(Math.random() * 10000 + "") + "000000000000000");
                    expectedBalance = expectedBalance.add(randAmount);
                    await stakingToken.connect(user).approve(receiverStaking.address, randAmount);
                    await receiverStaking.connect(user).deposit(randAmount);
                } else if(rand == 1) {
                    const balance = await receiverStaking.balanceOf(userAddress);
                    const withdrawAmount = balance.mul(Math.floor(Math.random()*10000)).div(10000);
                    expectedBalance = expectedBalance.sub(withdrawAmount);
                    await receiverStaking.connect(user).withdraw(withdrawAmount);
                    minBalance = balance.sub(withdrawAmount).lt(minBalance) ? balance.sub(withdrawAmount): minBalance;
                }
                const timeToTravel = Math.floor((EPOCH_LENGTH/numberOfActionsInEpoch)*Math.random());
                travelTime += timeToTravel;
                await timeTravel(timeToTravel);
            }
            const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);
            await timeTravel(EPOCH_LENGTH - travelTime);
            const { currentEpoch:newEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);
            expect(newEpoch.sub(currentEpoch)).to.equal(1);

            const userBalance = await receiverStaking.balanceOf(userAddress);
            expect(userBalance).to.equal(expectedBalance, "incorrect balance after deposit");
            const epochBalance = await receiverStaking.balanceOfAt(userAddress, currentEpoch);
            expect(epochBalance).to.equal(minBalance, `incorrect epoch balance after deposit in epoch ${currentEpoch} at index ${i}`);
        }
    });
});

async function timeTravel(time: number) {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine");
}