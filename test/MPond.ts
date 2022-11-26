import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { BigNumber as BN, Signer, Contract } from "ethers";

declare module "ethers" {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18));
};

describe("MPond", function () {
  let signers: Signer[];
  let addrs: string[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
  });

  it("deploys with initialization disabled", async function () {
    const MPond = await ethers.getContractFactory("MPond");
    let mpond = await MPond.deploy();

    await expect(mpond.initialize()).to.be.reverted;
  });

  it("deploys as proxy and initializes", async function () {
    const MPond = await ethers.getContractFactory("MPond");
    const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.hasRole(await mpond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it("upgrades", async function () {
    const MPond = await ethers.getContractFactory("MPond");
    const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    await upgrades.upgradeProxy(mpond.address, MPond, { kind: "uups" });

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.hasRole(await mpond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it("does not upgrade without admin", async function () {
    const MPond = await ethers.getContractFactory("MPond");
    const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    await expect(upgrades.upgradeProxy(mpond.address, MPond.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

describe("MPond", function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
  });

  it("supports ERC167", async function () {
    const iid = ethers.utils.id("supportsInterface(bytes4)").substr(0, 10);
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });

  it("does not support 0xffffffff", async function () {
    expect(await mpond.supportsInterface("0xffffffff")).to.be.false;
  });

  function makeInterfaceId(interfaces: string[]): string {
    return ethers.utils.hexlify(
      interfaces.map((i) => ethers.utils.arrayify(ethers.utils.id(i).substr(0, 10))).reduce((i1, i2) => i1.map((i, idx) => i ^ i2[idx]))
    );
  }

  it("supports IAccessControl", async function () {
    let interfaces = [
      "hasRole(bytes32,address)",
      "getRoleAdmin(bytes32)",
      "grantRole(bytes32,address)",
      "revokeRole(bytes32,address)",
      "renounceRole(bytes32,address)",
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });

  it("supports IAccessControlEnumerable", async function () {
    let interfaces = ["getRoleMember(bytes32,uint256)", "getRoleMemberCount(bytes32)"];
    const iid = makeInterfaceId(interfaces);
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });

  it('supports IArbToken', async function () {
    let interfaces = [
      'bridgeMint(address,uint256)',
      'bridgeBurn(address,uint256)',
      'l1Address()',
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });
});

describe("MPond", function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;
  let DEFAULT_ADMIN_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    DEFAULT_ADMIN_ROLE = await mpond.DEFAULT_ADMIN_ROLE();
  });

  it("admin can grant admin role", async function () {
    await mpond.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await mpond.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;
  });

  it("non admin cannot grant admin role", async function () {
    await expect(mpond.connect(signers[1]).grantRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can revoke admin role", async function () {
    await mpond.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await mpond.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await mpond.revokeRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await mpond.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it("non admin cannot revoke admin role", async function () {
    await mpond.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await mpond.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(mpond.connect(signers[2]).revokeRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can renounce own admin role if there are other admins", async function () {
    await mpond.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await mpond.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await mpond.connect(signers[1]).renounceRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await mpond.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it("admin cannot renounce own admin role if there are no other admins", async function () {
    await expect(mpond.renounceRole(DEFAULT_ADMIN_ROLE, addrs[0])).to.be.reverted;
  });

  it("admin cannot renounce admin role of other admins", async function () {
    await mpond.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await mpond.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(mpond.renounceRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });
});

describe("MPond", function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;
  let WHITELIST_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
  });

  it("admin can grant whitelist role", async function () {
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.true;
  });

  it("non admin cannot grant whitelist role", async function () {
    await expect(mpond.connect(signers[1]).grantRole(WHITELIST_ROLE, addrs[1])).to.be.reverted;
  });

  it("admin can revoke whitelist role", async function () {
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.true;

    await mpond.revokeRole(WHITELIST_ROLE, addrs[1]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.false;
  });

  it("non admin cannot revoke whitelist role", async function () {
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.true;

    await expect(mpond.connect(signers[2]).revokeRole(WHITELIST_ROLE, addrs[1])).to.be.reverted;
  });

  it("whitelisted signer can renounce own whitelist role", async function () {
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.true;

    await mpond.connect(signers[1]).renounceRole(WHITELIST_ROLE, addrs[1]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.false;
  });

  it("transfer should be whitelisted if addr1 is whitelisted", async function () {
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.true;

    expect(await mpond.isWhitelistedTransfer(addrs[1], addrs[2])).to.be.true;
  });

  it("transfer should be whitelisted if addr2 is whitelisted", async function () {
    await mpond.grantRole(WHITELIST_ROLE, addrs[2]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[2])).to.be.true;

    expect(await mpond.isWhitelistedTransfer(addrs[1], addrs[2])).to.be.true;
  });

  it("transfer should be whitelisted if both addr1 and addr2 are whitelisted", async function () {
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[2]);
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[1])).to.be.true;
    expect(await mpond.hasRole(WHITELIST_ROLE, addrs[2])).to.be.true;

    expect(await mpond.isWhitelistedTransfer(addrs[1], addrs[2])).to.be.true;
  });

  it("transfer should not be whitelisted if neither addr1 nor addr2 are whitelisted", async function () {
    expect(await mpond.isWhitelistedTransfer(addrs[1], addrs[2])).to.be.false;
  });
});

describe("MPond", function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
  });

  it("name is Marlin MPond", async function () {
    expect(await mpond.name()).to.equal("Marlin MPond");
  });

  it("symbol is MPond", async function () {
    expect(await mpond.symbol()).to.equal("MPond");
  });

  it("decimals is 18", async function () {
    expect(await mpond.decimals()).to.equal(18);
  });

  it("total supply is 10000", async function () {
    expect(await mpond.totalSupply()).to.equal(BN.from(10000).e18());
  });
});

describe("MPond", function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
  });

  it("can grant small finite transfer allowance", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], 1234);

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(1234);
  });

  it("can grant large finite transfer allowance up to 2^96 - 1", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(96).sub(1));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(BN.from(2).pow(96).sub(1));
  });

  it("can grant infinite transfer allowance", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(256).sub(1));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(BN.from(2).pow(96).sub(1));
  });

  it("cannot grant finite transfer allowance over 2^96 - 1", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await expect(mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(96).sub(0))).to.be.reverted;
    await expect(mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(256).sub(2))).to.be.reverted;
  });

  it("can increase by small finite transfer allowance", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], 1234);

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(1234);
    await mpond.connect(signers[1]).increaseAllowance(addrs[2], 5678);

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(6912);
  });

  it("can increase by large finite transfer allowance up to 2^96 - 1", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], 1234);

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(1234);
    await mpond.connect(signers[1]).increaseAllowance(addrs[2], BN.from(2).pow(96).sub(1).sub(1234));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(BN.from(2).pow(96).sub(1));
  });

  it("can increase by infinite transfer allowance from zero", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).increaseAllowance(addrs[2], BN.from(2).pow(256).sub(1));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(BN.from(2).pow(96).sub(1));
  });

  it("cannot increase by infinite transfer allowance from non-zero", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).increaseAllowance(addrs[2], 1);

    await expect(mpond.connect(signers[1]).increaseAllowance(addrs[2], BN.from(2).pow(256).sub(1))).to.be.reverted;
  });

  it("cannot increase finite transfer allowance over 2^96 - 1", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await expect(mpond.connect(signers[1]).increaseAllowance(addrs[2], BN.from(2).pow(96).sub(0))).to.be.reverted;
    await expect(mpond.connect(signers[1]).increaseAllowance(addrs[2], BN.from(2).pow(256).sub(2))).to.be.reverted;
  });

  it("can decrease by small finite transfer allowance", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], 5678);

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(5678);
    await mpond.connect(signers[1]).decreaseAllowance(addrs[2], 1234);

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(4444);
  });

  it("can decrease by large finite transfer allowance up to 2^96 - 1", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(96).sub(1));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(BN.from(2).pow(96).sub(1));
    await mpond.connect(signers[1]).decreaseAllowance(addrs[2], BN.from(2).pow(96).sub(1).sub(1234));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(1234);
  });

  it("can decrease by infinite transfer allowance from infinite", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(96).sub(1));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(BN.from(2).pow(96).sub(1));
    await mpond.connect(signers[1]).decreaseAllowance(addrs[2], BN.from(2).pow(256).sub(1));

    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
  });

  it("cannot decrease by infinite transfer allowance from finite", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(96).sub(2));

    await expect(mpond.connect(signers[1]).decreaseAllowance(addrs[2], BN.from(2).pow(256).sub(1))).to.be.reverted;
  });

  it("cannot decrease finite transfer allowance over 2^96 - 1", async function () {
    expect(await mpond.allowance(addrs[1], addrs[2])).to.equal(0);
    await mpond.connect(signers[1]).approve(addrs[2], BN.from(2).pow(96).sub(1));

    await expect(mpond.connect(signers[1]).decreaseAllowance(addrs[2], BN.from(2).pow(96).sub(0))).to.be.reverted;
    await expect(mpond.connect(signers[1]).decreaseAllowance(addrs[2], BN.from(2).pow(256).sub(2))).to.be.reverted;
  });
});

