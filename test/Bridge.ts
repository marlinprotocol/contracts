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

describe('Bridge', function () {
    let signers: Signer[];
    let addrs: string[];
    let mpond: Contract;
    let pond: Contract;

    beforeEach(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map(a => a.getAddress()));

        const MPond = await ethers.getContractFactory('MPond');
        mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

        const Pond = await ethers.getContractFactory('Pond');
        pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"],{ kind: "uups" });
    });

    it('deploys with initialization disabled', async function () {
        const Bridge = await ethers.getContractFactory('Bridge');
        let bridge = await Bridge.deploy();
        await expect(bridge.initialize(mpond.address, pond.address, addrs[1])).to.be.reverted;
    });

    it('deploys as proxy and initializes', async function () {
        const Bridge = await ethers.getContractFactory('Bridge');
        let bridge = await upgrades.deployProxy(Bridge, [mpond.address, pond.address, addrs[1]] , { kind: "uups" });

        expect(await bridge.mpond()).to.equal(mpond.address);
        expect(await bridge.pond()).to.equal(pond.address);
        expect(await bridge.hasRole(await bridge.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
        expect(await bridge.hasRole(await bridge.GOVERNANCE_ROLE(), addrs[1])).to.be.true;
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        expect(await bridge.startTime()).to.equal(currentBlockTimestamp);
        expect(await bridge.liquidityStartTime()).to.equal(currentBlockTimestamp);
        expect(await bridge.liquidityBp()).to.equal(1000);
        expect(await bridge.lockTimeEpochs()).to.equal(180);
        expect(await bridge.liquidityEpochLength()).to.equal(180*24*60*60);
    });

    it('upgrades', async function () {
        const Bridge = await ethers.getContractFactory('Bridge');
        let bridge = await upgrades.deployProxy(Bridge,[mpond.address, pond.address, addrs[1]] , { kind: "uups" });
        await upgrades.upgradeProxy(bridge.address, Bridge, { kind: "uups" });

        expect(await bridge.mpond()).to.equal(mpond.address);
        expect(await bridge.pond()).to.equal(pond.address);
        expect(await bridge.hasRole(await bridge.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
        expect(await bridge.hasRole(await bridge.GOVERNANCE_ROLE(),addrs[1])).to.be.true;
        let currentBlockTimestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
        expect(await bridge.startTime()).to.equal(currentBlockTimestamp-1);
        expect(await bridge.liquidityStartTime()).to.equal(currentBlockTimestamp-1);
        expect(await bridge.liquidityBp()).to.equal(1000);
        expect(await bridge.lockTimeEpochs()).to.equal(180);
        expect(await bridge.liquidityEpochLength()).to.equal(180*24*60*60);
    });

    it('does not upgrade without admin', async function () {
        const Bridge = await ethers.getContractFactory('Bridge');
        let bridge = await upgrades.deployProxy(Bridge,[mpond.address, pond.address, addrs[1]] , { kind: "uups" });
        await expect(upgrades.upgradeProxy(bridge.address, Bridge.connect(signers[1]), { kind: "uups" })).to.be.reverted;
    });
});

describe('Bridge', function () {
    let signers: Signer[];
    let addrs: string[];
    let bridge: Contract;

    beforeEach(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map(a => a.getAddress()));

        const MPond = await ethers.getContractFactory('MPond');
        const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

        const Pond = await ethers.getContractFactory('Pond');
        const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"],{ kind: "uups" });

        const Bridge = await ethers.getContractFactory('Bridge');
        bridge = await upgrades.deployProxy(Bridge,[mpond.address, pond.address, addrs[1]] , { kind: "uups" });
    });

    it('admin can change staking contract', async ()=> {
        await bridge.changeStakingContract(addrs[2]);
        expect(await bridge.stakingContract()).to.equal(addrs[2]);
    });

    it('governance can change staking contract', async() => {
        await bridge.connect(signers[1]).changeStakingContract(addrs[2]);
        expect(await bridge.stakingContract()).to.equal(addrs[2]);
    });

    it('non admin and non governance cannot change staking contract', async() => {
        await expect(bridge.connect(signers[3]).changeStakingContract(addrs[2])).to.be.reverted;
        expect(await bridge.stakingContract()).to.equal('0x0000000000000000000000000000000000000000');
    });

    it('admin can change liquidityBp', async ()=> {
        await bridge.changeLiquidityBp(10);
        expect(await bridge.liquidityBp()).to.equal(10);
    });

    it('governance can change liquidityBp', async() => {
        await bridge.connect(signers[1]).changeLiquidityBp(10);
        expect(await bridge.liquidityBp()).to.equal(10);
    });

    it('non admin and non governance cannot change liquidityBp', async() => {
        await expect(bridge.connect(signers[2]).changeLiquidityBp(10)).to.be.reverted;
        expect(await bridge.liquidityBp()).to.equal(1000);
    });

    it('admin can change lock time epochs', async ()=> {
        await bridge.changeLockTimeEpochs(10);
        expect(await bridge.lockTimeEpochs()).to.equal(10);
    });

    it('governance can change lock time epochs', async() => {
        await bridge.connect(signers[1]).changeLockTimeEpochs(10);
        expect(await bridge.lockTimeEpochs()).to.equal(10);
    });

    it('non admin and non governance cannot change lock time epochs', async() => {
        await expect(bridge.connect(signers[2]).changeLockTimeEpochs(10)).to.be.reverted;
        expect(await bridge.lockTimeEpochs()).to.equal(180);
    });

    it('admin can change liquidity epoch length', async ()=> {
        await bridge.changeLiquidityEpochLength(10);
        expect(await bridge.liquidityEpochLength()).to.equal(10*24*60*60);
    });

    it('governance can change liquidity epoch length', async() => {
        await bridge.connect(signers[1]).changeLiquidityEpochLength(10);
        expect(await bridge.liquidityEpochLength()).to.equal(10*24*60*60);
    });

    it('non admin and non governance cannot change liquidity epoch length', async() => {
        await expect(bridge.connect(signers[2]).changeLiquidityEpochLength(10)).to.be.reverted;
        expect(await bridge.liquidityEpochLength()).to.equal(180*24*60*60);
    });

    it('admin can be changed by admin', async() => {
        await bridge.transferOwner(addrs[2]);
        expect(await bridge.hasRole(await bridge.DEFAULT_ADMIN_ROLE(), addrs[2])).to.be.true;
    });

    it('cannot change admin to zero address', async()=> {
        await expect(bridge.connect(signers[1]).transferOwner('0x0000000000000000000000000000000000000000')).to.be.reverted;
        expect(await bridge.hasRole(await bridge.DEFAULT_ADMIN_ROLE(), addrs[2])).to.be.false;
        expect(await bridge.hasRole(await bridge.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });

    it('non admin cannot change admin', async() => {
        await expect(bridge.connect(signers[1]).transferOwner(addrs[2])).to.be.reverted;
        expect(await bridge.hasRole(await bridge.DEFAULT_ADMIN_ROLE(), addrs[2])).to.be.false;
        expect(await bridge.hasRole(await bridge.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });

    it('governance can be changed by governance', async() => {
        await bridge.connect(signers[1]).transferGovernance(addrs[2]);
        expect(await bridge.hasRole(await bridge.GOVERNANCE_ROLE(), addrs[2])).to.be.true;
    });

    it('non governance cannot change governance', async() => {
        await expect(bridge.transferGovernance(addrs[2])).to.be.reverted;
        expect(await bridge.hasRole(await bridge.GOVERNANCE_ROLE(), addrs[2])).to.be.false;
        expect(await bridge.hasRole(await bridge.GOVERNANCE_ROLE(), addrs[1])).to.be.true;
    });



});