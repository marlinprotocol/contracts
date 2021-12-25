import { ethers, upgrades } from 'hardhat';
import { expect } from 'chai';
import { BigNumber as BN, Signer, Contract } from 'ethers';
import exp from 'constants';
import { Sign, sign } from 'crypto';
import cluster, { Address } from 'cluster';
const appConfig = require("../app-config");

declare module 'ethers' {
  interface BigNumber {
    e18(this: BigNumber): BigNumber;
  }
}
BN.prototype.e18 = function () {
  return this.mul(BN.from(10).pow(18))
}

async function skipBlocks(n: number) {
  await Promise.all([...Array(n)].map(async x => await ethers.provider.send('evm_mine', [])));
}

async function skipTime(t: number) {
  await ethers.provider.send('evm_increaseTime', [t]);
}

const ETHHASH = ethers.utils.id("ETH");
const DOTHASH = ethers.utils.id("DOT");
const NEARHASH = ethers.utils.id("NEAR");
const NETWORK_IDS = [ETHHASH, DOTHASH, NEARHASH];
const ETHWEIGHT = 100;
const DOTWEIGHT = 200;
const NEARWEIGHT = 300;
const WEIGHTS = [ETHWEIGHT, DOTWEIGHT, NEARWEIGHT];
const TOTALWEIGHT = ETHWEIGHT + DOTWEIGHT + NEARWEIGHT;

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
  });

  it('deploys with initialization disabled', async function () {
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    let clusterRewards = await ClusterRewards.deploy();

    await expect(clusterRewards.initialize(addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60)).to.be.reverted;
  });

  it('deploys as proxy and initializes', async function () {
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    const clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });

    expect(await clusterRewards.hasRole(await clusterRewards.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.FEEDER_ROLE(), addrs[1])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.CLAIMER_ROLE(), addrs[2])).to.be.true;
    await Promise.all(NETWORK_IDS.map(async (nid, idx) => {
      expect(await clusterRewards.rewardWeight(nid)).to.equal(WEIGHTS[idx]);
    }));
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(60000);
    expect(await clusterRewards.payoutDenomination()).to.equal(100000);
    expect(await clusterRewards.rewardDistributionWaitTime()).to.equal(20*60*60);
  });

  it('upgrades', async function () {
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    const clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
    await upgrades.upgradeProxy(clusterRewards.address, ClusterRewards, { kind: "uups" });

    expect(await clusterRewards.hasRole(await clusterRewards.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.FEEDER_ROLE(), addrs[1])).to.be.true;
    expect(await clusterRewards.hasRole(await clusterRewards.CLAIMER_ROLE(), addrs[2])).to.be.true;
    await Promise.all(NETWORK_IDS.map(async (nid, idx) => {
      expect(await clusterRewards.rewardWeight(nid)).to.equal(WEIGHTS[idx]);
    }));
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(60000);
    expect(await clusterRewards.payoutDenomination()).to.equal(100000);
    expect(await clusterRewards.rewardDistributionWaitTime()).to.equal(20*60*60);
  });

  it('does not upgrade without admin', async function () {
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    const clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
    await expect(upgrades.upgradeProxy(clusterRewards.address, ClusterRewards.connect(signers[1]), { kind: "uups" })).to.be.reverted;
  });
});

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
  });

  it('supports ERC167', async function () {
    const iid = ethers.utils.id('supportsInterface(bytes4)').substr(0, 10);
    expect(await clusterRewards.supportsInterface(iid)).to.be.true;
  });

  it('does not support 0xffffffff', async function () {
    expect(await clusterRewards.supportsInterface('0xffffffff')).to.be.false;
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
    expect(await clusterRewards.supportsInterface(iid)).to.be.true;
  });

  it('supports IAccessControlEnumerable', async function () {
    let interfaces = [
      'getRoleMember(bytes32,uint256)',
      'getRoleMemberCount(bytes32)',
    ];
    const iid = makeInterfaceId(interfaces);
    expect(await clusterRewards.supportsInterface(iid)).to.be.true;
  });
});

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;
  let DEFAULT_ADMIN_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
    DEFAULT_ADMIN_ROLE = await clusterRewards.DEFAULT_ADMIN_ROLE();
  });

  it('admin can grant admin role', async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;
  });

  it('non admin cannot grant admin role', async function () {
    await expect(clusterRewards.connect(signers[1]).grantRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it('admin can revoke admin role', async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await clusterRewards.revokeRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it('non admin cannot revoke admin role', async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(clusterRewards.connect(signers[2]).revokeRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });

  it('admin can renounce own admin role if there are other admins', async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await clusterRewards.connect(signers[1]).renounceRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.false;
  });

  it('admin cannot renounce own admin role if there are no other admins', async function () {
    await expect(clusterRewards.renounceRole(DEFAULT_ADMIN_ROLE, addrs[0])).to.be.reverted;
  });

  it('admin cannot renounce admin role of other admins', async function () {
    await clusterRewards.grantRole(DEFAULT_ADMIN_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.true;

    await expect(clusterRewards.renounceRole(DEFAULT_ADMIN_ROLE, addrs[1])).to.be.reverted;
  });
});

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;
  let FEEDER_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
    FEEDER_ROLE = await clusterRewards.FEEDER_ROLE();
  });

  it('admin can grant feeder role', async function () {
    await clusterRewards.grantRole(FEEDER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(FEEDER_ROLE, addrs[1])).to.be.true;
  });

  it('non admin cannot grant feeder role', async function () {
    await expect(clusterRewards.connect(signers[1]).grantRole(FEEDER_ROLE, addrs[1])).to.be.reverted;
  });

  it('admin can revoke feeder role', async function () {
    await clusterRewards.grantRole(FEEDER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(FEEDER_ROLE, addrs[1])).to.be.true;

    await clusterRewards.revokeRole(FEEDER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(FEEDER_ROLE, addrs[1])).to.be.false;
  });

  it('non admin cannot revoke feeder role', async function () {
    await clusterRewards.grantRole(FEEDER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(FEEDER_ROLE, addrs[1])).to.be.true;

    await expect(clusterRewards.connect(signers[2]).revokeRole(FEEDER_ROLE, addrs[1])).to.be.reverted;
  });

  it('whitelisted signer can renounce own feeder role', async function () {
    await clusterRewards.grantRole(FEEDER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(FEEDER_ROLE, addrs[1])).to.be.true;

    await clusterRewards.connect(signers[1]).renounceRole(FEEDER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(FEEDER_ROLE, addrs[1])).to.be.false;
  });
});

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;
  let CLAIMER_ROLE: string;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
    CLAIMER_ROLE = await clusterRewards.CLAIMER_ROLE();
  });

  it('admin can grant claimer role', async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;
  });

  it('non admin cannot grant claimer role', async function () {
    await expect(clusterRewards.connect(signers[1]).grantRole(CLAIMER_ROLE, addrs[1])).to.be.reverted;
  });

  it('admin can revoke claimer role', async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;

    await clusterRewards.revokeRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.false;
  });

  it('non admin cannot revoke claimer role', async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;

    await expect(clusterRewards.connect(signers[2]).revokeRole(CLAIMER_ROLE, addrs[1])).to.be.reverted;
  });

  it('whitelisted signer can renounce own claimer role', async function () {
    await clusterRewards.grantRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.true;

    await clusterRewards.connect(signers[1]).renounceRole(CLAIMER_ROLE, addrs[1]);
    expect(await clusterRewards.hasRole(CLAIMER_ROLE, addrs[1])).to.be.false;
  });
});

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
  });

  it('admin can add network', async function () {
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT + 400);
  });

  it('admin cannot add existing network', async function () {
    await clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("POLYGON"))).to.equal(400);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT + 400);

    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 400)).to.be.reverted;
  });

  it('admin cannot add network with zero weight', async function () {
    await expect(clusterRewards.addNetwork(ethers.utils.id("POLYGON"), 0)).to.be.reverted;
  });

  it('non admin cannot add network', async function () {
    await expect(clusterRewards.connect(signers[1]).addNetwork(ethers.utils.id("POLYGON"), 400)).to.be.reverted;
  });

  it('admin can remove network', async function () {
    await clusterRewards.removeNetwork(ethers.utils.id("DOT"));
    expect(await clusterRewards.rewardWeight(ethers.utils.id("DOT"))).to.equal(0);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT - DOTWEIGHT);
  });

  it('admin cannot remove non-existing network', async function () {
    await expect(clusterRewards.removeNetwork(ethers.utils.id("POLYGON"))).to.be.reverted;
  });

  it('non admin cannot remove network', async function () {
    await expect(clusterRewards.connect(signers[1]).removeNetwork(ethers.utils.id("DOT"))).to.be.reverted;
  });
});

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
  });

  it('admin can change network reward', async function () {
    await clusterRewards.changeNetworkReward(ethers.utils.id("DOT"), 400);
    expect(await clusterRewards.rewardWeight(ethers.utils.id("DOT"))).to.equal(400);
    expect(await clusterRewards.totalWeight()).to.equal(TOTALWEIGHT - DOTWEIGHT + 400);
  });

  it('admin cannot change non-existing network reward', async function () {
    await expect(clusterRewards.changeNetworkReward(ethers.utils.id("POLYGON"), 400)).to.be.reverted;
  });

  it('non admin cannot change network reward', async function () {
    await expect(clusterRewards.connect(signers[1]).changeNetworkReward(ethers.utils.id("DOT"), 400)).to.be.reverted;
  });

  it('admin can change rewards per epoch', async function () {
    await clusterRewards.changeRewardPerEpoch(200);
    expect(await clusterRewards.totalRewardsPerEpoch()).to.equal(200);
  });

  it('non admin cannot change rewards per epoch', async function () {
    await expect(clusterRewards.connect(signers[1]).changeRewardPerEpoch(200)).to.be.reverted;
  });

  it('admin can change payout denomination', async function () {
    await clusterRewards.changePayoutDenomination(200);
    expect(await clusterRewards.payoutDenomination()).to.equal(200);
  });

  it('non admin cannot change payout denomination', async function () {
    await expect(clusterRewards.connect(signers[1]).changePayoutDenomination(200)).to.be.reverted;
  });

  it('admin can change wait time', async function () {
    await clusterRewards.updateRewardDistributionWaitTime(200);
    expect(await clusterRewards.rewardDistributionWaitTime()).to.equal(200);
  });

  it('non admin cannot change wait time', async function () {
    await expect(clusterRewards.connect(signers[1]).updateRewardDistributionWaitTime(200)).to.be.reverted;
  });
});

