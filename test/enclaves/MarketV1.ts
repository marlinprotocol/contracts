import { expect } from "chai";
import {
  BigNumber as BN,
  Contract,
  Signer,
} from "ethers";
import {
  ethers,
  upgrades,
} from "hardhat";

import { time } from "@nomicfoundation/hardhat-network-helpers";

import {
  Credit,
  MarketV1,
} from "../../typechain-types";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import {
  getCredit,
  getMarketV1,
} from "../../utils/typechainConvertor";
import { testERC165 } from "../helpers/erc165";
import { testAdminRole } from "../helpers/rbac";

declare module "ethers" {
	interface BigNumber {
    e6(this: BigNumber): BigNumber;
    e12(this: BigNumber): BigNumber;
    e15(this: BigNumber): BigNumber;
    e16(this: BigNumber): BigNumber;
    e18(this: BigNumber): BigNumber;
	}
}

BN.prototype.e6 = function () {  
  return this.mul(BN.from(10).pow(6));
};
BN.prototype.e12 = function() {
  return this.mul(BN.from(10).pow(12));
};
BN.prototype.e15 = function() {
  return this.mul(BN.from(10).pow(15));
};
BN.prototype.e16 = function() {
  return this.mul(BN.from(10).pow(16));
};
BN.prototype.e18 = function() {
  return this.mul(BN.from(10).pow(18));
};

const RATE_LOCK = ethers.utils.id("RATE_LOCK");
const SELECTORS = [RATE_LOCK];
const WAIT_TIMES: number[] = [600];

const ONE_MINUTE = 60;
const TWO_MINUTES = 60 * 2;
const FIVE_MINUTES = 60 * 5;
const NOTICE_PERIOD = FIVE_MINUTES;
const SIGNER1_INITIAL_FUND = BN.from(1000).e6(); // 1000 USDC
const SIGNER2_INITIAL_FUND = BN.from(1000).e6(); // 1000 USDC
const JOB_RATE_1 = BN.from(1).e16();

const calcNoticePeriodCost = (rate: BN) => {
	return calcAmountToPay(rate, NOTICE_PERIOD);
};

const calcAmountToPay = (rate: BN, duration: number) => {
  return rate.mul(BN.from(duration)).add(10 ** 12 - 1).div(10 ** 12);
}

const incrementJobId = (jobId: string, increment: number) => {
  // Convert the jobId from bytes32 (hex string) to a BigNumber
  const jobIdBN = ethers.BigNumber.from(jobId);
  
  // Add the increment
  const incrementedJobIdBN = jobIdBN.add(increment);
  
  // Convert back to bytes32 (hex string) and return
  return ethers.utils.hexZeroPad(incrementedJobIdBN.toHexString(), 32);
};

const usdc = (number: number) => {
  return BN.from(number).e6();
};

