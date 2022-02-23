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

describe('GovernorAlpha', function () {
    let signers: Signer[];
    let addrs: string[];
    let mpond: Contract;
    let timelock: Contract;

    beforeEach(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map(a => a.getAddress()));

        const MPond = await ethers.getContractFactory('MPond');
        mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await upgrades.deployProxy(Timelock, [2*24*60*60],{ kind: "uups" });
    });

    it('deploys with initialization disabled', async function () {
        const GovernorAlpha = await ethers.getContractFactory('GovernorAlpha');
        let governorAlpha = await GovernorAlpha.deploy();
        await expect(governorAlpha.initialize(timelock.address, mpond.address, addrs[1])).to.be.reverted;
    });

    it('deploys as proxy and initializes', async function () {
        const GovernorAlpha = await ethers.getContractFactory('GovernorAlpha');
        let governorAlpha = await upgrades.deployProxy(GovernorAlpha, [timelock.address, mpond.address, addrs[1]] , { kind: "uups" });

        expect(await governorAlpha.timelock()).to.equal(timelock.address);
        expect(await governorAlpha.MPond()).to.equal(mpond.address);
        expect(await governorAlpha.hasRole(await governorAlpha.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
        expect(await governorAlpha.guardian()).to.equal(addrs[1]);
    });

    it('upgrades', async function () {
        const GovernorAlpha = await ethers.getContractFactory('GovernorAlpha');
        let governorAlpha = await upgrades.deployProxy(GovernorAlpha, [timelock.address, mpond.address, addrs[1]] , { kind: "uups" });
        await upgrades.upgradeProxy(governorAlpha.address, GovernorAlpha, { kind: "uups" });

        expect(await governorAlpha.timelock()).to.equal(timelock.address);
        expect(await governorAlpha.MPond()).to.equal(mpond.address);
        expect(await governorAlpha.hasRole(await governorAlpha.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
        expect(await governorAlpha.guardian()).to.equal(addrs[1]);
    });

    it('does not upgrade without admin', async function () {
        const GovernorAlpha = await ethers.getContractFactory('GovernorAlpha');
        let governorAlpha = await upgrades.deployProxy(GovernorAlpha, [timelock.address, mpond.address, addrs[1]] , { kind: "uups" });
        await expect(upgrades.upgradeProxy(governorAlpha.address, GovernorAlpha.connect(signers[1]), { kind: "uups" })).to.be.reverted;
    });
});

describe('GovernorAlpha', function () {
    let signers: Signer[];
    let addrs: string[];
    let bridge: Contract;
    let timelock: Contract;
    let governorAlpha: Contract;
    let mpond: Contract;
    beforeEach(async function () {
        signers = await ethers.getSigners();
        addrs = await Promise.all(signers.map(a => a.getAddress()));

        const MPond = await ethers.getContractFactory('MPond');
        mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
        

        const Pond = await ethers.getContractFactory('Pond');
        const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"],{ kind: "uups" });

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await upgrades.deployProxy(Timelock, [2*24*60*60],{ kind: "uups" });
        
        const Bridge = await ethers.getContractFactory('Bridge');
        bridge = await upgrades.deployProxy(Bridge,[mpond.address, pond.address, timelock.address] , { kind: "uups" }); // nitin check changing timelock address to addrs[1]

        const GovernorAlpha = await ethers.getContractFactory('GovernorAlpha');
        governorAlpha = await upgrades.deployProxy(GovernorAlpha, [timelock.address, mpond.address, addrs[1]] , { kind: "uups" });
        await timelock.grantRole(await timelock.DEFAULT_ADMIN_ROLE(), governorAlpha.address); // nitin: check if this is expected
    });


    it('cannot propose with prior votes less than equal to proposalThreshold', async()=> {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], await governorAlpha.proposalThreshold());
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.proposalThreshold()));
        skipBlocks(2);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await expect(governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test")).to.be.reverted;
    });

    it('target, value, signature and calldatas length must be same to propose', async()=> {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], await governorAlpha.proposalThreshold()+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.proposalThreshold())+1);
        skipBlocks(2);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await expect(governorAlpha.connect(signers[2]).propose([bridge.address, bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test")).to.be.reverted;
    });

    it('target cannot be empty to propose', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], await governorAlpha.proposalThreshold()+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.proposalThreshold())+1);
        skipBlocks(2);
        await expect(governorAlpha.connect(signers[2]).propose([], [], [], [], "test")).to.be.reverted;
    });

    it('target length must not be greator than proposalmaxOperations', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], await governorAlpha.proposalThreshold()+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.proposalThreshold())+1);
        skipBlocks(2);
        let calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        let targets = [bridge.address];
        let values = [0];
        let signatures = ["changeLiquidityBp(uint256)"];

        for(let i = 0; i < await governorAlpha.proposalMaxOperations(); i++) {
            targets.push(targets[0]);
            values.push(values[0]);
            signatures.push(signatures[0]);
            calldatas.push(calldatas[0]);
        }
        await expect(governorAlpha.connect(signers[2]).propose(targets, values, signatures, calldatas, "test")).to.be.reverted;
    });

    it('can propose', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.proposalThreshold())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.proposalThreshold())+1);
        skipBlocks(2);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test");
        expect(await governorAlpha.latestProposalIds(addrs[2])).to.equal(1);
        let proposal = await governorAlpha.proposals(1);

        expect(proposal.id).to.equal(1);
        expect(proposal.eta).to.equal(0);
        expect(proposal.proposer).to.equal(addrs[2]);
        expect(proposal.forVotes).to.equal(0);
        expect(proposal.againstVotes).to.equal(0);
        expect(proposal.canceled).to.be.false;
        expect(proposal.executed).to.be.false;
    });

    it('cannot cast vote for non existing proposa id ', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.quorumVotes())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.quorumVotes())+1);
        skipBlocks(2);
        await expect(governorAlpha.connect(signers[2]).castVote(1, true)).to.be.reverted;
    });

    it('cannot cast vote for canceled proposal', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.quorumVotes())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.quorumVotes())+1);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test");
        await governorAlpha.connect(signers[1]).cancel(1);
        skipBlocks(2);
        expect(await governorAlpha.state(1)).to.equal(2); // cancelled state
        await expect(governorAlpha.connect(signers[2]).castVote(1, true)).to.be.reverted;
    });

    it('cannot cast vote for pending proposal', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.quorumVotes())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.quorumVotes())+1);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test");
        expect(await governorAlpha.state(1)).to.equal(0); // pending state
        await expect(governorAlpha.connect(signers[2]).castVote(1, true)).to.be.reverted;
    });

    it('can cast vote in support for active proposal', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.quorumVotes())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.quorumVotes())+1);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test");
        skipBlocks(2);
        expect(await governorAlpha.state(1)).to.equal(1); // active state
        await governorAlpha.connect(signers[2]).castVote(1, true);
        const receipt = await governorAlpha.getReceipt(1, addrs[2]);
        let proposal = await governorAlpha.proposals(1);

        expect(receipt.hasVoted).to.be.true;
        expect(receipt.support).to.be.true;
        expect(receipt.votes).to.equal((await governorAlpha.quorumVotes())+1);
        expect(proposal.forVotes).to.equal((await governorAlpha.quorumVotes())+1);
    });

    it('can cast vote against active proposal', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.quorumVotes())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.quorumVotes())+1);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test");
        skipBlocks(2);
        expect(await governorAlpha.state(1)).to.equal(1); // active state
        await governorAlpha.connect(signers[2]).castVote(1, false);
        const receipt = await governorAlpha.getReceipt(1, addrs[2]);
        let proposal = await governorAlpha.proposals(1);

        expect(receipt.hasVoted).to.be.true;
        expect(receipt.support).to.be.false;
        expect(receipt.votes).to.equal((await governorAlpha.quorumVotes())+1);
        expect(proposal.againstVotes).to.equal((await governorAlpha.quorumVotes())+1);
    });

    it('cannot cast vote again for same proposal', async()=> {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.quorumVotes())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.quorumVotes())+1);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test");
        skipBlocks(2);
        expect(await governorAlpha.state(1)).to.equal(1); // active state
        await governorAlpha.connect(signers[2]).castVote(1, true);
        await expect( governorAlpha.connect(signers[2]).castVote(1, true)).to.be.reverted;
    });

    it('cannot queue an active proposal', async() => {
        let WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
        await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
        await mpond.transfer(addrs[2], (await governorAlpha.proposalThreshold())+1);
        await mpond.connect(signers[2]).delegate(addrs[2], (await governorAlpha.proposalThreshold())+1);
        skipBlocks(2);

        const calldatas = [
            ethers.utils.defaultAbiCoder.encode(
              ["uint256"],
              ["0x000000000000000000000000000000000000000000000000000000000000000A"]
            ),
          ];
        await governorAlpha.connect(signers[2]).propose([bridge.address], [0], ["changeLiquidityBp(uint256)"], calldatas, "test");
        skipBlocks(2);
        expect(await governorAlpha.state(1)).to.equal(1); // active state
        await expect(governorAlpha.queue(1)).to.be.reverted;
    });
});

async function skipBlocks(n: number) {
    await Promise.all([...Array(n)].map(async x => await ethers.provider.send('evm_mine', [])));
}