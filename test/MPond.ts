import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber as BN, Signer } from 'ethers';


declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}


describe('MPond', function () {
  let accounts: Signer[];
  let addrs: string[];

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    addrs = await Promise.all(accounts.map(a => a.getAddress()));
  });

  it('deploys', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    await MPond.deploy();
  });

  it('deploys as proxy and initializes', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    const mpond = await upgrades.deployProxy(MPond);

    const balance = await mpond.balanceOf(addrs[0]);
    expect(balance).to.equal(BN.from(10000).e18());
    expect(await mpond.hasRole(await mpond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });

  it('upgrades', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    const mpond = await upgrades.deployProxy(MPond);
    await upgrades.upgradeProxy(mpond.address, MPond);

    const balance = await mpond.balanceOf((await ethers.getSigners())[0].address);
    expect(balance).to.equal(BN.from(10000).e18());
    expect(await mpond.hasRole(await mpond.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  });
});

describe('MPond', function () {
  let accounts: Signer[];

  beforeEach(async function () {
    accounts = await ethers.getSigners();
  });

  it('deploys', async function () {
    const MPond = await ethers.getContractFactory('MPond');
    await MPond.deploy();
  });
});

