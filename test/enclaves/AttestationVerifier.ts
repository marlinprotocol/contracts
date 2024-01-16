import { expect } from "chai";
import { Signer, Wallet, BigNumber } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { AttestationVerifier } from "../../typechain-types";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { AbiCoder, keccak256, parseUnits, solidityPack } from "ethers/lib/utils";
import { testERC165 } from "../helpers/erc165";
import { testAdminRole } from "../helpers/rbac";
import { getAttestationVerifier } from "../../utils/typechainConvertor";

const image1: AttestationVerifier.EnclaveImageStruct = {
    PCR0: parseUnits("1", 115).toHexString(),
    PCR1: parseUnits("2", 114).toHexString(),
    PCR2: parseUnits("3", 114).toHexString(),
};

const image2: AttestationVerifier.EnclaveImageStruct = {
    PCR0: parseUnits("4", 114).toHexString(),
    PCR1: parseUnits("5", 114).toHexString(),
    PCR2: parseUnits("6", 114).toHexString(),
};

const image3: AttestationVerifier.EnclaveImageStruct = {
    PCR0: parseUnits("7", 114).toHexString(),
    PCR1: parseUnits("8", 114).toHexString(),
    PCR2: parseUnits("9", 114).toHexString(),
};

// TODO: get this from contract
const ATTESTATION_PREFIX = "Enclave Attestation Verified";

describe("Attestation Verifier Deploy and Init", function() {
    let wallets: Wallet[];
    let admin: Wallet;

    let enclaveKeyMap: Record<string, AttestationVerifier.EnclaveImageStruct> = {};

    before(async function() {
        wallets = await createWallets(15, BigNumber.from("1000000000000000000"));
        admin = wallets[0].connect(ethers.provider);

        expect(wallets.length).to.be.greaterThanOrEqual(15, "Number of addresses are too less");

        enclaveKeyMap[wallets[13].publicKey] = image1;
        enclaveKeyMap[wallets[14].publicKey] = image2;
    });

    takeSnapshotBeforeAndAfterEveryTest(async () => { });

    it("deploys with initialization disabled", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await AttestationVerifier.deploy();

        await expect(
            attestationVerifier.initialize([], [], admin.address),
        ).to.be.revertedWith("Initializable: contract is already initialized");

        await expect(
            attestationVerifier.initialize(Object.values(enclaveKeyMap), pubKeysToAddress(Object.keys(enclaveKeyMap)), admin.address),
        ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("deploys as proxy and initializes", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [[image1], [wallets[13].address], admin.address],
            { kind: "uups" },
        );

        const imageId = await attestationVerifier.isVerified(wallets[13].address);
        expect(imageId).to.equal(getImageId(image1));
        let { PCR0, PCR1, PCR2 } = await attestationVerifier.whitelistedImages(imageId);
        expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image1);
        const adminRole = await attestationVerifier.DEFAULT_ADMIN_ROLE();
        const contractAdmin = await attestationVerifier.getRoleMember(adminRole, 0);
        expect(contractAdmin).to.equal(admin.address);
        const noOfAdmins = await attestationVerifier.getRoleMemberCount(adminRole);
        expect(noOfAdmins).to.equal(1);
    });

    it("deploys as proxy and initialize with multiple images", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const enclaveKeys = pubKeysToAddress(Object.keys(enclaveKeyMap));
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), enclaveKeys, admin.address],
            { kind: "uups" },
        );

        for (let i = 0; i < Object.keys(enclaveKeyMap).length; i++) {
            const imageId = await attestationVerifier.isVerified(enclaveKeys[i]);
            const image = Object.values(enclaveKeyMap)[i];
            expect(imageId).to.equal(getImageId(image));
            const { PCR0, PCR1, PCR2 } = await attestationVerifier.whitelistedImages(imageId);
            expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image);
        }
        const adminRole = await attestationVerifier.DEFAULT_ADMIN_ROLE();
        const contractAdmin = await attestationVerifier.getRoleMember(adminRole, 0);
        expect(contractAdmin).to.equal(admin.address);
        const noOfAdmins = await attestationVerifier.getRoleMemberCount(adminRole);
        expect(noOfAdmins).to.equal(1);
    });

    it("does not initialize with mismatched lengths", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        await expect(
            upgrades.deployProxy(
                AttestationVerifier,
                [Object.values(enclaveKeyMap).slice(-1), pubKeysToAddress(Object.keys(enclaveKeyMap)), admin.address],
                { kind: "uups" },
            )
        ).to.be.revertedWith("AV:I-Image and key length mismatch");
    });

    it("can't initialize with 0 address as admin", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        await expect(
            upgrades.deployProxy(
                AttestationVerifier,
                [Object.values(enclaveKeyMap), pubKeysToAddress(Object.keys(enclaveKeyMap)), ethers.constants.AddressZero],
                { kind: "uups" },
            )
        ).to.be.revertedWith("AV:I-At least one admin necessary");
    });

    it("upgrades", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), pubKeysToAddress(Object.keys(enclaveKeyMap)), admin.address],
            { kind: "uups" },
        );
        await upgrades.upgradeProxy(attestationVerifier.address, AttestationVerifier.connect(admin), { kind: "uups" });

        for (let verifierPubKey in enclaveKeyMap) {
            let verifierKey = pubKeyToAddress(verifierPubKey);
            const image = enclaveKeyMap[verifierPubKey];
            expect(await attestationVerifier.isVerified(verifierKey)).to.equal(getImageId(image));
        }

        expect(
            await attestationVerifier.hasRole(await attestationVerifier.DEFAULT_ADMIN_ROLE(), wallets[0].address),
        ).to.be.true;
    });

    it("does not upgrade without admin", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), pubKeysToAddress(Object.keys(enclaveKeyMap)), admin.address],
            { kind: "uups" },
        );

        await expect(
            upgrades.upgradeProxy(attestationVerifier.address, AttestationVerifier.connect(wallets[1].connect(ethers.provider)), {
                kind: "uups",
            }),
        ).to.be.revertedWith("only admin");
    });

    it("cannot revoke all admins", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), pubKeysToAddress(Object.keys(enclaveKeyMap)), admin.address],
            { kind: "uups" },
        );

        await expect(
            attestationVerifier.connect(admin).revokeRole(await attestationVerifier.DEFAULT_ADMIN_ROLE(), wallets[0].address),
        ).to.be.revertedWith("AV:RR-All admins cant be removed");
    });
});