describe("MPond", function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;
  let WHITELIST_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map((a) => a.getAddress()));
    const MPond = await ethers.getContractFactory("MPond");
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
  });

  it("transfer should happen if addr0 is whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.transfer(addrs[1], 1234);

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.balanceOf(addrs[1])).to.equal(1234);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(1234);
  });

  it("transfer should happen if addr1 is whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.transfer(addrs[1], 1234);

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.balanceOf(addrs[1])).to.equal(1234);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(1234);
  });

  it("transfer should happen if addr0 and addr1 are whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.transfer(addrs[1], 1234);

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.balanceOf(addrs[1])).to.equal(1234);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(1234);
  });

  it("transfer should fail if neither addr0 nor addr1 are whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await expect(mpond.transfer(addrs[1], 1234)).to.be.reverted;
  });

  it("transfer should fail when not enough token balance", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await expect(mpond.connect(signers[1]).transfer(addrs[0], 1234)).to.be.reverted;
  });

  it("transfer should fail when not enough undelegated balance", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.delegate(addrs[1], BN.from(10000).e18().sub(1233));
    await expect(mpond.transfer(addrs[1], 1234)).to.be.reverted;
  });

  it("transfer should happen if amount is balance", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.transfer(addrs[1], BN.from(10000).e18());

    expect(await mpond.balanceOf(addrs[0])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(0);
    expect(await mpond.balanceOf(addrs[1])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(BN.from(10000).e18());
  });

  it("transferFrom should happen if addr0 is whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.approve(addrs[2], 1234);
    await mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], 1234);

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.balanceOf(addrs[1])).to.equal(1234);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(1234);
  });

  it("transferFrom should happen if addr1 is whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.approve(addrs[2], 1234);
    await mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], 1234);

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.balanceOf(addrs[1])).to.equal(1234);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(1234);
  });

  it("transferFrom should happen if addr0 and addr1 are whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.approve(addrs[2], 1234);
    await mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], 1234);

    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18().sub(1234));
    expect(await mpond.balanceOf(addrs[1])).to.equal(1234);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(1234);
  });

  it("transferFrom should fail if neither addr0 nor addr1 are whitelisted", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.approve(addrs[2], 1234);
    await expect(mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], 1234)).to.be.reverted;
  });

  it("transferFrom should fail when not enough allowance", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.approve(addrs[2], 1233);
    await expect(mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], 1234)).to.be.reverted;
  });

  it("transferFrom should fail when not enough token balance", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.transfer(addrs[1], BN.from(10000).e18().sub(1233));
    await mpond.approve(addrs[2], 1234);
    await expect(mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], 1234)).to.be.reverted;
  });

  it("transferFrom should fail when not enough undelegated balance", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.delegate(addrs[1], BN.from(10000).e18().sub(1233));
    await mpond.approve(addrs[2], 1234);
    await expect(mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], 1234)).to.be.reverted;
  });

  it("transferFrom should happen if amount is balance", async function () {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.balanceOf(addrs[1])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(0);

    await mpond.grantRole(WHITELIST_ROLE, addrs[0]);
    await mpond.grantRole(WHITELIST_ROLE, addrs[1]);
    await mpond.approve(addrs[2], BN.from(10000).e18());
    await mpond.connect(signers[2]).transferFrom(addrs[0], addrs[1], BN.from(10000).e18());

    expect(await mpond.balanceOf(addrs[0])).to.equal(0);
    expect(await mpond.undelegatedBalanceOf(addrs[0])).to.equal(0);
    expect(await mpond.balanceOf(addrs[1])).to.equal(BN.from(10000).e18());
    expect(await mpond.undelegatedBalanceOf(addrs[1])).to.equal(BN.from(10000).e18());
  });
});

