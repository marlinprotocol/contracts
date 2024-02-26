import { expect } from "chai";
import { BigNumber as BN, Contract, Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

import { MarketV1 } from "../../typechain-types";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { getMarketV1 } from "../../utils/typechainConvertor";
import { testERC165 } from "../helpers/erc165";
import { testAdminRole } from "../helpers/rbac";

declare module "ethers" {
	interface BigNumber {
		e12(this: BigNumber): BigNumber;
	}
}
BN.prototype.e12 = function() {
	return this.mul(BN.from(10).pow(12));
};


const RATE_LOCK = ethers.utils.id("RATE_LOCK");
const SELECTORS = [RATE_LOCK];
const WAIT_TIMES: number[] = [600];

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("deploys with initialization disabled", async function() {
		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1 = await MarketV1.deploy();

		await expect(
			marketv1.initialize(addrs[0], addrs[11], SELECTORS, WAIT_TIMES),
		).to.be.revertedWith("Initializable: contract is already initialized");
	});

	it("deploys as proxy and initializes", async function() {
		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1 = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);

		await Promise.all(
			SELECTORS.map(async (s, idx) => {
				expect(await marketv1.lockWaitTime(s)).to.equal(WAIT_TIMES[idx]);
			}),
		);
		expect(
			await marketv1.hasRole(await marketv1.DEFAULT_ADMIN_ROLE(), addrs[0]),
		).to.be.true;
		expect(await marketv1.token()).to.equal(addrs[11]);
	});

	it("does not initialize with mismatched lengths", async function() {
		const MarketV1 = await ethers.getContractFactory("MarketV1");
		await expect(
			upgrades.deployProxy(
				MarketV1,
				[addrs[0], addrs[11], SELECTORS, [...WAIT_TIMES, 0]],
				{ kind: "uups" },
			),
		).to.be.reverted;
	});

	it("upgrades", async function() {
		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1 = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		await upgrades.upgradeProxy(marketv1.address, MarketV1, { kind: "uups" });

		await Promise.all(
			SELECTORS.map(async (s, idx) => {
				expect(await marketv1.lockWaitTime(s)).to.equal(WAIT_TIMES[idx]);
			}),
		);
		expect(
			await marketv1.hasRole(await marketv1.DEFAULT_ADMIN_ROLE(), addrs[0]),
		).to.be.true;
		expect(await marketv1.token()).to.equal(addrs[11]);
	});

	it("does not upgrade without admin", async function() {
		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1 = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);

		await expect(
			upgrades.upgradeProxy(marketv1.address, MarketV1.connect(signers[1]), {
				kind: "uups",
			}),
		).to.be.revertedWith("only admin");
	});
});

testERC165(
	"MarketV1",
	async function(_signers: Signer[], addrs: string[]) {
		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1 = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		return marketv1;
	},
	{
		IAccessControl: [
			"hasRole(bytes32,address)",
			"getRoleAdmin(bytes32)",
			"grantRole(bytes32,address)",
			"revokeRole(bytes32,address)",
			"renounceRole(bytes32,address)",
		],
		IAccessControlEnumerable: [
			"getRoleMember(bytes32,uint256)",
			"getRoleMemberCount(bytes32)",
		],
	},
);

