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

describe('L2Gateway', function () {
    let signers: Signer[];
    let addrs: string[];
  
    beforeEach(async function () {
      signers = await ethers.getSigners();
      addrs = await Promise.all(signers.map(a => a.getAddress()));
    });
  
    it('deploys with initialization disabled', async function () {
      const Gateway = await ethers.getContractFactory('L2Gateway');
      let gateway = await Gateway.deploy();
      await expect(gateway.initialize(addrs[1], addrs[2])).to.be.reverted;
    });
  
    it('deploys as proxy and initializes', async function () {
      const Gateway = await ethers.getContractFactory('L2Gateway');
      const gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2]],{ kind: "uups" });
  
      expect(await gateway.tokenL2()).to.equal(addrs[1]);
      expect(await gateway.gatewayL1()).to.equal(addrs[2]);
      expect(await gateway.hasRole(await gateway.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  
    });
  
    it('upgrades', async function () {
      const Gateway = await ethers.getContractFactory('L2Gateway');
      const gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2]], { kind: "uups" });
      await upgrades.upgradeProxy(gateway.address, Gateway);
  
      expect(await gateway.tokenL2()).to.equal(addrs[1]);
      expect(await gateway.gatewayL1()).to.equal(addrs[2]);
      expect(await gateway.hasRole(await gateway.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });
  
    it('does not upgrade without admin', async function () {
      const Gateway = await ethers.getContractFactory('L2Gateway');
      const gateway = await upgrades.deployProxy(Gateway, [addrs[2], addrs[3]], { kind: "uups" });
      await expect(upgrades.upgradeProxy(gateway.address, Gateway.connect(signers[1]), { kind: "uups" })).to.be.reverted;
    });
});

describe('L2Gateway', function () {
    let signers: Signer[];
    let addrs: string[];
    let gateway: Contract;
  
    beforeEach(async function () {
      signers = await ethers.getSigners();
      addrs = await Promise.all(signers.map(a => a.getAddress()));
      const Gateway = await ethers.getContractFactory('L2Gateway');
      gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2]],{ kind: "uups" });
    });
  
    it('supports ERC165', async function () {
      const iid = ethers.utils.id('supportsInterface(bytes4)').substr(0, 10);
      expect(await gateway.supportsInterface(iid)).to.be.true;
    });
  
    it('does not support 0xffffffff', async function () {
      expect(await gateway.supportsInterface('0xffffffff')).to.be.false;
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
      expect(await gateway.supportsInterface(iid)).to.be.true;
    });
  
    it('supports IAccessControlEnumerable', async function () {
      let interfaces = [
        'getRoleMember(bytes32,uint256)',
        'getRoleMemberCount(bytes32)',
      ];
      const iid = makeInterfaceId(interfaces);
      expect(await gateway.supportsInterface(iid)).to.be.true;
    });
});

describe('L2Gateway', function () {
  let signers: Signer[];
  let addrs: string[];
  let gateway: Contract;
  let DEFAULT_ADMIN_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Gateway = await ethers.getContractFactory('L2Gateway');
    gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2]],{ kind: "uups" });
    DEFAULT_ADMIN_ROLE = await gateway.DEFAULT_ADMIN_ROLE();
  });

  it('admin can grant admin role', async function () {
    await gateway.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await gateway.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;
  });

  it('non admin cannot grant admin role', async function () {
    await expect(gateway.connect(signers[1]).grantRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it('admin can revoke admin role', async function () {
    await gateway.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await gateway.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await gateway.revokeRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await gateway.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it('non admin cannot revoke admin role', async function () {
    await gateway.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await gateway.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(gateway.connect(signers[2]).revokeRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it('admin can renounce own admin role if there are other admins', async function () {
    await gateway.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await gateway.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await gateway.connect(signers[1]).renounceRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await gateway.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it('admin cannot renounce own admin role if there are no other admins', async function () {
    await expect(gateway.renounceRole(DEFAULT_ADMIN_ROLE, addrs[0])).to.be.reverted;
  });

  it('admin cannot renounce admin role of other admins', async function () {
    await gateway.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await gateway.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(gateway.renounceRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });
});

describe('L2Gateway', function () {
  let signers: Signer[];
  let addrs: string[];
  let gateway: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Gateway = await ethers.getContractFactory('L2Gateway');
    gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2]],{ kind: "uups" });
  });

  it('tokenL2 address is correct', async function () {
    expect(await gateway.tokenL2()).to.equal(addrs[1]);
  });

  it('gatewayL1 address is correct', async function () {
    expect(await gateway.gatewayL1()).to.equal(addrs[2]);
  });
});