describe('MPond', function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;
  let WHITELIST_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const MPond = await ethers.getContractFactory('MPond');
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    WHITELIST_ROLE = await mpond.WHITELIST_ROLE();
  });

  it('can get delegation for 0 address', async function() {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.getDelegates(addrs[0], '0x0000000000000000000000000000000000000000')).to.equal(BN.from(10000).e18());
  });

  it('can get delegation for non zero address', async function() {
    expect(await mpond.balanceOf(addrs[0])).to.equal(BN.from(10000).e18());
    expect(await mpond.getDelegates(addrs[0], addrs[1])).to.equal(0);
    await mpond.delegate(addrs[1], 1234);
    expect(await mpond.getDelegates(addrs[0], addrs[1])).to.equal(1234);
  });
});

describe('MPond', function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;
  let BRIDGE_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const MPond = await ethers.getContractFactory('MPond');
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    BRIDGE_ROLE = await mpond.BRIDGE_ROLE();
  });

  it('admin can grant bridge role', async function () {
    await mpond.grantRole(BRIDGE_ROLE, addrs[1]);
    expect(await mpond.hasRole(BRIDGE_ROLE, addrs[1])).to.be.true;
  });

  it('non admin cannot grant bridge role', async function () {
    await expect(mpond.connect(signers[1]).grantRole(BRIDGE_ROLE, addrs[1])).to.be.reverted;
  });

  it('admin can revoke bridge role', async function () {
    await mpond.grantRole(BRIDGE_ROLE, addrs[1]);
    expect(await mpond.hasRole(BRIDGE_ROLE, addrs[1])).to.be.true;

    await mpond.revokeRole(BRIDGE_ROLE, addrs[1]);
    expect(await mpond.hasRole(BRIDGE_ROLE, addrs[1])).to.be.false;
  });

  it('non admin cannot revoke bridge role', async function () {
    await mpond.grantRole(BRIDGE_ROLE, addrs[1]);
    expect(await mpond.hasRole(BRIDGE_ROLE, addrs[1])).to.be.true;

    await expect(mpond.connect(signers[2]).revokeRole(BRIDGE_ROLE, addrs[1])).to.be.reverted;
  });

  it('bridge signer can renounce own bridge role', async function () {
    await mpond.grantRole(BRIDGE_ROLE, addrs[1]);
    expect(await mpond.hasRole(BRIDGE_ROLE, addrs[1])).to.be.true;

    await mpond.connect(signers[1]).renounceRole(BRIDGE_ROLE, addrs[1]);
    expect(await mpond.hasRole(BRIDGE_ROLE, addrs[1])).to.be.false;
  });
});