testAdminRole("MarketV1", async function(_signers: Signer[], addrs: string[]) {
	const MarketV1 = await ethers.getContractFactory("MarketV1");
	const marketv1 = await upgrades.deployProxy(
		MarketV1,
		[addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
		{ kind: "uups" },
	);
	return marketv1;
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can register as provider", async () => {
		await marketv1.connect(signers[1]).providerAdd("https://example.com/");

		expect(await marketv1.providers(addrs[1])).to.equal("https://example.com/");
	});

	it("cannot register as provider with empty cp", async () => {
		await expect(
			marketv1.connect(signers[1]).providerAdd(""),
		).to.be.revertedWith("invalid");
	});

	it("cannot register as provider if already registered", async () => {
		await marketv1.connect(signers[1]).providerAdd("https://example.com/");

		await expect(
			marketv1.connect(signers[1]).providerAdd("https://example.com/"),
		).to.be.revertedWith("already exists");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can unregister as provider", async () => {
		await marketv1.connect(signers[1]).providerAdd("https://example.com/");
		await marketv1.connect(signers[1]).providerRemove();

		expect(await marketv1.providers(addrs[1])).to.equal("");
	});

	it("cannot unregister as provider if never registered", async () => {
		await expect(
			marketv1.connect(signers[1]).providerRemove(),
		).to.be.revertedWith("not found");
	});

	it("cannot register as provider if already unregistered", async () => {
		await marketv1.connect(signers[1]).providerAdd("https://example.com/");
		await marketv1.connect(signers[1]).providerRemove();

		await expect(
			marketv1.connect(signers[1]).providerRemove(),
		).to.be.revertedWith("not found");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can update cp", async () => {
		await marketv1.connect(signers[1]).providerAdd("https://example.com/");
		await marketv1
			.connect(signers[1])
			.providerUpdateWithCp("https://example.com/new");

		expect(await marketv1.providers(addrs[1])).to.equal(
			"https://example.com/new",
		);
	});

	it("cannot update to empty cp", async () => {
		await marketv1.connect(signers[1]).providerAdd("https://example.com/");
		await expect(
			marketv1.connect(signers[1]).providerUpdateWithCp(""),
		).to.be.revertedWith("invalid");
	});

	it("cannot update if never registered", async () => {
		await expect(
			marketv1
				.connect(signers[1])
				.providerUpdateWithCp("https://example.com/new"),
		).to.be.revertedWith("not found");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can open job", async () => {
		const ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 50);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		const jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);
	});

	it("cannot open job without enough approved", async () => {
		await pond.connect(signers[1]).approve(marketv1.address, 49);
		await expect(
			marketv1.connect(signers[1]).jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50),
		).to.be.revertedWith("ERC20: insufficient allowance");
	});

	it("cannot open job without enough balance", async () => {
		await pond.connect(signers[1]).approve(marketv1.address, 5000);
		await expect(
			marketv1.connect(signers[1]).jobOpen("some metadata", addrs[2], BN.from(5).e12(), 5000),
		).to.be.revertedWith("ERC20: transfer amount exceeds balance");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can settle job with enough balance", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 50);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		ts = jobInfo.lastSettled.toNumber();

		await time.increaseTo(ts + 5);
		await marketv1.jobSettle(ethers.constants.HashZero);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		let amount = 5 * (jobInfo.lastSettled.toNumber() - ts);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.be.equal(50 - amount);
		expect(jobInfo.lastSettled).to.be.within(ts + 5, ts + 6);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(addrs[2])).to.equal(amount);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50 - amount);
	});

	it("can settle job without enough balance", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 50);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		ts = jobInfo.lastSettled.toNumber();

		await time.increaseTo(ts + 11);
		await marketv1.jobSettle(ethers.constants.HashZero);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(0);
		expect(jobInfo.lastSettled).to.be.within(ts + 11, ts + 12);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(addrs[2])).to.equal(50);
		expect(await pond.balanceOf(marketv1.address)).to.equal(0);
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can deposit to job", async () => {
		const ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 75);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		await marketv1
			.connect(signers[1])
			.jobDeposit(ethers.constants.HashZero, 25);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(75);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(925);
		expect(await pond.balanceOf(marketv1.address)).to.equal(75);
	});

	it("cannot deposit to job without enough approved", async () => {
		const ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 74);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		await expect(marketv1
			.connect(signers[1])
			.jobDeposit(ethers.constants.HashZero, 25)).to.be.revertedWith("ERC20: insufficient allowance");
	});

	it("cannot deposit to job without enough balance", async () => {
		const ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 5000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		await expect(marketv1
			.connect(signers[1])
			.jobDeposit(ethers.constants.HashZero, 951)).to.be.revertedWith("ERC20: transfer amount exceeds balance");
	});

	it("cannot deposit to never registered job", async () => {
		await expect(marketv1
			.connect(signers[1])
			.jobDeposit(ethers.utils.hexZeroPad("0x01", 32), 25)).to.be.revertedWith("not found");
	});

	it("cannot deposit to closed job", async () => {
		const ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 5000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		await marketv1.connect(signers[1]).jobReviseRateInitiate(ethers.constants.HashZero, 0);
		await time.increase(600);
		await marketv1.connect(signers[1]).jobClose(ethers.constants.HashZero);

		await expect(marketv1
			.connect(signers[1])
			.jobDeposit(ethers.constants.HashZero, 25)).to.be.revertedWith("not found");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can withdraw from job immediately", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		ts = jobInfo.lastSettled.toNumber();

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobWithdraw(ethers.constants.HashZero, 100);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		let amount = 1 * (jobInfo.lastSettled.toNumber() - ts);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(700 - amount);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(300);
		expect(await pond.balanceOf(addrs[2])).to.equal(amount);
		expect(await pond.balanceOf(marketv1.address)).to.equal(700 - amount);
	});

	it("can withdraw from job with settlement", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		ts = jobInfo.lastSettled.toNumber();

		await time.increaseTo(ts + 20);
		await marketv1
			.connect(signers[1])
			.jobWithdraw(ethers.constants.HashZero, 100);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		let amount = 1 * (jobInfo.lastSettled.toNumber() - ts);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(700 - amount);
		expect(jobInfo.lastSettled).to.be.within(ts + 20, ts + 21);

		expect(await pond.balanceOf(addrs[1])).to.equal(300);
		expect(await pond.balanceOf(addrs[2])).to.equal(amount);
		expect(await pond.balanceOf(marketv1.address)).to.equal(700 - amount);
	});

	it("can withdraw from job after a short period with settlement", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		ts = jobInfo.lastSettled.toNumber();

		await time.increaseTo(ts + 20);
		await marketv1
			.connect(signers[1])
			.jobWithdraw(ethers.constants.HashZero, 100);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		let amount = 1 * (jobInfo.lastSettled.toNumber() - ts);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(700 - amount);
		expect(jobInfo.lastSettled).to.be.within(ts + 20, ts + 21);

		expect(await pond.balanceOf(addrs[1])).to.equal(300);
		expect(await pond.balanceOf(addrs[2])).to.equal(amount);
		expect(await pond.balanceOf(marketv1.address)).to.equal(700 - amount);
	});

	it("cannot withdraw from non existent job", async () => {
		let signer = (pond.provider as any).getSigner(ethers.constants.AddressZero);

		await expect(marketv1
			.connect(signer)
			.jobWithdraw(ethers.constants.HashZero, 100)).to.be.revertedWith("not found");
	});

	it("cannot withdraw from third party job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await expect(marketv1
			.connect(signers[2])
			.jobWithdraw(ethers.constants.HashZero, 100)).to.be.revertedWith("only job owner");
	});

	it("cannot withdraw if balance is below leftover threshold", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await time.increaseTo(ts + 300);
		await expect(marketv1
			.connect(signers[1])
			.jobWithdraw(ethers.constants.HashZero, 100)).to.be.revertedWith("not enough balance");
	});

	it("cannot withdraw if it puts balance below leftover threshold", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await time.increaseTo(ts + 20);
		await expect(marketv1
			.connect(signers[1])
			.jobWithdraw(ethers.constants.HashZero, 300)).to.be.revertedWith("not enough balance");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can initiate rate revision", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);
	});

	it("cannot initiate rate revision if already initiated", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);
		await expect(marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2)).to.be.reverted;
	});

	it("cannot initiate rate revision for non existent job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await expect(marketv1
			.jobReviseRateInitiate(ethers.utils.hexZeroPad("0x01", 32), 2)).to.be.revertedWith("only job owner");
	});

	it("cannot initiate rate revision for third party job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await expect(marketv1
			.jobReviseRateInitiate(ethers.constants.HashZero, 2)).to.be.revertedWith("only job owner");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can cancel rate revision", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await marketv1
			.connect(signers[1])
			.jobReviseRateCancel(ethers.constants.HashZero);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);
	});

	it("cannot cancel rate revision if never requested", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await expect(marketv1
			.connect(signers[1])
			.jobReviseRateCancel(ethers.constants.HashZero)).to.be.revertedWith("no request");
	});

	it("cannot cancel rate revision for non existent job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await expect(marketv1
			.connect(signers[1])
			.jobReviseRateCancel(ethers.utils.hexZeroPad("0x01", 32))).to.be.revertedWith("only job owner");
	});

	it("cannot cancel rate revision for third party job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await expect(marketv1
			.jobReviseRateCancel(ethers.constants.HashZero)).to.be.revertedWith("only job owner");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can finalize rate revision", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		ts = jobInfo.lastSettled.toNumber();

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await time.increaseTo(ts + 650);

		await marketv1
			.connect(signers[1])
			.jobReviseRateFinalize(ethers.constants.HashZero);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		let amount = 1 * (jobInfo.lastSettled.toNumber() - ts);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(2);
		expect(jobInfo.balance).to.equal(800 - amount);
		expect(jobInfo.lastSettled).to.be.within(ts + 650, ts + 651);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(addrs[2])).to.equal(amount);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800 - amount);
	});

	it("cannot finalize rate revision if never requested", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await expect(marketv1
			.connect(signers[1])
			.jobReviseRateFinalize(ethers.constants.HashZero)).to.be.reverted;
	});

	it("cannot finalize rate revision for non existent job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await expect(marketv1
			.connect(signers[1])
			.jobReviseRateFinalize(ethers.utils.hexZeroPad("0x01", 32))).to.be.revertedWith("only job owner");
	});

	it("cannot finalize rate revision for third party job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await expect(marketv1
			.jobReviseRateFinalize(ethers.constants.HashZero)).to.be.revertedWith("only job owner");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can close", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		ts = jobInfo.lastSettled.toNumber();

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 0);

		await time.increaseTo(ts + 650);

		await marketv1
			.connect(signers[1])
			.jobClose(ethers.constants.HashZero);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("");
		expect(jobInfo.owner).to.equal(ethers.constants.AddressZero);
		expect(jobInfo.provider).to.equal(ethers.constants.AddressZero);
		expect(jobInfo.rate).to.equal(0);
		expect(jobInfo.balance).to.equal(0);
		expect(jobInfo.lastSettled).to.be.equal(0);

		expect(await pond.balanceOf(addrs[1])).to.be.within(349, 350);
		expect(await pond.balanceOf(addrs[2])).to.be.within(650, 651);
		expect(await pond.balanceOf(marketv1.address)).to.equal(0);
	});

	it("can close immediately if rate is zero", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		ts = jobInfo.lastSettled.toNumber();

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 0);

		await time.increaseTo(ts + 650);

		await marketv1
			.connect(signers[1])
			.jobReviseRateFinalize(ethers.constants.HashZero);
		await marketv1
			.connect(signers[1])
			.jobClose(ethers.constants.HashZero);

		jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("");
		expect(jobInfo.owner).to.equal(ethers.constants.AddressZero);
		expect(jobInfo.provider).to.equal(ethers.constants.AddressZero);
		expect(jobInfo.rate).to.equal(0);
		expect(jobInfo.balance).to.equal(0);
		expect(jobInfo.lastSettled).to.be.equal(0);

		expect(await pond.balanceOf(addrs[1])).to.be.within(349, 350);
		expect(await pond.balanceOf(addrs[2])).to.be.within(650, 651);
		expect(await pond.balanceOf(marketv1.address)).to.equal(0);
	});

	it("cannot close if new rate is not zero", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		ts = jobInfo.lastSettled.toNumber();

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await time.increaseTo(ts + 650);

		await expect(marketv1
			.connect(signers[1])
			.jobClose(ethers.constants.HashZero)).to.be.revertedWith("rate should be zero");
	});

	it("cannot close if never requested", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await expect(marketv1
			.connect(signers[1])
			.jobClose(ethers.constants.HashZero)).to.be.reverted;
	});

	it("cannot close non existent job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await expect(marketv1
			.connect(signers[1])
			.jobClose(ethers.utils.hexZeroPad("0x01", 32))).to.be.revertedWith("only job owner");
	});

	it("cannot close third party job", async () => {
		let ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 1000);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(1).e12(), 800);

		let jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(1).e12());
		expect(jobInfo.balance).to.equal(800);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(200);
		expect(await pond.balanceOf(marketv1.address)).to.equal(800);

		await marketv1
			.connect(signers[1])
			.jobReviseRateInitiate(ethers.constants.HashZero, 2);

		await expect(marketv1
			.jobClose(ethers.constants.HashZero)).to.be.revertedWith("only job owner");
	});
});