describe('ClusterRewards', function () {
  let signers: Signer[];
  let addrs: string[];
  let clusterRewards: Contract;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addrs = await Promise.all(signers.map(a => a.getAddress()));
    const ClusterRewards = await ethers.getContractFactory('ClusterRewards');
    clusterRewards = await upgrades.deployProxy(ClusterRewards, [addrs[1], addrs[2], NETWORK_IDS, WEIGHTS, 60000, 100000, 20*60*60], { kind: "uups" });
  });

  it('feeder can feed rewards in single tx', async function () {
    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3], addrs[4], addrs[5]], [50000, 20000, 30000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(20000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(6000);
  });

  it('feeder can feed rewards in multiple tx', async function () {
    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3]], [50000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(0);

    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[4]], [20000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(14000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(0);

    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[5]], [30000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(20000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(6000);
  });

  it('feeder cannot feed rewards exceeding rewards per epoch', async function () {
    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3]], [50000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(0);

    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[4]], [20000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(14000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(0);

    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[5]], [30000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(20000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(6000);

    await expect(clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[6]], [200010], 1)).to.be.reverted;
  });

  it('feeder cannot feed rewards for multiple epochs before wait time', async function () {
    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3]], [50000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(0);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(0);

    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[4]], [20000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(14000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(0);

    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[5]], [30000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(20000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(6000);

    await expect(clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3]], [10000], 2)).to.be.reverted;

    await skipTime(19*60*60);
    await expect(clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3]], [10000], 2)).to.be.reverted;

    await skipTime(1*60*60);
    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3]], [20000], 2);
    expect(await clusterRewards.rewardDistributedPerEpoch(2)).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(14000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(6000);
  });

  it('non feeder cannot feed rewards', async function () {
    await expect(clusterRewards.connect(signers[0]).feed(ethers.utils.id("DOT"), [addrs[3]], [10000], 2)).to.be.reverted;
    await expect(clusterRewards.connect(signers[2]).feed(ethers.utils.id("DOT"), [addrs[3]], [10000], 2)).to.be.reverted;
  });

  it('claimer can claim rewards', async function () {
    await clusterRewards.connect(signers[1]).feed(ethers.utils.id("DOT"), [addrs[3], addrs[4], addrs[5]], [50000, 20000, 30000], 1);
    expect(await clusterRewards.rewardDistributedPerEpoch(1)).to.equal(20000);
    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(10000);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(6000);

    expect(await clusterRewards.connect(signers[2]).callStatic.claimReward(addrs[3])).to.equal(9999);
    expect(await clusterRewards.connect(signers[2]).callStatic.claimReward(addrs[6])).to.equal(0);

    let tx = await clusterRewards.connect(signers[2]).claimReward(addrs[3]);
    await tx.wait();

    expect(await clusterRewards.clusterRewards(addrs[3])).to.equal(1);
    expect(await clusterRewards.clusterRewards(addrs[4])).to.equal(4000);
    expect(await clusterRewards.clusterRewards(addrs[5])).to.equal(6000);
  });
});

