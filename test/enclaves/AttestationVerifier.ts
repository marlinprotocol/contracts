import { expect } from "chai";
import { Contract, Signer, Wallet } from "ethers";
import { ethers, upgrades } from "hardhat";
import { AttestationVerifier } from "../../typechain-types";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { AbiCoder, BytesLike, keccak256, parseUnits, solidityPack } from "ethers/lib/utils";
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
    let signers: Signer[];
	let addrs: string[];

    let enclaveKeyMap: Record<string, AttestationVerifier.EnclaveImageStruct> = {};

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

        expect(addrs.length).to.be.greaterThanOrEqual(15, "Number of addresses are too less");

        enclaveKeyMap[addrs[13]] = image1;
        enclaveKeyMap[addrs[14]] = image2;
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => {});

    it("deploys with initialization disabled", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await AttestationVerifier.deploy();

        await expect(
            attestationVerifier.initialize([], []),
        ).to.be.revertedWith("Initializable: contract is already initialized");

        await expect(
            attestationVerifier.initialize(Object.values(enclaveKeyMap), Object.keys(enclaveKeyMap)),
        ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("deploys as proxy and initializes", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [[image1], [addrs[13]]],
            { kind: "uups" },
        );

        const imageId = await attestationVerifier.isVerified(addrs[13]);

        expect(imageId).to.equal(getImageId(image1));
        let {PCR0, PCR1, PCR2} = await attestationVerifier.whitelistedImages(imageId);
        expect({PCR0, PCR1, PCR2}).to.deep.equal(image1);
    });

    it("deploys as proxy and initialize with multiple images", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), Object.keys(enclaveKeyMap)],
            { kind: "uups" },
        );

        for(let i=0; i < Object.keys(enclaveKeyMap).length; i++) {
            const imageId = await attestationVerifier.isVerified(Object.keys(enclaveKeyMap)[i]);
            const image = Object.values(enclaveKeyMap)[i];
            expect(imageId).to.equal(getImageId(image));
            const {PCR0, PCR1, PCR2} = await attestationVerifier.whitelistedImages(imageId);
            expect({PCR0, PCR1, PCR2}).to.deep.equal(image);
        }
    });

    it("does not initialize with mismatched lengths", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        await expect(
            upgrades.deployProxy(
                AttestationVerifier,
                [Object.values(enclaveKeyMap).slice(-1), Object.keys(enclaveKeyMap)],
                { kind: "uups" },
            )
        ).to.be.revertedWith("AV:I-Image and key length mismatch");
    });

    it("upgrades", async function() {
		const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), Object.keys(enclaveKeyMap)],
            { kind: "uups" },
        );
		await upgrades.upgradeProxy(attestationVerifier.address, AttestationVerifier, { kind: "uups" });

        for(let verifierKey in enclaveKeyMap) {
            const image = enclaveKeyMap[verifierKey];
            expect(await attestationVerifier.isVerified(verifierKey)).to.equal(getImageId(image));
        }

		expect(
			await attestationVerifier.hasRole(await attestationVerifier.DEFAULT_ADMIN_ROLE(), addrs[0]),
		).to.be.true;
	});

	it("does not upgrade without admin", async function() {
		const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), Object.keys(enclaveKeyMap)],
            { kind: "uups" },
        );

		await expect(
			upgrades.upgradeProxy(attestationVerifier.address, AttestationVerifier.connect(signers[1]), {
				kind: "uups",
			}),
		).to.be.revertedWith("only admin");
	});

    it("cannot revoke all admins", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), Object.keys(enclaveKeyMap)],
            { kind: "uups" },
        );

        await expect(
            attestationVerifier.revokeRole(await attestationVerifier.DEFAULT_ADMIN_ROLE(), addrs[0]),
        ).to.be.revertedWith("AV:RR-All admins cannot be removed");
    });
});

testERC165(
	"Attestation Verifier ERC165",
	async function(_signers: Signer[], addrs: string[]) {
		const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [[image1], [addrs[0]]],
            { kind: "uups" },
        );
		return attestationVerifier;
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
    const attestationVerifier = await upgrades.deployProxy(
        AttestationVerifier,
        [[image1], [addrs[0]]],
        { kind: "uups" },
    );
    return attestationVerifier;
});