describe('MPond', function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const MPond = await ethers.getContractFactory('MPond');
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    await mpond.grantRole(await mpond.WHITELIST_ROLE(), addrs[0]);
  });

  it('admin can set l1 address', async function () {
    await mpond.setL1Address(addrs[1]);
    expect(await mpond.l1Address()).to.equal(addrs[1]);
  });

  it('non admin cannot set l1 address', async function () {
    await expect(mpond.connect(signers[1]).setL1Address(addrs[1])).to.be.reverted;
  });

  it('admin can withdraw', async function () {
    let balance = await mpond.balanceOf(addrs[0]);
    await mpond.transfer(mpond.address, 1000);
    expect(await mpond.balanceOf(mpond.address)).to.equal(1000);
    expect(await mpond.balanceOf(addrs[0])).to.equal(balance.sub(1000));

    await mpond.withdraw(200);
    expect(await mpond.balanceOf(mpond.address)).to.equal(800);
    expect(await mpond.balanceOf(addrs[0])).to.equal(balance.sub(800));
  });

  it('non admin cannot withdraw', async function () {
    await mpond.transfer(mpond.address, 1000);
    await expect(mpond.connect(signers[1]).withdraw(200)).to.be.reverted;
  });
});

describe('MPond', function () {
  let signers: Signer[];
  let addrs: string[];
  let mpond: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const MPond = await ethers.getContractFactory('MPond');
    mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    await mpond.grantRole(await mpond.BRIDGE_ROLE(), addrs[1]);
    await mpond.grantRole(await mpond.WHITELIST_ROLE(), addrs[0]);
    await mpond.transfer(mpond.address, 1000);
  });

  it('non bridge cannot mint', async function () {
    await expect(mpond.connect(signers[2]).bridgeMint(addrs[2], 100)).to.be.reverted;
  });

  it('bridge can mint up to its balance', async function () {
    expect(await mpond.balanceOf(addrs[2])).to.equal(0);
    expect(await mpond.balanceOf(addrs[3])).to.equal(0);
    expect(await mpond.balanceOf(mpond.address)).to.equal(1000);

    await mpond.connect(signers[1]).bridgeMint(addrs[2], 100);

    expect(await mpond.balanceOf(addrs[2])).to.equal(100);
    expect(await mpond.balanceOf(addrs[3])).to.equal(0);
    expect(await mpond.balanceOf(mpond.address)).to.equal(900);

    await mpond.connect(signers[1]).bridgeMint(addrs[3], 900);

    expect(await mpond.balanceOf(addrs[2])).to.equal(100);
    expect(await mpond.balanceOf(addrs[3])).to.equal(900);
    expect(await mpond.balanceOf(mpond.address)).to.equal(0);
  });

  it('bridge cannot mint beyond its balance', async function () {
    await expect(mpond.connect(signers[1]).bridgeMint(addrs[2], 1001)).to.be.reverted;

    await mpond.connect(signers[1]).bridgeMint(addrs[2], 100);

    await expect(mpond.connect(signers[1]).bridgeMint(addrs[2], 901)).to.be.reverted;
  });

  it('non bridge cannot burn', async function () {
    await mpond.transfer(addrs[2], 1000);
    await mpond.transfer(addrs[3], 1000);
    await expect(mpond.connect(signers[2]).bridgeBurn(addrs[2], 100)).to.be.reverted;
  });

  it('bridge can burn up to users balance', async function () {
    await mpond.transfer(addrs[2], 1000);
    await mpond.transfer(addrs[3], 1000);
    expect(await mpond.balanceOf(addrs[2])).to.equal(1000);
    expect(await mpond.balanceOf(addrs[3])).to.equal(1000);
    expect(await mpond.balanceOf(mpond.address)).to.equal(1000);

    await mpond.connect(signers[1]).bridgeBurn(addrs[2], 100);
    await mpond.connect(signers[1]).bridgeBurn(addrs[3], 600);

    expect(await mpond.balanceOf(addrs[2])).to.equal(900);
    expect(await mpond.balanceOf(addrs[3])).to.equal(400);
    expect(await mpond.balanceOf(mpond.address)).to.equal(1700);

    await mpond.connect(signers[1]).bridgeBurn(addrs[2], 900);
    await mpond.connect(signers[1]).bridgeBurn(addrs[3], 400);

    expect(await mpond.balanceOf(addrs[2])).to.equal(0);
    expect(await mpond.balanceOf(addrs[3])).to.equal(0);
    expect(await mpond.balanceOf(mpond.address)).to.equal(3000);
  });

  it('bridge cannot burn beyond users balance', async function () {
    await mpond.transfer(addrs[2], 1000);
    await expect(mpond.connect(signers[1]).bridgeBurn(addrs[2], 1001)).to.be.reverted;

    await mpond.connect(signers[1]).bridgeBurn(addrs[2], 100);

    await expect(mpond.connect(signers[1]).bridgeBurn(addrs[2], 901)).to.be.reverted;
  });
});
