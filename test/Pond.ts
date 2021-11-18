import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber as BN, Signer, Contract } from 'ethers';
import exp from 'constants';


declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}


describe('Pond Deployment', function () {
  let signers: Signer[];
  let addrs: string[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
  });

  it('deploys with initialization disabled', async function () {
    const Pond = await ethers.getContractFactory('Pond');
    let pond = await Pond.deploy();
    await expect(pond.initialize("Marlin", "POND")).to.be.reverted;
  });

  it('deploys as proxy and initializes', async function () {
    const Pond = await ethers.getContractFactory('Pond');
    const pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"],{ kind: "uups" });

    expect(await pond.name()).to.equal("Marlin");
    expect(await pond.symbol()).to.equal("POND");
    expect(await pond.cap()).to.equal(BN.from(10000000000).e18());
    expect(await pond.hasRole(await pond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;

  });

  it('upgrades', async function () {
    const Pond = await ethers.getContractFactory('Pond');
    const pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    await upgrades.upgradeProxy(pond.address, Pond);

    expect(await pond.name()).to.equal("Marlin");
    expect(await pond.symbol()).to.equal("POND");
    expect(await pond.cap()).to.equal(BN.from(10000000000).e18());
    expect(await pond.hasRole(await pond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it('does not upgrade without admin', async function () {
    const Pond = await ethers.getContractFactory('Pond');
    const pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    await expect(upgrades.upgradeProxy(pond.address, Pond.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

describe('Pond Interface Check', function () {
  let signers: Signer[];
  let addrs: string[];
  let pond: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Pond = await ethers.getContractFactory('Pond');
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
  });

  it('supports ERC165', async function () {
    const iid = ethers.utils.id('supportsInterface(bytes4)').substr(0, 10);
    expect(await pond.supportsInterface(iid)).to.be.true;
  });

  it('does not support 0xffffffff', async function () {
    expect(await pond.supportsInterface('0xffffffff')).to.be.false;
  });

  function makeInterfaceId(interfaces: string[]): string {
    return ethers.utils.hexlify(
      interfaces.map(i => ethers.utils.arrayify(ethers.utils.id(i).substr(0, 10)))
                .reduce((i1, i2) => i1.map((i, idx) => i ^ i2[idx]))
    );
  }

  it('supports IAccessControl', async function () {
    let interfaces = [
      'hasRole(bytes32,address)',
      'getRoleAdmin(bytes32)',
      'grantRole(bytes32,address)',
      'revokeRole(bytes32,address)',
      'renounceRole(bytes32,address)',
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await pond.supportsInterface(iid)).to.be.true;
  });

  it('supports IAccessControlEnumerable', async function () {
    let interfaces = [
      'getRoleMember(bytes32,uint256)',
      'getRoleMemberCount(bytes32)',
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await pond.supportsInterface(iid)).to.be.true;
  });
});

describe('Pond allowance check', function() {
  let signers: Signer[];
  let addrs: string[];
  let pond: Contract;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Pond = await ethers.getContractFactory('Pond');
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
  });

  it('approve', async function() {
    await pond.approve(addrs[1], 400);
    expect(await pond.allowance(addrs[0], addrs[1])).to.equal(400);
  });

  it('decrease allowance', async function() {
    await pond.decreaseAllowance(addrs[1], 100);
    expect(await pond.allowance(addrs[0], addrs[1])).to.equal(300);
  });

  it('increase allowance', async function() {
    await pond.increaseAllowance(addrs[1], 100);
    expect(await pond.allowance(addrs[0], addrs[1])).to.equal(400);
  });
});

describe('Pond transfer check', function() {
  let signers: Signer[];
  let addrs: string[];
  let pond: Contract;

  before(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Pond = await ethers.getContractFactory('Pond');
    pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
  });

  it('transfer', async function() {
    await pond.transfer(addrs[1], 400);
    expect(await pond.balanceOf(addrs[1])).to.equal(400);
  });

  it('transferFrom (no allowance)', async function() {
    await expect(pond.connect(signers[1]).transferFrom(addrs[0], addrs[2], 100)).to.be.reverted;
  });

  it('transferFrom (with allowance)', async function() {
    await pond.increaseAllowance(addrs[1], 100);
    await pond.connect(signers[1]).transferFrom(addrs[0], addrs[2], 100);
    expect(await pond.balanceOf(addrs[2])).to.equal(100);
  });
});