describe("Attestation Verifier - whitelisting images", function() {
    let signers: Signer[];
	let addrs: string[];

    let enclaveKeyMap: Record<string, AttestationVerifier.EnclaveImageStruct> = {};
    let attestationVerifier: AttestationVerifier;

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

        expect(addrs.length).to.be.greaterThanOrEqual(15, "Number of addresses are too less");

        enclaveKeyMap[addrs[13]] = image1;
        enclaveKeyMap[addrs[14]] = image2;
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifierGeneric = await upgrades.deployProxy(
            AttestationVerifier,
            [Object.values(enclaveKeyMap), Object.keys(enclaveKeyMap)],
            { kind: "uups" },
        );
        attestationVerifier = getAttestationVerifier(attestationVerifierGeneric.address, signers[0]);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => {});

    it("whitelist image", async function() {
        const imageId = getImageId(image3);
        const PCRs = await attestationVerifier.whitelistedImages(imageId);
        expect(PCRs.PCR0).to.equal("0x");
        expect(PCRs.PCR1).to.equal("0x");
        expect(PCRs.PCR2).to.equal("0x");
        await expect(attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2))
            .to.emit(attestationVerifier, "EnclaveImageWhitelisted").withArgs(imageId, image3.PCR0, image3.PCR1, image3.PCR2);
        let {PCR0, PCR1, PCR2} = await attestationVerifier.whitelistedImages(imageId);
        expect({PCR0, PCR1, PCR2}).to.deep.equal(image3);
    });

    it("whitelist image with empty PCRs", async function() {
        await expect(attestationVerifier.whitelistImage("0x", "0x", "0x"))
            .to.be.revertedWith("AV:IWI-PCR values must be 48 bytes");
    });

    it("whitelist image with invalid PCRs", async function() {
        const invalidImage = {
            PCR0: parseUnits("1", 14).toHexString(),
            PCR1: parseUnits("2", 14).toHexString(),
            PCR2: parseUnits("3", 14).toHexString(),
        };
        await expect(attestationVerifier.whitelistImage(invalidImage.PCR0, invalidImage.PCR1, invalidImage.PCR2))
            .to.be.revertedWith("AV:IWI-PCR values must be 48 bytes");
    });

    describe("whitelist enclave key", async function() {
        this.beforeAll(async function() {
            await attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => {});

        it("whitelist enclave key", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.whitelistEnclaveKey(addrs[12], imageId))
                .to.emit(attestationVerifier, "EnclaveKeyWhitelisted").withArgs(addrs[12], imageId);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(imageId);
        });

        it("whitelist multiple keys for same enclave image", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.whitelistEnclaveKey(addrs[11], imageId))
                .to.emit(attestationVerifier, "EnclaveKeyWhitelisted").withArgs(addrs[11], imageId);
            expect(await attestationVerifier.isVerified(addrs[11])).to.equal(imageId);
            await expect(attestationVerifier.whitelistEnclaveKey(addrs[12], imageId))
                .to.emit(attestationVerifier, "EnclaveKeyWhitelisted").withArgs(addrs[12], imageId);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(imageId);
        });

        it("whitelist enclave key with invalid imageId", async function() {
            await expect(attestationVerifier.whitelistEnclaveKey(addrs[12], "0x0000000000000000000000000000000000000000000000000000000000000000"))
                .to.be.revertedWith("AV:W-Image not whitelisted");
        });

        it("whitelist enclave key with invalid key", async function() {
            await expect(attestationVerifier.whitelistEnclaveKey(ethers.constants.AddressZero, getImageId(image3)))
                .to.be.revertedWith("AV:W-Invalid enclave key");
        });

        it("whitelist enclave key with already whitelisted key", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.whitelistEnclaveKey(addrs[12], imageId))
            await expect(attestationVerifier.whitelistEnclaveKey(addrs[12], imageId))
                .to.be.revertedWith("AV:W-Enclave key already verified");
        });
    });

    describe("revoke encalve", async function() {
        this.beforeAll(async function() {
            await attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
            await attestationVerifier.whitelistEnclaveKey(addrs[12], getImageId(image3));
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => {});

        it("revoke enclave", async function() {
            const imageId = getImageId(image3);
            await expect(attestationVerifier.revokeWhitelistedEnclave(addrs[12]))
                .to.emit(attestationVerifier, "WhitelistedEnclaveRevoked").withArgs(addrs[12], imageId);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            const {PCR0, PCR1, PCR2} = await attestationVerifier.whitelistedImages(imageId);
            expect({PCR0, PCR1, PCR2}).to.deep.equal({PCR0: "0x", PCR1: "0x", PCR2: "0x"});
        });

        it("revoke enclave that doesn't exist", async function() {
            await expect(attestationVerifier.revokeWhitelistedEnclave(ethers.constants.AddressZero))
                .to.be.revertedWith("AV:R-Enclave key not verified");
            await expect(attestationVerifier.revokeWhitelistedEnclave(addrs[1]))
                .to.be.revertedWith("AV:R-Enclave key not verified");
        });

        it("revoke enclave key that is already revoked", async function() {
            await expect(attestationVerifier.revokeWhitelistedEnclave(addrs[12]));
            await expect(attestationVerifier.revokeWhitelistedEnclave(addrs[12]))
                .to.be.revertedWith("AV:R-Enclave key not verified");
        });

        it("revoke enclave key for enclave that is revoked", async function() {
            const imageId = getImageId(image3);
            await attestationVerifier.whitelistEnclaveKey(addrs[11], imageId);
            await attestationVerifier.revokeWhitelistedEnclave(addrs[12]);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
            const {PCR0, PCR1, PCR2} = await attestationVerifier.whitelistedImages(imageId);
            expect({PCR0, PCR1, PCR2}).to.deep.equal({PCR0: "0x", PCR1: "0x", PCR2: "0x"});
            expect(await attestationVerifier.isVerified(addrs[11])).to.equal(imageId);
            await expect(attestationVerifier.revokeWhitelistedEnclave(addrs[11]))
                .to.emit(attestationVerifier, "WhitelistedEnclaveRevoked").withArgs(addrs[11], imageId);
        });
    });

    describe("verify enclave key", async function() {
        const sourceEnclaveWallet = ethers.Wallet.createRandom();
        this.beforeAll(async function() {
            await attestationVerifier.whitelistEnclaveKey(sourceEnclaveWallet.address, getImageId(image2));
            await attestationVerifier.whitelistImage(image3.PCR0, image3.PCR1, image3.PCR2);
        });

        takeSnapshotBeforeAndAfterEveryTest(async () => {});

        it("verify enclave key", async function() {
            const imageId = getImageId(image3);
            const attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], imageId, 2, 1024))
                .to.emit(attestationVerifier, "EnclaveKeyVerified").withArgs(addrs[12], imageId);
            expect(await attestationVerifier.isVerified(addrs[12])).to.equal(imageId);
        });

        it("verify enclave key of nonwhitelisted enclave", async function() {
            const nonWhitelistedEnclave: AttestationVerifier.EnclaveImageStruct = ({
                PCR0: parseUnits("11", 113).toHexString(),
                PCR1: parseUnits("12", 113).toHexString(),
                PCR2: parseUnits("13", 113).toHexString(),
            });
            const imageId = getImageId(nonWhitelistedEnclave);
            const attestation = await createAttestation(addrs[12], nonWhitelistedEnclave, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], imageId, 2, 1024))
                .to.be.revertedWith("AV:V-Enclave image to verify not whitelisted");
        });

        it("verify enclave key with invalid attestation", async function() {
            let attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 2, 5000);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(addrs[12], image3, sourceEnclaveWallet, 3, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(addrs[12], image3, ethers.Wallet.createRandom(), 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(addrs[12], image1, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
            attestation = await createAttestation(addrs[11], image3, sourceEnclaveWallet, 2, 1024);
            await expect(attestationVerifier.verifyEnclaveKey(attestation, sourceEnclaveWallet.address, addrs[12], getImageId(image3), 2, 1024))
                .to.be.revertedWith("AV:VE-Attestation must be signed by source enclave");
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
        ["string", "address", "bytes", "bytes", "bytes", "uint256", "uint256"],
        [ATTESTATION_PREFIX, enclaveKey, image.PCR0, image.PCR1, image.PCR2, CPU, memory]
    );
    const digest = ethers.utils.keccak256(message);
    const sign = sourceEnclaveKey._signingKey().signDigest(digest);
    return ethers.utils.joinSignature(sign);
}