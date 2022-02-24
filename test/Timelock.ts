import { ethers, upgrades } from 'hardhat';
import { expect, util } from 'chai';
import { BigNumber as BN, Signer, Contract } from 'ethers';
declare module 'ethers' {
    interface BigNumber {
        e18(this: BigNumber): BigNumber;
    }
}

BN.prototype.e18 = function () {
    return this.mul(BN.from(10).pow(18))
}

describe('Timelock', function () {
    let signers: Signer[];
    let addrs: string[];
    beforeEach(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map(a => a.getAddress()));

    });

    it('deploys with initialization disabled', async function () {
        const Timelock = await ethers.getContractFactory('Timelock');
        let timelock = await Timelock.deploy();
        await expect(timelock.initialize(2*24*60*60)).to.be.reverted;
    });

    it('deploys as proxy and initializes', async function () {
        const Timelock = await ethers.getContractFactory('Timelock');
        let timelock = await upgrades.deployProxy(Timelock, [2*24*60*60] , { kind: "uups" });

        expect(await timelock.delay()).to.equal(2*24*60*60);
        expect(await timelock.hasRole(await timelock.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });

    it('upgrades', async function () {
        const Timelock = await ethers.getContractFactory('Timelock');
        let timelock = await upgrades.deployProxy(Timelock, [2*24*60*60] , { kind: "uups" });
        await upgrades.upgradeProxy(timelock.address, Timelock, { kind: "uups" });

        expect(await timelock.delay()).to.equal(2*24*60*60);
        expect(await timelock.hasRole(await timelock.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });

    it('does not upgrade without admin', async function () {
        const Timelock = await ethers.getContractFactory('Timelock');
        let timelock = await upgrades.deployProxy(Timelock, [2*24*60*60] , { kind: "uups" });
        await expect(upgrades.upgradeProxy(timelock.address, Timelock.connect(signers[1]), { kind: "uups" })).to.be.reverted;
    });
});

describe('Timelock', function () {
    let signers: Signer[];
    let addrs: string[];
    let timelock: Contract;
    let bridge: Contract;
    beforeEach(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map(a => a.getAddress()));
        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await upgrades.deployProxy(Timelock, [2*24*60*60] , { kind: "uups" });

        const MPond = await ethers.getContractFactory('MPond');
        const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
        

        const Pond = await ethers.getContractFactory('Pond');
        const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"],{ kind: "uups" });

        const Bridge = await ethers.getContractFactory('Bridge');
        bridge = await upgrades.deployProxy(Bridge,[mpond.address, pond.address, timelock.address] , { kind: "uups" });

    });

    it('non admin cannot queue transaction', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await expect(timelock.connect(signers[1]).queueTransaction(target, value, signature, calldata, eta)).to.be.reverted;
    });

    it('cannot queue transaction with eta less than delay', async()=> {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 - 1;
        await expect(timelock.queueTransaction(target, value, signature, calldata, eta)).to.be.reverted;
    });

    it('admin can queue transaction', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await timelock.queueTransaction(target, value, signature, calldata, eta);
        let txhash = await ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"], 
                [target, value, signature, calldata, eta]
        ));
        expect(await timelock.queuedTransactions(txhash)).to.be.true;
    });

    it('admin can cancel the queued transaction', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await timelock.queueTransaction(target, value, signature, calldata, eta);
        let txhash = await ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"], 
                [target, value, signature, calldata, eta]
        ));
        expect(await timelock.queuedTransactions(txhash)).to.be.true;
        await timelock.cancelTransaction(target, value, signature, calldata, eta);
        expect(await timelock.queuedTransactions(txhash)).to.be.false;
    });

    it('non admin cannot cancel the queued transaction', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await timelock.queueTransaction(target, value, signature, calldata, eta);
        let txhash = await ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"], 
                [target, value, signature, calldata, eta]
        ));
        expect(await timelock.queuedTransactions(txhash)).to.be.true;
        await expect(timelock.connect(signers[1]).cancelTransaction(target, value, signature, calldata, eta)).to.be.reverted;
    });

    it('non admin cannot execute the transaction', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await timelock.queueTransaction(target, value, signature, calldata, eta);
        let txhash = await ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"], 
                [target, value, signature, calldata, eta]
        ));
        expect(await timelock.queuedTransactions(txhash)).to.be.true;
        await skipTime(eta - currentBlockTimestamp);
        await expect(timelock.connect(signers[1]).executeTransaction(target, value, signature, calldata, eta)).to.be.reverted;
    });

    it('cannot execute transaction before queuing', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await skipTime(eta - currentBlockTimestamp);
        await expect(timelock.executeTransaction(target, value, signature, calldata, eta)).to.be.reverted;
    });

    it('cannot execute transaction before eta', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await timelock.queueTransaction(target, value, signature, calldata, eta);
        let txhash = await ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"], 
                [target, value, signature, calldata, eta]
        ));
        expect(await timelock.queuedTransactions(txhash)).to.be.true;
        await expect(timelock.executeTransaction(target, value, signature, calldata, eta)).to.be.reverted;
    });

    it('cannot execute the transaction after the grace periond', async()=> {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await timelock.queueTransaction(target, value, signature, calldata, eta);
        let txhash = await ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"], 
                [target, value, signature, calldata, eta]
        ));
        expect(await timelock.queuedTransactions(txhash)).to.be.true;
        let gracePeriod: BN = await timelock.GRACE_PERIOD();
        await skipTime(eta - currentBlockTimestamp + gracePeriod.toNumber());
        await expect(timelock.executeTransaction(target, value, signature, calldata, eta)).to.be.reverted;
    });

    it('admin can execute the transaction', async() => {
        let calldata =
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            );
        let target = bridge.address;
        let value = 0;
        let signature = "changeLiquidityBp(uint256)";
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        let eta = currentBlockTimestamp + 2*24*60*60 + 1;
        await timelock.queueTransaction(target, value, signature, calldata, eta);
        let txhash = await ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "uint256", "string", "bytes", "uint256"], 
                [target, value, signature, calldata, eta]
        ));
        expect(await timelock.queuedTransactions(txhash)).to.be.true;
        await skipTime(eta - currentBlockTimestamp);
        expect(await bridge.liquidityBp()).to.equal(1000);
        await timelock.executeTransaction(target, value, signature, calldata, eta);
        expect(await timelock.queuedTransactions(txhash)).to.be.false;
        expect(await bridge.liquidityBp()).to.equal(10);
    });
});

async function skipTime(t: number) {
    await ethers.provider.send('evm_increaseTime', [t]);
    await skipBlocks(1);
}
async function skipBlocks(n: number) {
    await Promise.all([...Array(n)].map(async x => await ethers.provider.send('evm_mine', [])));
}