import { ethers, upgrades } from "hardhat";
import { BigNumber as BN } from "bignumber.js";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { isAddress, keccak256 } from "ethers/lib/utils";
import { expect } from "chai";
import { Contract } from "ethers";

describe("Testing Cluster Selector", function () {
  let clusterSelector: Contract;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let updater: SignerWithAddress;

  beforeEach(async () => {
    [admin, user, updater] = await ethers.getSigners();
    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    clusterSelector = await ClusterSelector.deploy(admin.address);
  });

  it("Check deployment", async () => {
    expect(isAddress(clusterSelector.address)).eq(true);
  });

  it("User can't insert", async () => {
    const address = randomAddressGenerator("1");
    let role = await clusterSelector.updaterRole();
    await expect(
      clusterSelector.connect(user).insert(address, 1)
    ).to.be.revertedWith(
      `AccessControl: account ${user.address.toLowerCase()} is missing role ${role}`
    );
  });

  describe("Test after inserting", function(){
    beforeEach(async() => {
        let role = await clusterSelector.updaterRole();
        await clusterSelector.connect(admin).grantRole(role, updater.address);
    })

    it("Add a number", async() => {
        const address = randomAddressGenerator("salt");
        await clusterSelector.connect(updater).insert(address, 1);
        expect(await clusterSelector.search(address)).eq(true);
    })

    it("Multiple entries", async () => {
        const numberOfTries = 30;
        for (let index = 0; index < numberOfTries; index++) {   
            const address = randomAddressGenerator("salt"+index);
            await clusterSelector.connect(updater).insert(address, index);
        }
    })
  })
});

function randomAddressGenerator(rand: string): string {
  let address = keccak256(Buffer.from(rand)).toString().slice(0, 42);
  return address;
}