testERC165(
    "Attestation Verifier ERC165",
    async function(_signers: Signer[], addrs: string[]) {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const wallet = ethers.Wallet.createRandom();
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [[image1], [wallet.address], wallet.address],
            { kind: "uups" },
        );
        return attestationVerifier.connect(wallet.connect(ethers.provider));
    },
    {
        IAccessControl: [
            "hasRole(bytes32,address)",
            "getRoleAdmin(bytes32)",
            "grantRole(bytes32,address)",
            "revokeRole(bytes32,address)",
            "renounceRole(bytes32,address)",
        ],
        IAccessControlEnumerable: [
            "getRoleMember(bytes32,uint256)",
            "getRoleMemberCount(bytes32)",
        ],
    },
);

testAdminRole("Attestation Verifier Admin", async function(_signers: Signer[], addrs: string[]) {
    const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
    const wallet = ethers.Wallet.createRandom();
    const wallets = await createWallets(1, BigNumber.from("1000000000000000000"));
    const admin = wallets[0].connect(ethers.provider);
    const attestationVerifier = await upgrades.deployProxy(
        AttestationVerifier,
        [[image1], [wallet.address], admin.address],
        { kind: "uups" },
    );
    return attestationVerifier.connect(admin);
});

describe("Attestation Verifier - whitelisting images", function() {
    let wallets: Wallet[];
    let admin: Wallet;

    let enclaveKeyMap: Record<string, AttestationVerifier.EnclaveImageStruct> = {};
    let attestationVerifier: AttestationVerifier;

    let baseSnapshot: any;

    before(async function() {
        wallets = await createWallets(15, BigNumber.from("1000000000000000000"));
        admin = wallets[0].connect(ethers.provider);
        expect(wallets.length).to.be.greaterThanOrEqual(15, "Number of addresses are too less");
        enclaveKeyMap[wallets[13].publicKey] = image1;
        enclaveKeyMap[wallets[14].publicKey] = image2;

        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifierGeneric = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), pubKeysToAddress(Object.keys(enclaveKeyMap)), admin.address],
            { kind: "uups" },
        );
        attestationVerifier = getAttestationVerifier(attestationVerifierGeneric.address, wallets[1].connect(ethers.provider));
        baseSnapshot = await network.provider.request({
            method: "evm_snapshot",
            params: [],
        });
    });

    it("whitelist image", async function() {
        await network.provider.request({
            method: "evm_revert",
            params: [baseSnapshot],
        });
        baseSnapshot = await network.provider.request({
            method: "evm_snapshot",
            params: [],
        });
        const imageId = getImageId(image3);
        const PCRs = await attestationVerifier.whitelistedImages(imageId);
        expect(PCRs.PCR0).to.equal("0x");
        expect(PCRs.PCR1).to.equal("0x");
        expect(PCRs.PCR2).to.equal("0x");
        await expect(attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2, { gasLimit: 10000000 }))
            .to.be.revertedWith("only admin");
        await expect(attestationVerifier.connect(admin).whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2))
            .to.emit(attestationVerifier, "EnclaveImageWhitelisted").withArgs(imageId, image3.PCR0, image3.PCR1, image3.PCR2);
        let { PCR0, PCR1, PCR2 } = await attestationVerifier.whitelistedImages(imageId);
        expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image3);
    });

    it("whitelist image with empty PCRs", async function() {
        await network.provider.request({
            method: "evm_revert",
            params: [baseSnapshot],
        });
        baseSnapshot = await network.provider.request({
            method: "evm_snapshot",
            params: [],
        });
        await expect(attestationVerifier.connect(admin).whitelistImage("0x", "0x", "0x", { gasLimit: 10000000 }))
            .to.be.revertedWith("AV:IWI-PCR values must be 48 bytes");
    });

    it("whitelist image with invalid PCRs", async function() {
        await network.provider.request({
            method: "evm_revert",
            params: [baseSnapshot],
        });
        baseSnapshot = await network.provider.request({
            method: "evm_snapshot",
            params: [],
        });
        const invalidImage = {
            PCR0: parseUnits("1", 14).toHexString(),
            PCR1: parseUnits("2", 14).toHexString(),
            PCR2: parseUnits("3", 14).toHexString(),
        };
        await expect(attestationVerifier.connect(admin).whitelistImage(invalidImage.PCR0, invalidImage.PCR1, invalidImage.PCR2, { gasLimit: 10000000 }))
            .to.be.revertedWith("AV:IWI-PCR values must be 48 bytes");
    });

    describe("revoke image", function() {
        before(async function() {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            await attestationVerifier.connect(admin).whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("Revoke whitelisted image", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.connect(admin).revokeWhitelistedImage(imageId))
                .to.emit(attestationVerifier, "WhitelistedImageRevoked").withArgs(imageId);
            const PCRs = await attestationVerifier.whitelistedImages(imageId);
            expect(PCRs.PCR0).to.equal("0x");
            expect(PCRs.PCR1).to.equal("0x");
            expect(PCRs.PCR2).to.equal("0x");
        });

        it("Revoke image with invalid imageId", async function() {
            await expect(attestationVerifier.connect(admin).revokeWhitelistedImage(ethers.utils.hexZeroPad("0x1", 32), { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:RWI-Image not whitelisted");
        });

        it("Revoke image with already revoked imageId", async function() {
            const imageId = getImageId(image3);
            await attestationVerifier.connect(admin).revokeWhitelistedImage(imageId);
            await expect(attestationVerifier.connect(admin).revokeWhitelistedImage(imageId, { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:RWI-Image not whitelisted");
        });

        it("Revoke image with whitelisted enclave key", async function() {
            const imageId = getImageId(image3);
            await attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[12].address);
            await expect(attestationVerifier.connect(admin).revokeWhitelistedImage(imageId))
                .to.emit(attestationVerifier, "WhitelistedImageRevoked").withArgs(imageId);
            const PCRs = await attestationVerifier.whitelistedImages(imageId);
            expect(PCRs.PCR0).to.equal("0x");
            expect(PCRs.PCR1).to.equal("0x");
            expect(PCRs.PCR2).to.equal("0x");
        });

        it("Revoke image with whitelisted enclave and remove enclave", async function() {
            const imageId = getImageId(image3);
            await attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[12].address);
            await attestationVerifier.connect(admin).revokeWhitelistedEnclave(wallets[12].address);
            await expect(attestationVerifier.connect(admin).revokeWhitelistedImage(imageId))
                .to.emit(attestationVerifier, "WhitelistedImageRevoked").withArgs(imageId);
            const PCRs = await attestationVerifier.whitelistedImages(imageId);
            expect(PCRs.PCR0).to.equal("0x");
            expect(PCRs.PCR1).to.equal("0x");
            expect(PCRs.PCR2).to.equal("0x");
        });

        it("Revoke image with multiple whitelisted enclaves", async function() {
            const imageId = getImageId(image3);
            await attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[12].address);
            await attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[11].address);
            await expect(attestationVerifier.connect(admin).revokeWhitelistedImage(imageId))
                .to.emit(attestationVerifier, "WhitelistedImageRevoked").withArgs(imageId);
            const PCRs = await attestationVerifier.whitelistedImages(imageId);
            expect(PCRs.PCR0).to.equal("0x");
            expect(PCRs.PCR1).to.equal("0x");
            expect(PCRs.PCR2).to.equal("0x");
        });
    });

    describe("whitelist enclave key", function() {
        before(async function() {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            await attestationVerifier.connect(admin).whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("whitelist enclave key", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[12].address))
                .to.emit(attestationVerifier, "EnclaveKeyWhitelisted").withArgs(imageId, wallets[12].address);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(imageId);
        });

        it("whitelist multiple keys for same enclave image", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[11].address))
                .to.emit(attestationVerifier, "EnclaveKeyWhitelisted").withArgs(imageId, wallets[11].address);
            expect(await attestationVerifier.isVerified(wallets[11].address)).to.equal(imageId);
            await expect(attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[12].address))
                .to.emit(attestationVerifier, "EnclaveKeyWhitelisted").withArgs(imageId, wallets[12].address);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(imageId);
        });

        it("whitelist enclave key with invalid imageId", async function() {
            await expect(attestationVerifier.connect(admin).whitelistEnclave(ethers.constants.HashZero, wallets[12].address, { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:WE-Image not whitelisted");
        });

        it("whitelist enclave key with invalid key", async function() {
            await expect(attestationVerifier.connect(admin).whitelistEnclave(getImageId(image3), ethers.constants.AddressZero, { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:WE-Invalid enclave key");
        });

        it("whitelist enclave key with already whitelisted key", async function() {
            const imageId = getImageId(image3);
            await attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[12].address)
            await expect(attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[12].address, { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:WE-Enclave key already verified");
        });
    });

    describe("revoke enclave key", function() {
        before(async function() {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            await attestationVerifier.connect(admin).whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
            await attestationVerifier.connect(admin).whitelistEnclave(getImageId(image3), wallets[12].address);
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("revoke enclave key", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.connect(admin).revokeWhitelistedEnclave(wallets[12].address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked").withArgs(imageId, wallets[12].address);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(ethers.constants.HashZero);
            const { PCR0, PCR1, PCR2 } = await attestationVerifier.whitelistedImages(imageId);
            expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image3);
        });

        it("revoke enclave that doesn't exist", async function() {
            await expect(attestationVerifier.connect(admin).revokeWhitelistedEnclave(ethers.constants.AddressZero, { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:RWE-Enclave key not verified");
            await expect(attestationVerifier.connect(admin).revokeWhitelistedEnclave(wallets[1].address, { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:RWE-Enclave key not verified");
        });

        it("revoke enclave key that is already revoked", async function() {
            await attestationVerifier.connect(admin).revokeWhitelistedEnclave(wallets[12].address, { gasLimit: 10000000 });
            await expect(attestationVerifier.connect(admin).revokeWhitelistedEnclave(wallets[12].address, { gasLimit: 10000000 }))
                .to.be.revertedWith("AV:RWE-Enclave key not verified");
        });

        it("revoke enclave key for enclave that is revoked", async function() {
            const imageId = getImageId(image3);
            await attestationVerifier.connect(admin).whitelistEnclave(imageId, wallets[11].address);
            await attestationVerifier.connect(admin).revokeWhitelistedEnclave(wallets[12].address);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(ethers.constants.HashZero);
            const { PCR0, PCR1, PCR2 } = await attestationVerifier.whitelistedImages(imageId);
            expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image3);
            expect(await attestationVerifier.isVerified(wallets[11].address)).to.equal(imageId);
            await expect(attestationVerifier.connect(admin).revokeWhitelistedEnclave(wallets[11].address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked").withArgs(imageId, wallets[11].address);
        });
    });

    describe("verify enclave key", function() {
        const sourceEnclaveWallet = ethers.Wallet.createRandom();
        before(async () => {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(ethers.constants.HashZero);
            await attestationVerifier.connect(admin).whitelistEnclave(getImageId(image2), sourceEnclaveWallet.address);
            await attestationVerifier.connect(admin).whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("verify enclave key", async () => {
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(ethers.constants.HashZero);
            const imageId = getImageId(image3);
            const attestation = await createAttestation(wallets[12].address, image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(imageId, wallets[12].publicKey);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(imageId);
        });

        it("verify enclave key of nonwhitelisted enclave", async () => {
            const nonWhitelistedEnclave: AttestationVerifier.EnclaveImageStruct = ({
                PCR0: parseUnits("11", 113).toHexString(),
                PCR1: parseUnits("12", 113).toHexString(),
                PCR2: parseUnits("13", 113).toHexString(),
            });
            const imageId = getImageId(nonWhitelistedEnclave);
            const attestation = await createAttestation(wallets[12].address, nonWhitelistedEnclave, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, imageId, 2, 1024))
                .to.be.revertedWith("AV:V-Enclave image to verify not whitelisted");
        });

        it("verify enclave key which is already verified", async () => {
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(ethers.constants.HashZero);
            const imageId = getImageId(image3);
            const attestation = await createAttestation(wallets[12].address, image3, sourceEnclaveWallet, 2, 1024);
            await attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, imageId, 2, 1024);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(imageId);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, imageId, 2, 1024))
                .to.be.revertedWith("AV:V-Enclave key already verified");
        });

        it("verify enclave key with invalid attestation", async function() {
            let attestation = await createAttestation(wallets[12].address, image3, sourceEnclaveWallet, 2, 5000);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(wallets[12].address, image3, sourceEnclaveWallet, 3, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(wallets[12].address, image3, ethers.Wallet.createRandom(), 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(wallets[12].address, image1, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(wallets[11].address, image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
        });

        // verify enclave key for a whitelisted enclave and remove enclave attestation
        // then check if enclave attestation is still getting verified
        it("verify enclave key for a whitelisted enclave and remove enclave from whitelist", async function() {
            const imageId = getImageId(image3);
            const attestation = await createAttestation(wallets[12].address, image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(imageId, wallets[12].publicKey);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(imageId);
            const imageId2 = getImageId(image2);
            await expect(attestationVerifier.revokeWhitelistedEnclave(sourceEnclaveWallet.address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked").withArgs(imageId2, sourceEnclaveWallet.address);
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(ethers.constants.HashZero);
            const attestation2 = await createAttestation(wallets[11].address, image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation2, wallets[11].publicKey, imageId2, 2, 1024))
                .to.be.revertedWith("AV:V-Enclave key must be verified");
            await expect(attestationVerifier["verify(bytes,bytes,bytes,bytes,bytes,uint256,uint256)"](
                attestation, wallets[12].publicKey, image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:V-Enclave key must be verified");
        });

        it("verify enclave key for a whitelisted enclave and remove enclave key", async function() {
            const imageId = getImageId(image3);
            const attestation = await createAttestation(wallets[12].address, image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, wallets[12].publicKey, imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(imageId, wallets[12].publicKey);
            expect(await attestationVerifier.isVerified(wallets[12].address)).to.equal(imageId);
            const imageId2 = getImageId(image2);
            await expect(attestationVerifier.revokeWhitelistedEnclave(wallets[12].address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked").withArgs(imageId, wallets[12].address);
        });
    });

    describe("verify attestation", async function() {
        const sourceEnclaveWallet = ethers.Wallet.createRandom();

        before(async function() {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            await attestationVerifier.whitelistEnclaveKey(sourceEnclaveWallet.address, getImageId(image2));
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("verify attestation", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.true;

            await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(ethers.constants.HashZero);
        });

        it("verify attestation - verified enclave", async function() {
            await attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
            const imageId = getImageId(image3);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(addrs[12], imageId);

            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.true;

            await attestationVerifier["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(imageId);
        });

        it("verify attestation - from same enclave multiple times", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.true;
            await attestationVerifier["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.true;
        });

        it("verify attestation - invalid attestation", async function() {
            let attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 5000);
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 5000
            )).to.be.true;
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.false;
            attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 3, 1024);
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.false;
            attestation = await createAttestation(addrs[12], image3, ethers.Wallet.createRandom(), 2, 1024);
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.false;
            attestation = await createAttestation(addrs[12], image1, sourceEnclaveWallet, 2, 1024);
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.false;
            attestation = await createAttestation(addrs[11], image3, sourceEnclaveWallet, 2, 1024);
            expect(await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.false;
        });

        it("verify attestation - non whitelisted source enclave", async function() {
            const nonWhitelistedEnclaveKey = ethers.Wallet.createRandom();
            const attestation = await createAttestation(addrs[12], image3, nonWhitelistedEnclaveKey, 2, 1024);
            await expect(attestationVerifier["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, nonWhitelistedEnclaveKey.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:V-Enclave key must be verified");
        });

        it("verify attestation - whitelisted and removed source enclave", async function() {
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(getImageId(image2));
            await expect(attestationVerifier.revokeWhitelistedEnclave(sourceEnclaveWallet.address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked")
                .withArgs(sourceEnclaveWallet.address, getImageId(image2));
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(ethers.constants.HashZero);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:V-Enclave key must be verified");
        });
    });

    describe("safe verify attestation", async function() {
        const sourceEnclaveWallet = ethers.Wallet.createRandom();

        before(async function() {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            await attestationVerifier.whitelistEnclaveKey(sourceEnclaveWallet.address, getImageId(image2));
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("verify attestation", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(ethers.constants.HashZero);
        });

        it("verify attestation - verified enclave", async function() {
            await attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
            const imageId = getImageId(image3);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(addrs[12], imageId);

            await attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(imageId);
        });

        it("verify attestation - from same enclave multiple times", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
            await attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
        });

        it("verify attestation - invalid attestation", async function() {
            let attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 5000);
            await attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 5000
            );
            await expect(attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:SV-invalid attestation");
            attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 3, 1024);
            await expect(attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:SV-invalid attestation");
            attestation = await createAttestation(addrs[12], image3, ethers.Wallet.createRandom(), 2, 1024);
            await expect(attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:SV-invalid attestation");
            attestation = await createAttestation(addrs[12], image1, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:SV-invalid attestation");
            attestation = await createAttestation(addrs[11], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:SV-invalid attestation");
        });

        it("verify attestation - non whitelisted source enclave", async function() {
            const nonWhitelistedEnclaveKey = ethers.Wallet.createRandom();
            const attestation = await createAttestation(addrs[12], image3, nonWhitelistedEnclaveKey, 2, 1024);
            await expect(attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, nonWhitelistedEnclaveKey.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:V-Enclave key must be verified");
        });

        it("verify attestation - whitelisted and removed source enclave", async function() {
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(getImageId(image2));
            await expect(attestationVerifier.revokeWhitelistedEnclave(sourceEnclaveWallet.address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked")
                .withArgs(sourceEnclaveWallet.address, getImageId(image2));
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(ethers.constants.HashZero);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier["safeVerify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            )).to.be.revertedWith("AV:V-Enclave key must be verified");
        });
    });

    describe("verify attestation - compressed", async function() {
        const sourceEnclaveWallet = ethers.Wallet.createRandom();
        const abiCoder = new AbiCoder();

        before(async function() {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            await attestationVerifier.whitelistEnclaveKey(sourceEnclaveWallet.address, getImageId(image2));
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("verify attestation", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.true;

            await attestationVerifier.callStatic["verify(bytes,address,address,bytes,bytes,bytes,uint256,uint256)"](
                attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024
            );
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(ethers.constants.HashZero);
        });

        it("verify attestation - verified enclave", async function() {
            await attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
            const imageId = getImageId(image3);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(addrs[12], imageId);

            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.true;
            await attestationVerifier["verify(bytes)"](verificationData);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(imageId);
        });

        it("verify attestation - from same enclave multiple times", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.true;
            await attestationVerifier["verify(bytes)"](verificationData);
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.true;
        });

        it("verify attestation - invalid attestation", async function() {
            let attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 5000);
            let verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 5000]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.true;
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.false;
            attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 3, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.false;
            attestation = await createAttestation(addrs[12], image3, ethers.Wallet.createRandom(), 2, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.false;
            attestation = await createAttestation(addrs[12], image1, sourceEnclaveWallet, 2, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.false;
            attestation = await createAttestation(addrs[11], image3, sourceEnclaveWallet, 2, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            expect(await attestationVerifier.callStatic["verify(bytes)"](verificationData)).to.be.false;
        });

        it("verify attestation - non whitelisted source enclave", async function() {
            const nonWhitelistedEnclaveKey = ethers.Wallet.createRandom();
            const attestation = await createAttestation(addrs[12], image3, nonWhitelistedEnclaveKey, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, nonWhitelistedEnclaveKey.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["verify(bytes)"](verificationData)).to.be.revertedWith("AV:V-Enclave key must be verified");
        });

        it("verify attestation - whitelisted and removed source enclave", async function() {
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(getImageId(image2));
            await expect(attestationVerifier.revokeWhitelistedEnclave(sourceEnclaveWallet.address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked")
                .withArgs(sourceEnclaveWallet.address, getImageId(image2));
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(ethers.constants.HashZero);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["verify(bytes)"](verificationData)).to.be.revertedWith("AV:V-Enclave key must be verified");
        });
    });

    describe("safe verify attestation - compressed", async function() {
        const sourceEnclaveWallet = ethers.Wallet.createRandom();
        const abiCoder = new AbiCoder();

        before(async function() {
            await network.provider.request({
                method: "evm_revert",
                params: [baseSnapshot],
            });
            baseSnapshot = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
            await attestationVerifier.whitelistEnclaveKey(sourceEnclaveWallet.address, getImageId(image2));
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => { });

        it("verify attestation", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await attestationVerifier["safeVerify(bytes)"](verificationData);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(ethers.constants.HashZero);
        });

        it("verify attestation - verified enclave", async function() {
            await attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
            const imageId = getImageId(image3);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(addrs[12], imageId);

            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await attestationVerifier["safeVerify(bytes)"](verificationData);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(imageId);
        });

        it("verify attestation - from same enclave multiple times", async function() {
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await attestationVerifier["safeVerify(bytes)"](verificationData);
            await attestationVerifier["safeVerify(bytes)"](verificationData);
        });

        it("verify attestation - invalid attestation", async function() {
            let attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 5000);
            let verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 5000]
            );
            await attestationVerifier["safeVerify(bytes)"](verificationData);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["safeVerify(bytes)"](verificationData)).to.be.revertedWith("AV:SV-invalid attestation");
            attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 3, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["safeVerify(bytes)"](verificationData)).to.be.revertedWith("AV:SV-invalid attestation");
            const randomWallet = ethers.Wallet.createRandom();
            attestation = await createAttestation(addrs[12], image3, randomWallet, 2, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["safeVerify(bytes)"](verificationData)).to.be.revertedWith("AV:SV-invalid attestation");
            attestation = await createAttestation(addrs[12], image1, sourceEnclaveWallet, 2, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["safeVerify(bytes)"](verificationData)).to.be.revertedWith("AV:SV-invalid attestation");
            attestation = await createAttestation(addrs[11], image3, sourceEnclaveWallet, 2, 1024);
            verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["safeVerify(bytes)"](verificationData)).to.be.revertedWith("AV:SV-invalid attestation");
        });

        it("verify attestation - non whitelisted source enclave", async function() {
            const nonWhitelistedEnclaveKey = ethers.Wallet.createRandom();
            const attestation = await createAttestation(addrs[12], image3, nonWhitelistedEnclaveKey, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, nonWhitelistedEnclaveKey.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["safeVerify(bytes)"](verificationData)).to.be.revertedWith("AV:V-Enclave key must be verified");
        });

        it("verify attestation - whitelisted and removed source enclave", async function() {
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(getImageId(image2));
            await expect(attestationVerifier.revokeWhitelistedEnclave(sourceEnclaveWallet.address))
                .to.emit(attestationVerifier, "WhitelistedEnclaveKeyRevoked")
                .withArgs(sourceEnclaveWallet.address, getImageId(image2));
            expect(await attestationVerifier.isVerified(sourceEnclaveWallet.address)).to.equal(ethers.constants.HashZero);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            const verificationData = abiCoder.encode(
                ["bytes", "address", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
                [attestation, sourceEnclaveWallet.address, addrs[12], image3.PCR0, image3.PCR1, image3.PCR2, 2, 1024]
            );
            await expect(attestationVerifier["safeVerify(bytes)"](verificationData)).to.be.revertedWith("AV:V-Enclave key must be verified");
        });
    });
});

function getImageId(image: AttestationVerifier.EnclaveImageStruct): string {
    return keccak256(solidityPack(["bytes", "bytes", "bytes"], [image.PCR0, image.PCR1, image.PCR2]));
}

async function createAttestation(
    enclaveKey: string,
    image: AttestationVerifier.EnclaveImageStruct,
    sourceEnclaveKey: Wallet,
    CPU: number,
    memory: number
): Promise<string> {
    const abiCoder = new AbiCoder();
    const message = abiCoder.encode(
        ["string", "bytes", "bytes", "bytes", "bytes", "uint256", "uint256"],
        [ATTESTATION_PREFIX, enclaveKey, image.PCR0, image.PCR1, image.PCR2, CPU, memory]
    );
    const digest = ethers.utils.keccak256(message);
    const sign = sourceEnclaveKey._signingKey().signDigest(digest);
    return ethers.utils.joinSignature(sign);
}

async function createWallets(n: number, amount: BigNumber): Promise<Wallet[]> {
    const wallets: Wallet[] = [];
    const signer = (await ethers.getSigners())[0];
    for (let i = 0; i < n; i++) {
        const wallet: Wallet = ethers.Wallet.createRandom();
        const tx = await signer.sendTransaction({
            to: wallet.address,
            value: amount
        });
        await tx.wait();
        wallets.push(wallet);
    }
    return wallets;
}

function pubKeysToAddress(pubKeys: string[]): string[] {
    let addresses: string[] = [];
    for (let i = 0; i < pubKeys.length; i++) {
        addresses.push(ethers.utils.computeAddress(pubKeys[i]));
    }
    return addresses;
}

function pubKeyToAddress(pubKey: string): string {
    return ethers.utils.computeAddress(pubKey)
}
