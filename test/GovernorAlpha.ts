import { ethers, upgrades } from "hardhat";
import { expect, util } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";

declare module "ethers" {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}

BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18));
};

describe.skip("GovernorAlpha", function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;
  let timelock: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));

    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    const Timelock = await ethers.getContractFactory("Timelock");
    timelock = await upgrades.deployProxy(Timelock, [2 * 24 * 60 * 60], { kind: "uups" });
  });

  it("deploys with initialization disabled", async function () {
    const GovernorAlpha = await ethers.getContractFactory("GovernorAlpha");
    let governorAlpha = await GovernorAlpha.deploy();
    await expect(governorAlpha.initialize(timelock.address, mpond.address, addrs[1])).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const GovernorAlpha = await ethers.getContractFactory("GovernorAlpha");
    let governorAlpha = await upgrades.deployProxy(GovernorAlpha, [timelock.address, mpond.address, addrs[1]], { kind: "uups" });

    expect(await governorAlpha.timelock()).to.equal(timelock.address);
    expect(await governorAlpha.MPond()).to.equal(mpond.address);
    expect(await governorAlpha.hasRole(await governorAlpha.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await governorAlpha.guardian()).to.equal(addrs[1]);
  });

  it("upgrades", async function () {
    const GovernorAlpha = await ethers.getContractFactory("GovernorAlpha");
    let governorAlpha = await upgrades.deployProxy(GovernorAlpha, [timelock.address, mpond.address, addrs[1]], { kind: "uups" });
    await upgrades.upgradeProxy(governorAlpha.address, GovernorAlpha, { kind: "uups" });

    expect(await governorAlpha.timelock()).to.equal(timelock.address);
    expect(await governorAlpha.MPond()).to.equal(mpond.address);
    expect(await governorAlpha.hasRole(await governorAlpha.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await governorAlpha.guardian()).to.equal(addrs[1]);
  });

  it("does not upgrade without admin", async function () {
    const GovernorAlpha = await ethers.getContractFactory("GovernorAlpha");
    let governorAlpha = await upgrades.deployProxy(GovernorAlpha, [timelock.address, mpond.address, addrs[1]], { kind: "uups" });
    await expect(upgrades.upgradeProxy(governorAlpha.address, GovernorAlpha.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});