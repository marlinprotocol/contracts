import { ethers, network, upgrades } from 'hardhat';
import { BigNumber as BN, Signer, Contract, BigNumber, providers } from 'ethers';
import { expect,  } from 'chai';
import { assert, time, timeStamp } from 'console';

const timeToStart = 24*60*60;
const runs = 100;

const EPOCH_LENGTH = 4*60*60;

describe('Receiver Staking before start', function() {
    let signers: Signer[];
    let signerAddresses: string[];
    let receiverStaking: Contract;
    let stakingToken: Contract;
    let START_TIME: number;
    let admin: Signer;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        admin = signers[signers.length - 1];
        signerAddresses = await Promise.all(signers.map(signer => signer.getAddress()));
        const stakingTokenFactory = await ethers.getContractFactory('Pond');
        stakingToken = await (await upgrades.deployProxy(stakingTokenFactory, ["Marlin", "POND"], {kind: 'uups'})).deployed();
        const receiverStakingFactory = await ethers.getContractFactory("ReceiverStaking");
        START_TIME = (await ethers.provider.getBlock("latest")).timestamp + timeToStart;
        // Note: Initialized
        receiverStaking = await (await upgrades.deployProxy(receiverStakingFactory, [stakingToken.address, (await admin.getAddress())], {
            kind: 'uups', 
            constructorArgs: [START_TIME, EPOCH_LENGTH]})
        ).deployed();
    });

    it("State at start", async () => {
        const early = 1000;
        await timeTravel(timeToStart - early);
        // Note: Snapshot id starts from 1, 0 is invalid.
        expect(receiverStaking.balanceOfAt(signerAddresses[0], 1)).to.be.reverted;
        expect(receiverStaking.totalSupplyAt(1)).to.be.reverted;

        await timeTravel(early);
        // Note: Snapshot id starts from 1, 0 is invalid.
        const { 
            userStake:balanceAtStakingStart, 
            totalStake:totalSupplyAtStakingStart, 
            currentEpoch 
        } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);
        assert(balanceAtStakingStart == 0, "starting balance non zero at start");
        assert(totalSupplyAtStakingStart == 0, "total balance non zero at start");
        assert(currentEpoch == 1, "Wrong epoch number calc");
    });
});

describe('Receiver Staking at start', async () => {
    let signers: Signer[];
    let signerAddresses: string[];
    let receiverStaking: Contract;
    let stakingToken: Contract;
    let START_TIME: number;
    let admin: Signer;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        admin = signers[signers.length - 1];
        signerAddresses = await Promise.all(signers.map(signer => signer.getAddress()));
        const stakingTokenFactory = await ethers.getContractFactory('Pond');
        stakingToken = await (await upgrades.deployProxy(stakingTokenFactory, ["Marlin", "POND"], {kind: 'uups'})).deployed();
        const receiverStakingFactory = await ethers.getContractFactory("ReceiverStaking");
        START_TIME = (await ethers.provider.getBlock("latest")).timestamp + timeToStart;
        // Note: Initialized
        receiverStaking = await (await upgrades.deployProxy(receiverStakingFactory, [stakingToken.address, (await admin.getAddress())], {
            kind: 'uups', 
            constructorArgs: [START_TIME, EPOCH_LENGTH]})
        ).deployed();
        await timeTravel(timeToStart);
    });

    it("can't initialize again", async () => {
       expect(receiverStaking.initialize(stakingToken)).to.be.reverted;
    });

    it("Epoch calculation", async () => {
        let time = 0;
        for(let i=0; i < runs; i++) {
            const timeToTravel = parseInt(Math.random()*1000000 + "");
            time += timeToTravel;
            await timeTravel(timeToTravel);
            const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);
            const calculatedEpoch = parseInt((time/EPOCH_LENGTH + 1)+"");
            assert(currentEpoch == calculatedEpoch, "Incorrect epoch number calculated");
        }
    });

    it("update staking token", async () => {
        const stakingTokenInContract = await receiverStaking.stakingToken();
        assert(stakingTokenInContract == stakingToken.address, "Incorrect staking token contract");

        const newStakingTokenFactory = await ethers.getContractFactory('Pond');
        const newStakingToken = await (await upgrades.deployProxy(newStakingTokenFactory, ["Marlin", "POND"], {kind: 'uups'})).deployed();

        await receiverStaking.connect(admin).updateStakingToken(newStakingToken.address);

        const newStakingTokenInContract = await receiverStaking.stakingToken();
        assert(newStakingTokenInContract == newStakingToken, "Staking token not updated");
    });

    it("deposit", async () => {
        const amount = parseInt(Math.random()*10+"")+"000000000000000000";
        await stakingToken.approve(receiverStaking.address, amount);
        await receiverStaking.deposit(amount);

        const { currentEpoch } = await receiverStaking.getStakeInfo(signerAddresses[0], 1);

        const balance = await receiverStaking.balanceOf(amount);
        
    });

    it("deposit with not enough allowance", async () => {
        
    });
})

async function timeTravel(time: number) {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine");
}