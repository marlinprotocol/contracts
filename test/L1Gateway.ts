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


describe('L1Gateway', function () {
    let signers: Signer[];
    let addrs: string[];
  
    beforeEach(async function () {
      signers = await ethers.getSigners();
      addrs = await Promise.all(signers.map(a => a.getAddress()));
    });
  
    it('deploys with initialization disabled', async function () {
      const Gateway = await ethers.getContractFactory('L1Gateway');
      let gateway = await Gateway.deploy();
      await expect(gateway.initialize(addrs[1], addrs[2], addrs[3])).to.be.reverted;
    });
  
    it('deploys as proxy and initializes', async function () {
      const Gateway = await ethers.getContractFactory('L1Gateway');
      const gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2], addrs[3]],{ kind: "uups" });
  
      expect(await gateway.inbox()).to.equal(addrs[1]);
      expect(await gateway.tokenL1()).to.equal(addrs[2]);
      expect(await gateway.gatewayL2()).to.equal(addrs[3]);
      expect(await gateway.hasRole(await gateway.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
  
    });
  
    it('upgrades', async function () {
      const Gateway = await ethers.getContractFactory('L1Gateway');
      const gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2], addrs[3]], { kind: "uups" });
      await upgrades.upgradeProxy(gateway.address, Gateway);
  
      expect(await gateway.inbox()).to.equal(addrs[1]);
      expect(await gateway.tokenL1()).to.equal(addrs[2]);
      expect(await gateway.gatewayL2()).to.equal(addrs[3]);
      expect(await gateway.hasRole(await gateway.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    });
  
    it('does not upgrade without admin', async function () {
      const Gateway = await ethers.getContractFactory('L1Gateway');
      const gateway = await upgrades.deployProxy(Gateway, [addrs[2], addrs[3], addrs[4]], { kind: "uups" });
      await expect(upgrades.upgradeProxy(gateway.address, Gateway.connect(signers[1]), { kind: "uups" })).to.be.reverted;
    });
});

describe('L1Gateway', function () {
    let signers: Signer[];
    let addrs: string[];
    let gateway: Contract;
  
    beforeEach(async function () {
      signers = await ethers.getSigners();
      addrs = await Promise.all(signers.map(a => a.getAddress()));
      const Gateway = await ethers.getContractFactory('L1Gateway');
      gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2], addrs[3]],{ kind: "uups" });
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

describe('L1Gateway', function () {
  let signers: Signer[];
  let addrs: string[];
  let gateway: Contract;
  let DEFAULT_ADMIN_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Gateway = await ethers.getContractFactory('L1Gateway');
    gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2], addrs[3]],{ kind: "uups" });
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

describe('L1Gateway', function () {
  let signers: Signer[];
  let addrs: string[];
  let gateway: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Gateway = await ethers.getContractFactory('L1Gateway');
    gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2], addrs[3]],{ kind: "uups" });
  });

  it('inbox address is correct', async function () {
    expect(await gateway.inbox()).to.equal(addrs[1]);
  });

  it('tokenL1 address is correct', async function () {
    expect(await gateway.tokenL1()).to.equal(addrs[2]);
  });

  it('gatewayL2 address is correct', async function () {
    expect(await gateway.gatewayL2()).to.equal(addrs[3]);
  });
});

describe('L1Gateway', function () {
  let signers: Signer[];
  let addrs: string[];
  let gateway: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Gateway = await ethers.getContractFactory('L1Gateway');
    gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2], addrs[3]],{ kind: "uups" });
  });

  it('state variable changes correct', async function () {
    const oldInbox = await gateway.inbox();
    expect(await gateway.setInbox(addrs[4])).to.emit(gateway, 'InboxChanged')
      .withArgs(oldInbox, addrs[4]);

    const oldToken = await gateway.tokenL1();
    expect(await gateway.setTokenL1(addrs[5])).to.emit(gateway, 'TokenL1Changed')
        .withArgs(oldToken, addrs[5]);
  
    const oldGateway = await gateway.gatewayL2();
    expect(await gateway.setGatewayL2(addrs[6])).to.emit(gateway, 'GatewayL2Changed')
      .withArgs(oldGateway, addrs[6]);
  });
});

describe('L1Gateway', function () {
  let signers: Signer[];
  let addrs: string[];
  let gateway: Contract;
  let tokenL1: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const Gateway = await ethers.getContractFactory('L1Gateway');
    gateway = await upgrades.deployProxy(Gateway, [addrs[1], addrs[2], addrs[3]],{ kind: "uups" });
  
    const IInbox = await ethers.getContractFactory('IInboxImplementation');
    const inbox = await IInbox.deploy();
    const oldInbox = await gateway.inbox();
    expect(await gateway.setInbox(inbox.address)).to.emit(gateway, 'InboxChanged')
      .withArgs(oldInbox, inbox.address);
    
    
    const TokenL1 = await ethers.getContractFactory('Pond');
    tokenL1 = await upgrades.deployProxy(TokenL1, ['Marlin POND', 'POND'], { kind : 'uups'});
    const oldTokenL1 = await gateway.tokenL1();

    expect(await gateway.setTokenL1(tokenL1.address)).to.emit(gateway, 'TokenL1Changed')
      .withArgs(oldTokenL1, tokenL1.address);
  });

  it('transferL2 runs successfully', async function () {
    await tokenL1.approve(gateway.address, 5000);
    expect(await gateway.transferL2(addrs[4], 5000, 10, 2, { value: ethers.utils.parseEther("1000") })).to.emit(gateway, 'TransferL2')
      .withArgs(0, addrs[0], addrs[4], 5000, ethers.utils.parseEther("1000"));
    
    expect(await tokenL1.balanceOf(gateway.address)).to.equal(5000);
  })

  it('withdraws successfully', async function () {
    await tokenL1.approve(gateway.address, 5000);
    await gateway.transferL2(addrs[4], 5000, 10, 2, { value: ethers.utils.parseEther("1000") });
    await gateway.withdraw();
    expect(await tokenL1.balanceOf(gateway.address)).to.equal(0);
    expect(await tokenL1.balanceOf(addrs[0])).to.equal(BN.from(10e9).e18());
  })
});
