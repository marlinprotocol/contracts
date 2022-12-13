import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { expect } from "chai";


export function testRole(name: string, deployer: (signers: Signer[], addrs: string[]) => Promise<Contract>, role: string) {
  describe(name, function () {
    let signers: Signer[];
    let addrs: string[];
    let contract: Contract;
    let ROLE: string;

    beforeEach(async function () {
      signers = await ethers.getSigners();
      addrs = await Promise.all(signers.map((a) => a.getAddress()));
      contract = await deployer(signers, addrs);
      ROLE = ethers.utils.id(role);
    });

    it(`admin can grant ${role} role`, async function () {
      await contract.grantRole(ROLE, addrs[1]);
      expect(await contract.hasRole(ROLE, addrs[1])).to.be.true;
    });

    it(`non admin cannot grant ${role} role`, async function () {
      await expect(contract.connect(signers[1]).grantRole(ROLE, addrs[1])).to.be.reverted;
    });

    it(`admin can revoke ${role} role`, async function () {
      await contract.grantRole(ROLE, addrs[1]);
      expect(await contract.hasRole(ROLE, addrs[1])).to.be.true;

      await contract.revokeRole(ROLE, addrs[1]);
      expect(await contract.hasRole(ROLE, addrs[1])).to.be.false;
    });

    it(`non admin cannot revoke ${role} role`, async function () {
      await contract.grantRole(ROLE, addrs[1]);
      expect(await contract.hasRole(ROLE, addrs[1])).to.be.true;

      await expect(contract.connect(signers[2]).revokeRole(ROLE, addrs[1])).to.be.reverted;
    });
  });
}

