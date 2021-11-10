import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber as BN, Signer, Contract } from 'ethers';


declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}


describe('MPond', function () {
  let signers: Signer[];
  let addrs: string[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
  });

  it('deploys with initialization disabled', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    let mpond = await MPond.deploy();

    await expect(mpond.initialize()).to.be.reverted;
  });

  it('deploys as proxy and initializes', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });

    const balance = await mpond.balanceOf(addrs[0]);
    expect(balance).to.equal(BN.from(10000).e18());
    expect(await mpond.hasRole(await mpond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it('upgrades', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    await upgrades.upgradeProxy(mpond.address, MPond, { kind: "uups" });

    const balance = await mpond.balanceOf(addrs[0]);
    expect(balance).to.equal(BN.from(10000).e18());
    expect(await mpond.hasRole(await mpond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it('does not upgrade without admin', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    const mpond = await upgrades.deployProxy(MPond, { kind: "uups" });
    await expect(upgrades.upgradeProxy(mpond.address, MPond.connect(signers[1]), { kind: "uups" })).to.be.reverted;
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
  });

  it('supports ERC167', async function () {
    const iid = ethers.utils.id('supportsInterface(bytes4)').substr(0, 10);
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });

  it('does not support 0xffffffff', async function () {
    expect(await mpond.supportsInterface('0xffffffff')).to.be.false;
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
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });

  it('supports IAccessControlEnumerable', async function () {
    let interfaces = [
      'getRoleMember(bytes32,uint256)',
      'getRoleMemberCount(bytes32)',
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await mpond.supportsInterface(iid)).to.be.true;
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
  });

  it('supports ERC167', async function () {
    const iid = ethers.utils.id('supportsInterface(bytes4)').substr(0, 10);
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });

  it('does not support 0xffffffff', async function () {
    expect(await mpond.supportsInterface('0xffffffff')).to.be.false;
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
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });

  it('supports IAccessControlEnumerable', async function () {
    let interfaces = [
      'getRoleMember(bytes32,uint256)',
      'getRoleMemberCount(bytes32)',
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await mpond.supportsInterface(iid)).to.be.true;
  });
});

