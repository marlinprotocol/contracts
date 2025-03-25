import { expect } from "chai";
import { Signer } from "ethers";
import {
  ethers,
  upgrades,
} from "hardhat";

import {
  Credit,
  Credit__factory,
  Pond,
  Pond__factory,
} from "../../typechain-types";

const creditAmount = (amount: number) => {
  return ethers.utils.parseUnits(amount.toString(), "6");
}

describe("Credit", function () {
  let signers: Signer[];
  let addrs: string[];
  let credit: Credit;
  let usdc: Pond;

  let admin: Signer;
  let user: Signer;
  let user2: Signer;

  beforeEach(async function () {
    // Signers
    signers = await ethers.getSigners();
    admin = signers[0];
    user = signers[1];
    user2 = signers[2];

    // Deploy Pond
    const USDC = await ethers.getContractFactory("Pond");
    const usdcProxy = await upgrades.deployProxy(USDC, [], {
      kind: "uups",
      unsafeAllow: ["missing-initializer-call"],
      initializer: false,
    });
    usdc = Pond__factory.connect(usdcProxy.address, admin);
    await usdc.initialize("USDC", "USDC");

    // Deploy Credit
    const Credit = await ethers.getContractFactory("Credit");
    const creditTokenContract = await upgrades.deployProxy(Credit, {
      kind: "uups",
      constructorArgs: [usdc.address],
      initializer: false,
    });
    credit = Credit__factory.connect(creditTokenContract.address, admin);
    await credit.initialize(await admin.getAddress());
  });

  describe("Access Control", function () {
    it("should revert when 0 admins", async function () {
      await expect(credit.connect(admin).revokeRole(await credit.DEFAULT_ADMIN_ROLE(), await admin.getAddress())).to.be.revertedWithCustomError(credit, "NoAdminExists");
    });
  });

  describe("Getters", function () {
    it("should get USDC", async function () {
      expect(await credit.USDC()).to.equal(usdc.address);
    });

    it("should get decimals", async function () {
      expect(await credit.decimals()).to.equal(6);
    });

    it("should get role", async function () {
      expect(await credit.hasRole(await credit.DEFAULT_ADMIN_ROLE(), await admin.getAddress())).to.be.true;
    });
  });

  describe("Initialize", function () {
    it("should deploy with initialization disabled", async function () {
      await expect(credit.initialize(await admin.getAddress())).to.be.revertedWith("Initializable: contract is already initialized");
    });
  
    it("should deploy as proxy and initialize", async function () {
      const Credit = await ethers.getContractFactory("Credit");
      const creditTokenContract = await upgrades.deployProxy(Credit, {
        kind: "uups",
        constructorArgs: [usdc.address],
        initializer: false,
      });
      const credit = Credit__factory.connect(creditTokenContract.address, admin);
      await credit.initialize(await admin.getAddress());
  
      expect(await credit.USDC()).to.equal(usdc.address);
      expect(await credit.hasRole(await credit.DEFAULT_ADMIN_ROLE(), await admin.getAddress())).to.be.true;
    });
  });

  describe("Mint/Burn", function () {
    describe("Mint", function () {
      it("should mint", async function () {
        await credit.connect(admin).grantRole(await credit.MINTER_ROLE(), await admin.getAddress());
        await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await admin.getAddress());
        await credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000));
        expect(await credit.balanceOf(await admin.getAddress())).to.equal(creditAmount(1000));
      });

      it("should revert when not minter", async function () {
        await expect(credit.connect(user).mint(await user.getAddress(), creditAmount(1000))).to.be.reverted;
      });

      it("should revert when not transfer allowed", async function () {
        await credit.connect(admin).grantRole(await credit.MINTER_ROLE(), await admin.getAddress());
        await expect(credit.connect(admin).mint(await user.getAddress(), creditAmount(1000))).to.be.reverted;
      });
    });

    describe("Burn", function () {
      beforeEach(async function () {
        // Grant `MINTER_ROLE` and `TRANSFER_ALLOWED_ROLE` to admin
        await credit.connect(admin).grantRole(await credit.MINTER_ROLE(), await admin.getAddress());
        await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await admin.getAddress());

        // Mint 1000 Credit to admin
        await credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000));
      });

      it("should burn", async function () {
        // Transfer 1000 Credit to user
        await credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000));
        await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());
        await credit.connect(admin).transfer(await user.getAddress(), creditAmount(1000));

        // Grant `BURNER_ROLE` to admin
        await credit.connect(admin).grantRole(await credit.BURNER_ROLE(), await admin.getAddress());

        // Burn 1000 Credit from user
        await credit.connect(admin).burn(await user.getAddress(), creditAmount(1000));

        // Check that the balance of the admin is 0
        expect(await credit.balanceOf(await user.getAddress())).to.equal(0);
      });

      it("should revert without BURNER_ROLE", async function () {
        // Transfer 1000 Credit to user
        await credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000));
        await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());
        await credit.connect(admin).transfer(await user.getAddress(), creditAmount(1000));

        // Burn 1000 Credit from user
        const revertString = new RegExp(`AccessControl: account ${await admin.getAddress()} is missing role ${await credit.BURNER_ROLE()}`, 'i');
        await expect(credit.connect(admin).burn(await admin.getAddress(), creditAmount(1000))).to.be.revertedWith(revertString);
      });

      it("should revert when token holder does not have TRANSFER_ALLOWED_ROLE", async function () {
        // Transfer 1000 Credit to user
        await credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000));
        // Note: only either of sender or recipient needs to have TRANSFER_ALLOWED_ROLE
        // so in this case, admin has TRANSFER_ALLOWED_ROLE so no need for user
        await credit.connect(admin).transfer(await user.getAddress(), creditAmount(1000));

        // Grant `BURNER_ROLE` to admin
        await credit.connect(admin).grantRole(await credit.BURNER_ROLE(), await admin.getAddress());

        // Burn `1000` Credit from user
        await expect(credit.connect(admin).burn(await user.getAddress(), creditAmount(1000))).to.be.revertedWithCustomError(credit, "OnlyTransferAllowedRole");
      });

      it("should revert when token holder has insufficient balance", async function () {
        // Transfer 1000 Credit to user
        await credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000));
        await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());
        await credit.connect(admin).transfer(await user.getAddress(), creditAmount(1000));

        // Grant `BURNER_ROLE` to admin
        await credit.connect(admin).grantRole(await credit.BURNER_ROLE(), await admin.getAddress());

        // Revoke `TRANSFER_ALLOWED_ROLE` from user
        await credit.connect(admin).revokeRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());

        const revertString = "ERC20: burn amount exceeds balance";
        await expect(credit.connect(admin).burn(await admin.getAddress(), creditAmount(1001))).to.be.revertedWith(revertString);
      });
    });
  });

  describe("Redeem And Burn", function () {
    beforeEach(async function () {
      // Grant `MINTER_ROLE` and `TRANSFER_ALLOWED_ROLE` to admin
      await credit.connect(admin).grantRole(await credit.MINTER_ROLE(), await admin.getAddress());
      await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await admin.getAddress());

      // Mint 1000 Credit to admin
      await credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000));

      // Transfer 5000 USDC to admin
      const usdcAmount = ethers.utils.parseUnits("5000", "6");
      await usdc.connect(admin).transfer(await admin.getAddress(), usdcAmount);
    });

    it("should redeem and burn", async function () {
      // Transfer 5000 USDC to Credit contract
      await usdc.connect(admin).transfer(credit.address, ethers.utils.parseUnits("5000", "6"));

      // Transfer 1000 Credit to user
      await credit.connect(admin).transfer(await user.getAddress(), creditAmount(1000));

      // Grant `TRANSFER_ALLOWED_ROLE` to user
      await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());

      // Grant `REDEEMER_ROLE` to user
      await credit.connect(admin).grantRole(await credit.REDEEMER_ROLE(), await user.getAddress());

      // Redeem and burn 1000 Credit from user
      await credit.connect(user).redeemAndBurn(await user.getAddress(), creditAmount(1000));

      // Check that Credit balance of the user is 0
      expect(await credit.balanceOf(await user.getAddress())).to.equal(0);
      // Check that USDC balance of the Credit contract is 1000
      expect(await usdc.balanceOf(await user.getAddress())).to.equal(creditAmount(1000));
      // Check that USDC balance of Credit has decreased by 1000 (from 5000 to 4000)
      expect(await usdc.balanceOf(credit.address)).to.equal(ethers.utils.parseUnits("4000", "6"));
    });

    it("should revert when redeemer does not have `REDEEMER_ROLE`", async function () {
      // Transfer 5000 USDC to Credit contract
      await usdc.connect(admin).transfer(credit.address, ethers.utils.parseUnits("5000", "6"));

      // Transfer 1000 Credit to user
      await credit.connect(admin).transfer(await user.getAddress(), creditAmount(1000));

      // Grant `TRANSFER_ALLOWED_ROLE` to user
      await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());

      //! Grant `REDEEMER_ROLE` to user
      // await credit.connect(admin).grantRole(await credit.REDEEMER_ROLE(), await user.getAddress());

      // Redeem and burn 1000 Credit from user
      const revertString = new RegExp(`AccessControl: account ${await user.getAddress()} is missing role ${await credit.REDEEMER_ROLE()}`, 'i');
      await expect(credit.connect(user).redeemAndBurn(await user.getAddress(), creditAmount(1000))).to.be.revertedWith(revertString);
    });

    it("should revert when token holder does not have `TRANSFER_ALLOWED_ROLE`", async function () {
      // Transfer 5000 USDC to Credit contract
      await usdc.connect(admin).transfer(credit.address, ethers.utils.parseUnits("5000", "6"));

      // Transfer 1000 Credit to user
      await credit.connect(admin).transfer(await user.getAddress(), creditAmount(1000));

      //! Grant `TRANSFER_ALLOWED_ROLE` to user
      // await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());

      // Grant `REDEEMER_ROLE` to user
      await credit.connect(admin).grantRole(await credit.REDEEMER_ROLE(), await user.getAddress());

      // Redeem and burn 1000 Credit from user
      await expect(credit.connect(user).redeemAndBurn(await user.getAddress(), creditAmount(1000))).to.be.revertedWithCustomError(credit, "OnlyTransferAllowedRole");
    });

    it("should revert when token holder does not have enough Credit balance", async function () {
      // Transfer 5000 USDC to Credit contract
      await usdc.connect(admin).transfer(credit.address, ethers.utils.parseUnits("5000", "6"));

      //! Transfer 100 Credit to user
      await credit.connect(admin).transfer(await user.getAddress(), creditAmount(100));

      // Grant `TRANSFER_ALLOWED_ROLE` to user
      await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());

      // Grant `REDEEMER_ROLE` to user
      await credit.connect(admin).grantRole(await credit.REDEEMER_ROLE(), await user.getAddress());

      // Redeem and burn 1000 Credit from user
      const revertString = "ERC20: burn amount exceeds balance";
      await expect(credit.connect(user).redeemAndBurn(await user.getAddress(), creditAmount(1000))).to.be.revertedWith(revertString);
    });

    it("should revert when Credit contract does not have enough USDC balance", async function () {
      //! Transfer 500 USDC to Credit contract
      await usdc.connect(admin).transfer(credit.address, ethers.utils.parseUnits("500", "6"));

      // Transfer 100 Credit to user
      await credit.connect(admin).transfer(await user.getAddress(), creditAmount(100));

      // Grant `TRANSFER_ALLOWED_ROLE` to user
      await credit.connect(admin).grantRole(await credit.TRANSFER_ALLOWED_ROLE(), await user.getAddress());

      // Grant `REDEEMER_ROLE` to user
      await credit.connect(admin).grantRole(await credit.REDEEMER_ROLE(), await user.getAddress());

      // Redeem and burn 1000 Credit from user
      const revertString = "ERC20: transfer amount exceeds balance";
      await expect(credit.connect(user).redeemAndBurn(await user.getAddress(), creditAmount(1000))).to.be.revertedWith(revertString);
    });
  });

  describe("Pause/Unpause", function () {
    beforeEach(async function () {
      await credit.connect(admin).grantRole(await credit.PAUSER_ROLE(), await admin.getAddress());
      await credit.connect(admin).pause();
    });

    it("should revert when calling mint", async function () {
      await credit.connect(admin).grantRole(await credit.MINTER_ROLE(), await admin.getAddress());

      const revertString = "Pausable: paused";
      await expect(credit.connect(admin).mint(await admin.getAddress(), creditAmount(1000))).to.be.revertedWith(revertString);
    });

    it("should revert when calling burn", async function () {
      await credit.connect(admin).grantRole(await credit.BURNER_ROLE(), await admin.getAddress());

      const revertString = "Pausable: paused";
      await expect(credit.connect(admin).burn(await admin.getAddress(), creditAmount(1000))).to.be.revertedWith(revertString);
    });

    it("should revert when calling redeemAndBurn", async function () {
      await credit.connect(admin).grantRole(await credit.REDEEMER_ROLE(), await admin.getAddress());

      const revertString = "Pausable: paused";
      await expect(credit.connect(admin).redeemAndBurn(await admin.getAddress(), creditAmount(1000))).to.be.revertedWith(revertString);
    });

    it("emergency withdraw should be possible", async function () {
      const ADMIN_USDC_BALANCE_BEFORE = await usdc.balanceOf(await admin.getAddress());
      await credit.connect(admin).grantRole(await credit.EMERGENCY_WITHDRAW_ROLE(), await admin.getAddress());

      // Transfer 5000 USDC to Credit contract
      const USDC_AMOUNT = ethers.utils.parseUnits("5000", "6");
      await usdc.connect(admin).transfer(credit.address, USDC_AMOUNT);

      expect(await usdc.balanceOf(credit.address)).to.equal(USDC_AMOUNT);
      expect(await usdc.balanceOf(await admin.getAddress())).to.equal(ADMIN_USDC_BALANCE_BEFORE.sub(USDC_AMOUNT));

      // Emergency withdraw
      await credit.connect(admin).emergencyWithdraw(usdc.address, await admin.getAddress(), USDC_AMOUNT);

      // Check that USDC balance of the admin is restored
      expect(await usdc.balanceOf(await admin.getAddress())).to.equal(ADMIN_USDC_BALANCE_BEFORE);
      // Check that USDC balance of the Credit contract is 0
      expect(await usdc.balanceOf(credit.address)).to.equal(0);
    });
  });
  
  describe("Emergency Withdraw", function () {
    it("should revert when not admin", async function () {
      await expect(credit.connect(user).emergencyWithdraw(usdc.address, await user.getAddress(), ethers.utils.parseUnits("5000", "6"))).to.be.revertedWithCustomError(credit, "OnlyAdmin");
    });
  });

  describe("Emergency Withdraw", function () {
    it("should withdraw USDC", async function () {
      const ADMIN_USDC_BALANCE_BEFORE = await usdc.balanceOf(await admin.getAddress());

      // Grant `EMERGENCY_WITHDRAW_ROLE` to admin
      await credit.connect(admin).grantRole(await credit.EMERGENCY_WITHDRAW_ROLE(), await admin.getAddress());

      // Transfer 5000 USDC to Credit contract
      const USDC_AMOUNT = ethers.utils.parseUnits("5000", "6");
      await usdc.connect(admin).transfer(credit.address, USDC_AMOUNT);

      // Emergency withdraw
      await credit.connect(admin).emergencyWithdraw(usdc.address, await admin.getAddress(), USDC_AMOUNT);

      // Check that USDC balance of the admin is restored
      expect(await usdc.balanceOf(await admin.getAddress())).to.equal(ADMIN_USDC_BALANCE_BEFORE);
      // Check that USDC balance of the Credit contract is 0
      expect(await usdc.balanceOf(credit.address)).to.equal(0);
    });

    it("should revert when not admin", async function () {
      // Grant `EMERGENCY_WITHDRAW_ROLE` to admin
      await credit.connect(admin).grantRole(await credit.EMERGENCY_WITHDRAW_ROLE(), await admin.getAddress());

      // Transfer 5000 USDC to Credit contract
      const USDC_AMOUNT = ethers.utils.parseUnits("5000", "6");
      await usdc.connect(admin).transfer(credit.address, USDC_AMOUNT);

      //! user calls Emergency withdraw
      await expect(credit.connect(user).emergencyWithdraw(usdc.address, await admin.getAddress(), USDC_AMOUNT)).to.be.revertedWithCustomError(credit, "OnlyAdmin");
    });

    it("should revert when recipient does not have `EMERGENCY_WITHDRAW_ROLE`", async function () {
      // Grant `EMERGENCY_WITHDRAW_ROLE` to admin
      await credit.connect(admin).grantRole(await credit.EMERGENCY_WITHDRAW_ROLE(), await admin.getAddress());

      // Transfer 5000 USDC to Credit contract
      const USDC_AMOUNT = ethers.utils.parseUnits("5000", "6");
      await usdc.connect(admin).transfer(credit.address, USDC_AMOUNT);

      // Emergency withdraw to user
      await expect(credit.connect(admin).emergencyWithdraw(usdc.address, await user.getAddress(), USDC_AMOUNT)).to.be.revertedWithCustomError(credit, "OnlyToEmergencyWithdrawRole");
    });
  });
});