describe("MarketV1", function() {
	let signers: Signer[];
	let addrs: string[];
	let marketv1: MarketV1;
	let pond: Contract;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const Pond = await ethers.getContractFactory("Pond");
		pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
			kind: "uups",
		});

		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1Contract = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], pond.address, SELECTORS, WAIT_TIMES],
			{ kind: "uups" },
		);
		marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
		await pond.transfer(addrs[1], 1000);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can update metadata", async () => {
		const ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 100);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		const jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		await marketv1
			.connect(signers[1])
			.jobMetadataUpdate(ethers.constants.HashZero, "some updated metadata");

		const jobInfo2 = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo2.metadata).to.equal("some updated metadata");

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);
	});

	it("cannot update metadata of other jobs", async () => {
		const ts = Math.floor(Date.now() / 1000) + 86400;
		await time.increaseTo(ts);

		await pond.connect(signers[1]).approve(marketv1.address, 100);
		await marketv1
			.connect(signers[1])
			.jobOpen("some metadata", addrs[2], BN.from(5).e12(), 50);

		const jobInfo = await marketv1.jobs(ethers.constants.HashZero);
		expect(jobInfo.metadata).to.equal("some metadata");
		expect(jobInfo.owner).to.equal(addrs[1]);
		expect(jobInfo.provider).to.equal(addrs[2]);
		expect(jobInfo.rate).to.equal(BN.from(5).e12());
		expect(jobInfo.balance).to.equal(50);
		expect(jobInfo.lastSettled).to.be.within(ts, ts + 1);

		expect(await pond.balanceOf(addrs[1])).to.equal(950);
		expect(await pond.balanceOf(marketv1.address)).to.equal(50);

		await expect(marketv1
			.jobMetadataUpdate(ethers.constants.HashZero, "some updated metadata")).to.be.revertedWith("only job owner");

	});
});