testERC165(
	"MarketV1 ERC165",
	async function(_signers: Signer[], addrs: string[]) {
		const MarketV1 = await ethers.getContractFactory("MarketV1");
		const marketv1 = await upgrades.deployProxy(
			MarketV1,
			[addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
			{ kind: "uups", unsafeAllow: ["missing-initializer-call"] },
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

testAdminRole("MarketV1 Admin Role", async function(_signers: Signer[], addrs: string[]) {
	const MarketV1 = await ethers.getContractFactory("MarketV1");
	const marketv1 = await upgrades.deployProxy(
		MarketV1,
		[addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
		{ kind: "uups", unsafeAllow: ["missing-initializer-call"] },
	);
	return marketv1;
});

describe("Initialization", function () {
  let signers: Signer[];
  let addrs: string[];
  let marketv1: MarketV1;
  let creditToken: Credit;
  let token: Contract;

  let user: Signer;
  let user2: Signer;
  let provider: Signer;
  let admin: Signer;
  
  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(async (a) => await a.getAddress()));

    admin = signers[0];
    user = signers[1];
    provider = signers[2];
    user2 = signers[3];

    // Deploy USDC
    const Token = await ethers.getContractFactory("Pond");
    token = await upgrades.deployProxy(Token, ["USDC", "USDC"], {
      kind: "uups",
      unsafeAllow: ["missing-initializer-call"],
    });
    await token.transfer(await user.getAddress(), SIGNER1_INITIAL_FUND);
    await token.transfer(await user2.getAddress(), SIGNER1_INITIAL_FUND);
    // Deploy MarketV1
    const MarketV1 = await ethers.getContractFactory("MarketV1");
    const marketv1Contract = await upgrades.deployProxy(
      MarketV1,
      [addrs[0], token.address, SELECTORS, WAIT_TIMES],
      { kind: "uups", unsafeAllow: ["missing-initializer-call"] },
    );
    marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
    await token.connect(user).approve(marketv1.address, usdc(100));

    // Deploy Credit
    const Credit = await ethers.getContractFactory("Credit");
    const creditTokenContract = await upgrades.deployProxy(Credit, [], {
      kind: "uups",
      unsafeAllow: ["missing-initializer-call"],
      constructorArgs: [token.address],
      initializer: false
    });
    creditToken = getCredit(creditTokenContract.address, signers[0]);

    // Initialize Credit
    await creditToken.initialize(addrs[0]);
  });

  describe("Initialize", function () {
    takeSnapshotBeforeAndAfterEveryTest(async () => { });
  
    it("should deploy with initialization disabled", async function () {
      const MarketV1 = await ethers.getContractFactory("MarketV1");
      const marketv1 = await MarketV1.deploy();

      await expect(
        marketv1.initialize(addrs[0], addrs[11], SELECTORS, WAIT_TIMES),
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  
    it("should deploy as proxy and initializes", async function () {
      const MarketV1 = await ethers.getContractFactory("MarketV1");
      const marketv1 = await upgrades.deployProxy(
        MarketV1,
        [addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
        { kind: "uups", unsafeAllow: ["missing-initializer-call"] },
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
  
    it("should revert when initializing with mismatched lengths", async function () {
      const MarketV1 = await ethers.getContractFactory("MarketV1");
      await expect(
        upgrades.deployProxy(
          MarketV1,
          [addrs[0], addrs[11], SELECTORS, [...WAIT_TIMES, 0]],
          { kind: "uups", unsafeAllow: ["missing-initializer-call"] },
        ),
      ).to.be.reverted;
    });
  
    it("should upgrade", async function () {
      const MarketV1 = await ethers.getContractFactory("MarketV1");
      const marketv1 = await upgrades.deployProxy(
        MarketV1,
        [addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
        { kind: "uups", unsafeAllow: ["missing-initializer-call"] },
      );
      await upgrades.upgradeProxy(marketv1.address, MarketV1, { kind: "uups", unsafeAllow: ["missing-initializer-call"] });
  
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
  
    it("should revert when upgrading without admin", async function () {
      const MarketV1 = await ethers.getContractFactory("MarketV1");
      const marketv1 = await upgrades.deployProxy(
        MarketV1,
        [addrs[0], addrs[11], SELECTORS, WAIT_TIMES],
        { kind: "uups", unsafeAllow: ["missing-initializer-call"] },
      );
  
      await expect(
        upgrades.upgradeProxy(marketv1.address, MarketV1.connect(signers[1]), {
          kind: "uups",
          unsafeAllow: ["missing-initializer-call"],
        }),
      ).to.be.revertedWith("only admin");
    });
  });

  describe("Reinitialize", function () {
    it("should revert when not admin", async () => {
      await expect(marketv1.connect(user).reinitialize(FIVE_MINUTES, creditToken.address)).to.be.revertedWith("only admin");
    });

    it("should revert when reinitialized twice", async () => {
      await marketv1.connect(admin).reinitialize(FIVE_MINUTES, creditToken.address);
      await expect(marketv1.connect(admin).reinitialize(FIVE_MINUTES, creditToken.address)).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("should set correct notice period", async () => {
      await marketv1.connect(admin).reinitialize(FIVE_MINUTES, creditToken.address);
      expect(await marketv1.noticePeriod()).to.equal(FIVE_MINUTES);
    });

    it("should set correct credit token address", async () => {
      await marketv1.connect(admin).reinitialize(FIVE_MINUTES, creditToken.address);
      expect(await marketv1.creditToken()).to.equal(creditToken.address);
    });

    it("should set correct job index", async () => {
      await marketv1.connect(admin).reinitialize(FIVE_MINUTES, creditToken.address);

      const chainId = (await ethers.provider.getNetwork()).chainId;
      const chainIdHex = chainId.toString(16).padStart(16, '0'); // 16 = 8 bytes * 2
      const jobIndex = '0x' + chainIdHex + '0'.repeat(48); // 48 = 64 (bytes32) - 16 (8 bytes)
      
      expect(await marketv1.jobIndex()).to.equal(jobIndex);
    });

    it("should open job with credit token", async () => {
      await marketv1.connect(admin).reinitialize(FIVE_MINUTES, creditToken.address);

      await creditToken.connect(admin).grantRole(await creditToken.MINTER_ROLE(), await admin.getAddress());
      await creditToken.connect(admin).grantRole(await creditToken.TRANSFER_ALLOWED_ROLE(), await user.getAddress());
      await creditToken.connect(admin).grantRole(await creditToken.REDEEMER_ROLE(), marketv1.address);
      await creditToken.connect(admin).mint(await user.getAddress(), usdc(10000));
      expect(await creditToken.hasRole(await creditToken.TRANSFER_ALLOWED_ROLE(), await user.getAddress())).to.be.true;

      await expect(marketv1.connect(user).jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, usdc(100))).to.be.not.reverted;
    });
  });
});

describe("MarketV1", function () {
  let INITIAL_TIMESTAMP: number;

  let signers: Signer[];
  let addrs: string[];
  let marketv1: MarketV1;
  let creditToken: Credit;
  let token: Contract;

  let admin: Signer;
  let user: Signer;
  let provider: Signer;
  let user2: Signer;
  let admin2: Signer;

  let INITIAL_JOB_INDEX: string;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    admin = signers[0];
    user = signers[1];
    provider = signers[2];
    user2 = signers[3];
    admin2 = signers[4];
    
    // Deploy USDC
    const USDC = await ethers.getContractFactory("Pond");
    token = await upgrades.deployProxy(USDC, ["Marlin", "USDC"], {
      kind: "uups",
      unsafeAllow: ["missing-initializer-call"],
    });
    await token.transfer(addrs[1], SIGNER1_INITIAL_FUND);
    await token.transfer(addrs[3], SIGNER2_INITIAL_FUND);
    
    // Deploy MarketV1
    const MarketV1 = await ethers.getContractFactory("MarketV1");
    const marketv1Contract = await upgrades.deployProxy(
      MarketV1,
      [addrs[0], token.address, SELECTORS, WAIT_TIMES],
      { kind: "uups", unsafeAllow: ["missing-initializer-call"] },
    );
    marketv1 = getMarketV1(marketv1Contract.address, signers[0]);
    await token.connect(user).approve(marketv1.address, usdc(100));

    // Deploy Credit
    const Credit = await ethers.getContractFactory("Credit");
    const creditTokenContract = await upgrades.deployProxy(Credit, [], {
      kind: "uups",
      unsafeAllow: ["missing-initializer-call"],
      constructorArgs: [token.address],
      initializer: false
    });
    creditToken = getCredit(creditTokenContract.address, signers[0]);
    await creditToken.initialize(addrs[0]);
    await marketv1.connect(admin).reinitialize(FIVE_MINUTES, creditToken.address);
    
    await marketv1.updateNoticePeriod(FIVE_MINUTES);

    // Set initial timestamp
    await time.increaseTo(Math.floor((new Date().getTime()) / 1000));
    INITIAL_TIMESTAMP = (await ethers.provider.getBlock('latest')).timestamp;

    // Setup for using Credit
    await creditToken.connect(admin).grantRole(await creditToken.MINTER_ROLE(), await admin.getAddress());
    await creditToken.connect(admin).grantRole(await creditToken.TRANSFER_ALLOWED_ROLE(), await admin.getAddress());
    await creditToken.connect(admin).grantRole(await creditToken.TRANSFER_ALLOWED_ROLE(), marketv1.address);
    await creditToken.connect(admin).grantRole(await creditToken.REDEEMER_ROLE(), marketv1.address);
    await token.connect(admin).transfer(creditToken.address, usdc(1000));

    // Fund user with 1000 Credit
    await creditToken.connect(admin).mint(await admin.getAddress(), usdc(1000));
    await creditToken.connect(admin).transfer(await user.getAddress(), usdc(1000));

    INITIAL_JOB_INDEX = await marketv1.jobIndex();
  });

  describe("Provider Registration", function () {
    describe("Provider Registers", function () {
      takeSnapshotBeforeAndAfterEveryTest(async () => { });
    
      it("should register as provider", async () => {
        await marketv1.connect(signers[1]).providerAdd("https://example.com/");
    
        expect(await marketv1.providers(addrs[1])).to.equal("https://example.com/");
      });
    
      it("should revert when registering as provider with empty cp", async () => {
        await expect(
          marketv1.connect(signers[1]).providerAdd(""),
        ).to.be.revertedWith("invalid");
      });
    
      it("should revert when registering as provider if already registered", async () => {
        await marketv1.connect(signers[1]).providerAdd("https://example.com/");
    
        await expect(
          marketv1.connect(signers[1]).providerAdd("https://example.com/"),
        ).to.be.revertedWith("already exists");
      });
    });
  
    describe("Provider Unregisters", function () {
      takeSnapshotBeforeAndAfterEveryTest(async () => { });
    
      it("should unregister as provider", async () => {
        await marketv1.connect(signers[1]).providerAdd("https://example.com/");
        await marketv1.connect(signers[1]).providerRemove();
    
        expect(await marketv1.providers(addrs[1])).to.equal("");
      });
    
      it("should revert when unregistering as provider if never registered", async () => {
        await expect(
          marketv1.connect(signers[1]).providerRemove(),
        ).to.be.revertedWith("not found");
      });
    
      it("should revert when unregistering as provider if already unregistered", async () => {
        await marketv1.connect(signers[1]).providerAdd("https://example.com/");
        await marketv1.connect(signers[1]).providerRemove();
    
        await expect(
          marketv1.connect(signers[1]).providerRemove(),
        ).to.be.revertedWith("not found");
      });
    });
  });

  describe("cp update", function () {
    takeSnapshotBeforeAndAfterEveryTest(async () => { });
  
    it("should update cp", async () => {
      await marketv1.connect(signers[1]).providerAdd("https://example.com/");
      await marketv1
        .connect(signers[1])
        .providerUpdateWithCp("https://example.com/new");
  
      expect(await marketv1.providers(addrs[1])).to.equal(
        "https://example.com/new",
      );
    });
  
    it("should revert when updating to empty cp", async () => {
      await marketv1.connect(signers[1]).providerAdd("https://example.com/");
      await expect(
        marketv1.connect(signers[1]).providerUpdateWithCp(""),
      ).to.be.revertedWith("invalid");
    });
  
    it("should revert when updating if never registered", async () => {
      await expect(
        marketv1
          .connect(signers[1])
          .providerUpdateWithCp("https://example.com/new"),
      ).to.be.revertedWith("not found");
    });
  });
  
  describe("Job Open", function () {
    takeSnapshotBeforeAndAfterEveryTest(async () => { });
  
    it("should open job with USDC only", async () => {
      const initialBalance = usdc(50);
      const noticePeriodCost = calcNoticePeriodCost(JOB_RATE_1);

      await marketv1
        .connect(user)
        .jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, initialBalance);
  
      const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
      expect(jobInfo.metadata).to.equal("some metadata");
      expect(jobInfo.owner).to.equal(await user.getAddress());
      expect(jobInfo.provider).to.equal(await provider.getAddress());
      expect(jobInfo.rate).to.equal(JOB_RATE_1);
      expect(jobInfo.balance).to.equal(initialBalance.sub(noticePeriodCost));
      expect(jobInfo.lastSettled).to.be.within(INITIAL_TIMESTAMP, INITIAL_TIMESTAMP + 1);
      expect(jobInfo.maxRate).to.equal(JOB_RATE_1);
  
      expect(await token.balanceOf(await user.getAddress())).to.equal(SIGNER1_INITIAL_FUND.sub(initialBalance));
      expect(await token.balanceOf(marketv1.address)).to.equal(initialBalance.sub(noticePeriodCost));
    });

    it("should increment job index correctly", async () => {
      const initialBalance = usdc(10);

      const initialJobIndex = await marketv1.jobIndex();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const chainIdHex = chainId.toString(16).padStart(16, '0'); // 16 = 8 bytes * 2
      const jobIndex = '0x' + chainIdHex + '0'.repeat(48); // 48 = 64 (bytes32) - 16 (8 bytes)
      expect(initialJobIndex).to.equal(jobIndex);

      // Open First Job
      await marketv1
        .connect(user)
        .jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, initialBalance);
      
      const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
      expect(jobInfo.metadata).to.equal("some metadata");

      // Open Second Job
      await marketv1
        .connect(user)
        .jobOpen("some metadata2", await provider.getAddress(), JOB_RATE_1, initialBalance);
      const jobInfo2 = await marketv1.jobs(incrementJobId(INITIAL_JOB_INDEX, 1));
      expect(jobInfo2.metadata).to.equal("some metadata2");

      // Open Third Job
      await marketv1
        .connect(user)
        .jobOpen("some metadata3", await provider.getAddress(), JOB_RATE_1, initialBalance);
      const jobInfo3 = await marketv1.jobs(incrementJobId(INITIAL_JOB_INDEX, 2));
      expect(jobInfo3.metadata).to.equal("some metadata3");
    });

    it("should open job with Credit only", async () => {
      const initialBalance = usdc(50);
      const noticePeriodCost = calcNoticePeriodCost(JOB_RATE_1);

      await creditToken.connect(user).approve(marketv1.address, initialBalance);
      await marketv1
        .connect(user)
        .jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, initialBalance);
  
      const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
      expect(jobInfo.metadata).to.equal("some metadata");
      expect(jobInfo.owner).to.equal(await user.getAddress());
      expect(jobInfo.provider).to.equal(await provider.getAddress());
      expect(jobInfo.rate).to.equal(JOB_RATE_1);
      expect(jobInfo.balance).to.equal(initialBalance.sub(noticePeriodCost));
      expect(jobInfo.lastSettled).to.be.within(INITIAL_TIMESTAMP, INITIAL_TIMESTAMP + 1);

      expect(await marketv1.jobCreditBalance(INITIAL_JOB_INDEX)).to.equal(initialBalance.sub(noticePeriodCost));
    });

    it("should open job with USDC and Credit", async () => {
      const totalBalance = usdc(50);
      const creditBalance = usdc(10);
      const noticePeriodCost = calcNoticePeriodCost(JOB_RATE_1);

      await creditToken.connect(user).approve(marketv1.address, creditBalance);
      await marketv1
        .connect(user)
        .jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, totalBalance);

      const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
      expect(jobInfo.metadata).to.equal("some metadata");
      expect(jobInfo.owner).to.equal(await user.getAddress());
      expect(jobInfo.provider).to.equal(await provider.getAddress());
      expect(jobInfo.rate).to.equal(JOB_RATE_1);
      expect(jobInfo.balance).to.equal(totalBalance.sub(noticePeriodCost));
      expect(await marketv1.jobCreditBalance(INITIAL_JOB_INDEX)).to.equal(creditBalance.sub(noticePeriodCost));
    })
  
    it("should revert when opening job without enough approved", async () => {
      await expect(
        marketv1.connect(signers[1]).jobOpen("some metadata", addrs[2], JOB_RATE_1, usdc(150)), // 100 USDC approved
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  
    it("should revert when opening job without enough balance", async () => {
      await token.connect(signers[1]).approve(marketv1.address, usdc(5000));
      await expect(
        marketv1.connect(signers[1]).jobOpen("some metadata", addrs[2], JOB_RATE_1, usdc(5000)),
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Job Settle", function () {
    const initialDeposit = usdc(50);
    const initialBalance = initialDeposit.sub(calcNoticePeriodCost(JOB_RATE_1));
    let jobOpenActualTimestamp: number;

    takeSnapshotBeforeAndAfterEveryTest(async () => { });

    describe("USDC Only", function () {

      beforeEach(async () => {
        await token.connect(user).approve(marketv1.address, initialDeposit);
        await marketv1
          .connect(user)
          .jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, initialDeposit);
        jobOpenActualTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      });

      describe("CASE1: Settle Job immediately after Job Open", function () {
        it("should have balance and lastSettled reflecting initial state after open", async () => {
          const jobBeforeSettle = await marketv1.jobs(INITIAL_JOB_INDEX);
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);

          expect(jobInfo.balance).to.equal(initialBalance);
          expect(jobInfo.lastSettled).to.be.closeTo(jobOpenActualTimestamp, 2);
        });
      });
  
      describe("CASE2: Settle Job 2 minutes after Job Open", function () {
        it("should settle for 2 minutes", async () => {
          const DURATION_TO_SETTLE = TWO_MINUTES;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);
  
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);

          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 2);
          expect(jobInfo.balance).to.equal(initialBalance.sub(calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE)));
        });
      });
  
      describe("CASE3: Settle Job 1 second before notice period", function () {
        it("should settle for (notice period - 1 second)", async () => {
          const DURATION_TO_SETTLE = NOTICE_PERIOD - 1;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);

          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);

          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 2);
          expect(jobInfo.balance).to.equal(initialBalance.sub(calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE)));
        });
      });
  
      describe("CASE4: Settle Job 2 minutes after notice period", function () {
        it("should spend for (notice period + 2 minutes)", async () => {
          const DURATION_TO_SETTLE = NOTICE_PERIOD + TWO_MINUTES;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);
  
          const noticeCostPaidAtOpen = calcNoticePeriodCost(JOB_RATE_1);
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
  
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          expect(jobInfo.metadata).to.equal("some metadata");
          expect(jobInfo.owner).to.equal(await user.getAddress());
          expect(jobInfo.provider).to.equal(await provider.getAddress());
          expect(jobInfo.rate).to.equal(JOB_RATE_1);
  
          const amountPaidThisSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
          const jobBalanceExpected = initialBalance.sub(amountPaidThisSettle);
          expect(jobInfo.balance).to.be.closeTo(jobBalanceExpected, 2);
  
          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 2);
  
          const userBalanceExpected = SIGNER1_INITIAL_FUND.sub(initialDeposit);
          expect(await token.balanceOf(await user.getAddress())).to.equal(userBalanceExpected);
  
          const providerBalanceExpected = noticeCostPaidAtOpen.add(amountPaidThisSettle);
          expect(await token.balanceOf(await provider.getAddress())).to.be.closeTo(providerBalanceExpected, 2);
  
          expect(await token.balanceOf(marketv1.address)).to.be.closeTo(jobBalanceExpected, 2);
        });
      });
    });

    describe("Credit Only", function () {
      beforeEach(async () => {
        await creditToken.connect(user).approve(marketv1.address, initialDeposit);
        await marketv1
          .connect(user)
          .jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, initialDeposit);
        jobOpenActualTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      });

      describe("CASE1: Settle Job immediately after Job Open", function () {
        it("should have balance and lastSettled reflecting initial state after open", async () => {
          const jobBeforeSettle = await marketv1.jobs(INITIAL_JOB_INDEX);
          const creditBalanceBeforeSettle = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const creditBalanceAfterSettle = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          expect(jobInfo.balance).to.equal(initialBalance);
          expect(jobInfo.lastSettled).to.be.closeTo(jobOpenActualTimestamp, 2);
          expect(creditBalanceAfterSettle).to.equal(creditBalanceBeforeSettle);
          expect(creditBalanceAfterSettle).to.equal(initialBalance);
        });
      });
  
      describe("CASE2: Settle Job 2 minutes after Job Open", function () {
        it("should settle for 2 minutes using credit", async () => {
          const DURATION_TO_SETTLE = TWO_MINUTES;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);

          const amountToSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
  
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const jobCreditBal = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 2);
          expect(jobInfo.balance).to.equal(initialBalance.sub(amountToSettle));
          expect(jobCreditBal).to.equal(initialBalance.sub(amountToSettle));
        });
      });
  
      describe("CASE3: Settle Job exactly after notice period", function () {
        it("should settle for notice period duration using credit", async () => {
          const DURATION_TO_SETTLE = NOTICE_PERIOD;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);

          const amountToSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
  
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const jobCreditBal = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 2);
          expect(jobInfo.balance).to.equal(initialBalance.sub(amountToSettle));
          expect(jobCreditBal).to.equal(initialBalance.sub(amountToSettle));
        });
      });
  
      describe("CASE4: Settle Job 2 minutes after notice period", function () {
        it("should spend notice period cost and 2 minutes worth tokens from credit", async () => {
          const DURATION_TO_SETTLE = NOTICE_PERIOD + TWO_MINUTES;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);
  
          const noticeCostPaidAtOpen = calcNoticePeriodCost(JOB_RATE_1);
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);

          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const jobCreditBal = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);
          expect(jobInfo.metadata).to.equal("some metadata");
          expect(jobInfo.owner).to.equal(await user.getAddress());
          expect(jobInfo.provider).to.equal(await provider.getAddress());
          expect(jobInfo.rate).to.equal(JOB_RATE_1);
  
          const amountPaidThisSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
          const jobBalanceExpected = initialBalance.sub(amountPaidThisSettle);
          expect(jobInfo.balance).to.be.closeTo(jobBalanceExpected, 2);
          expect(jobCreditBal).to.be.closeTo(jobBalanceExpected, 2);
  
          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 3);
  
          const providerBalanceExpected = noticeCostPaidAtOpen.add(amountPaidThisSettle);
          expect(await token.balanceOf(await provider.getAddress())).to.be.closeTo(providerBalanceExpected, 2);
  
          expect(await token.balanceOf(marketv1.address)).to.equal(0);
          expect(await creditToken.balanceOf(marketv1.address)).to.be.closeTo(jobCreditBal, 2);
        });
      });
    });

    describe("Credit and USDC", function () {
      const creditDeposit = usdc(10);
      const usdcDeposit = usdc(40);

      beforeEach(async () => {
        await token.connect(user).approve(marketv1.address, usdcDeposit);
        await creditToken.connect(user).approve(marketv1.address, creditDeposit);
        await marketv1
          .connect(user)
          .jobOpen("some metadata", await provider.getAddress(), JOB_RATE_1, usdcDeposit.add(creditDeposit));
        jobOpenActualTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      });

      describe("CASE1: Settle Job immediately after Job Open", function () {
        it("should have balance and lastSettled reflecting initial state after open", async () => {
          const jobBeforeSettle = await marketv1.jobs(INITIAL_JOB_INDEX);
          const creditBalanceBeforeSettle = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const creditBalanceAfterSettle = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          expect(jobInfo.balance).to.equal(initialBalance);
          expect(jobInfo.lastSettled).to.be.closeTo(jobOpenActualTimestamp, 2);
          expect(creditBalanceAfterSettle).to.equal(creditBalanceBeforeSettle);
          expect(creditBalanceAfterSettle).to.equal(creditDeposit.sub(calcNoticePeriodCost(JOB_RATE_1)));
        });
      });
  
      describe("CASE2: Settle Job 2 minutes after Job Open", function () {
        it("should settle for 2 minutes, using credit then USDC", async () => {
          const DURATION_TO_SETTLE = TWO_MINUTES;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);

          const amountToSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
          const initialJobCreditBalance = creditDeposit.sub(calcNoticePeriodCost(JOB_RATE_1));

          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const jobCreditBal = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 2);
          expect(jobInfo.balance).to.equal(initialBalance.sub(amountToSettle));
          
          let expectedCreditBalanceAfterSettle = initialJobCreditBalance.sub(amountToSettle);
          if (expectedCreditBalanceAfterSettle.lt(0)) {
            expectedCreditBalanceAfterSettle = BN.from(0);
          }
          expect(jobCreditBal).to.equal(expectedCreditBalanceAfterSettle);
        });
      });
  
      describe("CASE3: Settle Job exactly after notice period", function () {
        it("should settle for notice period, using credit then USDC", async () => {
          const DURATION_TO_SETTLE = NOTICE_PERIOD;
          const expectedSettledTimestamp = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(expectedSettledTimestamp);

          const amountToSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
          const initialJobCreditBalance = creditDeposit.sub(calcNoticePeriodCost(JOB_RATE_1));

          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);
          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const jobCreditBal = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          expect(jobInfo.lastSettled).to.be.closeTo(expectedSettledTimestamp, 2);
          expect(jobInfo.balance).to.equal(initialBalance.sub(amountToSettle));
          
          let expectedCreditBalanceAfterSettle = initialJobCreditBalance.sub(amountToSettle);
          if (expectedCreditBalanceAfterSettle.lt(0)) {
            expectedCreditBalanceAfterSettle = BN.from(0);
          }
          expect(jobCreditBal).to.equal(expectedCreditBalanceAfterSettle);
        });
      });
  
      describe("CASE4: Settle Job 2 minutes after notice period - credit might be used up", function () {
        it("should settle, exhausting credit first, then USDC", async () => {
          const DURATION_TO_SETTLE = NOTICE_PERIOD + TWO_MINUTES;
          const TIME_JOB_SETTLE_TARGET = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(TIME_JOB_SETTLE_TARGET);

          const noticeCostPaidAtOpen = calcNoticePeriodCost(JOB_RATE_1);
          const initialJobCreditBalance = creditDeposit.sub(noticeCostPaidAtOpen);
  
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);

          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const finalJobCreditBalance = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);

          expect(jobInfo.metadata).to.equal("some metadata");
          expect(jobInfo.owner).to.equal(await user.getAddress());
          expect(jobInfo.provider).to.equal(await provider.getAddress());
          expect(jobInfo.rate).to.equal(JOB_RATE_1);
          
          const amountPaidThisSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
          const jobBalanceExpected = initialBalance.sub(amountPaidThisSettle);
          expect(jobInfo.balance).to.be.closeTo(jobBalanceExpected, 2);
          
          expect(jobInfo.lastSettled).to.be.closeTo(TIME_JOB_SETTLE_TARGET, 3);
          
          let expectedFinalCreditBalance = initialJobCreditBalance.sub(amountPaidThisSettle);
          if (expectedFinalCreditBalance.lt(0)) {
            expectedFinalCreditBalance = BN.from(0);
          }
          expect(finalJobCreditBalance).to.equal(expectedFinalCreditBalance);
  
          const providerPaymentThisSettle = amountPaidThisSettle;
          const providerBalanceExpected = noticeCostPaidAtOpen.add(providerPaymentThisSettle);
          expect(await token.balanceOf(await provider.getAddress())).to.be.closeTo(providerBalanceExpected, 2);
  
          const expectedMarketV1UsdcBalance = jobBalanceExpected.sub(expectedFinalCreditBalance);
          expect(await token.balanceOf(marketv1.address)).to.be.closeTo(expectedMarketV1UsdcBalance, 2);
          expect(await creditToken.balanceOf(marketv1.address)).to.equal(expectedFinalCreditBalance);
        });
      });

      describe("CASE5: Settle Job 20 minutes after notice period - both Credit and USDC are settled", function () {
        it("should settle all Credits and some USDC", async () => {
          const DURATION_TO_SETTLE = NOTICE_PERIOD + 60 * 20;
          const TIME_JOB_SETTLE_TARGET = jobOpenActualTimestamp + DURATION_TO_SETTLE;
          await time.increaseTo(TIME_JOB_SETTLE_TARGET);

          const noticeCostPaidAtOpen = calcNoticePeriodCost(JOB_RATE_1);
          const initialJobCreditBalance = creditDeposit.sub(noticeCostPaidAtOpen);
  
          await marketv1.connect(user).jobSettle(INITIAL_JOB_INDEX);

          const jobInfo = await marketv1.jobs(INITIAL_JOB_INDEX);
          const finalJobCreditBalance = await marketv1.jobCreditBalance(INITIAL_JOB_INDEX);
          expect(jobInfo.metadata).to.equal("some metadata");
          
          const amountPaidThisSettle = calcAmountToPay(JOB_RATE_1, DURATION_TO_SETTLE);
          const jobBalanceExpected = initialBalance.sub(amountPaidThisSettle);
          expect(jobInfo.balance).to.be.closeTo(jobBalanceExpected, 2);
          
          expect(jobInfo.lastSettled).to.be.closeTo(TIME_JOB_SETTLE_TARGET, 3);
          
          expect(finalJobCreditBalance).to.equal(0); 
  
          const providerPaymentThisSettle = amountPaidThisSettle;
          const providerBalanceExpected = noticeCostPaidAtOpen.add(providerPaymentThisSettle);
          expect(await token.balanceOf(await provider.getAddress())).to.be.closeTo(providerBalanceExpected, 2);
  
          expect(await token.balanceOf(marketv1.address)).to.be.closeTo(jobBalanceExpected, 2);
          expect(await creditToken.balanceOf(marketv1.address)).to.equal(0);
        });
      });
    });
  }); 
});