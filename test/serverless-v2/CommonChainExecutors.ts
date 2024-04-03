import { expect } from "chai";
import { Signer, Wallet, BigNumber as BN, constants } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { AttestationAutherSample, AttestationAutherUpgradeable } from "../../typechain-types/contracts/enclaves/AttestationAutherSample";
import { AttestationVerifier, CommonChainExecutors, CommonChainGateways, Pond } from "../../typechain-types";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { keccak256, parseUnits, solidityPack } from "ethers/lib/utils";
import { testERC165 } from "../helpers/erc165";
import { testAdminRole } from "../helpers/rbac";
import { getAttestationAutherSample, getAttestationVerifier, getCommonChainExecutors, getCommonChainGateways, getPond } from "../../utils/typechainConvertor";
import { time } from '@nomicfoundation/hardhat-network-helpers';


const image1: AttestationAutherUpgradeable.EnclaveImageStruct = {
	PCR0: parseUnits("1", 115).toHexString(),
	PCR1: parseUnits("2", 114).toHexString(),
	PCR2: parseUnits("3", 114).toHexString(),
};

const image2: AttestationAutherUpgradeable.EnclaveImageStruct = {
	PCR0: parseUnits("4", 114).toHexString(),
	PCR1: parseUnits("5", 114).toHexString(),
	PCR2: parseUnits("6", 114).toHexString(),
};

const image3: AttestationAutherUpgradeable.EnclaveImageStruct = {
	PCR0: parseUnits("7", 114).toHexString(),
	PCR1: parseUnits("8", 114).toHexString(),
	PCR2: parseUnits("9", 114).toHexString(),
};

function getImageId(image: AttestationAutherUpgradeable.EnclaveImageStruct): string {
	return keccak256(solidityPack(["bytes", "bytes", "bytes"], [image.PCR0, image.PCR1, image.PCR2]));
}

describe("CommonChainExecutors - Init", function () {
	let signers: Signer[];
	let addrs: string[];
	let attestationVerifier: AttestationVerifier;
	let token: string;

	before(async function () {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
		const attestationVerifierContract = await upgrades.deployProxy(
			AttestationVerifier,
			[[image1], [addrs[13]], addrs[0]],
			{ kind: "uups" },
		);
		attestationVerifier = getAttestationVerifier(attestationVerifierContract.address, signers[0]);

		token = addrs[1];
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("deploys with initialization disabled", async function () {

		const CommonChainExecutors = await ethers.getContractFactory("CommonChainExecutors");
		const commonChainExecutors = await CommonChainExecutors.deploy(addrs[10], 600);

		expect(await commonChainExecutors.ATTESTATION_VERIFIER()).to.equal(addrs[10]);
		expect(await commonChainExecutors.ATTESTATION_MAX_AGE()).to.equal(600);

		await expect(
			commonChainExecutors.__CommonChainExecutors_init(addrs[0], [], token),
		).to.be.revertedWith("Initializable: contract is already initialized");

		await expect(
			commonChainExecutors.__CommonChainExecutors_init(addrs[0], [image1, image2], token),
		).to.be.revertedWith("Initializable: contract is already initialized");
	});

	it("deploys as proxy and initializes", async function () {
		const CommonChainExecutors = await ethers.getContractFactory("CommonChainExecutors");
		const commonChainExecutors = await upgrades.deployProxy(
			CommonChainExecutors,
			[addrs[0], [image1], token],
			{
				kind: "uups",
				initializer: "__CommonChainExecutors_init",
				constructorArgs: [attestationVerifier.address, 600]
			},
		);

		expect(await commonChainExecutors.ATTESTATION_VERIFIER()).to.equal(attestationVerifier.address);
		expect(await commonChainExecutors.ATTESTATION_MAX_AGE()).to.equal(600);

		expect(await commonChainExecutors.hasRole(await commonChainExecutors.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
		expect(await commonChainExecutors.getRoleMemberCount(await commonChainExecutors.DEFAULT_ADMIN_ROLE())).to.equal(1);
		{
			const { PCR0, PCR1, PCR2 } = await commonChainExecutors.getWhitelistedImage(getImageId(image1));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image1);
		}
	});

	it("cannot initialize with zero address as admin", async function () {
		const CommonChainExecutors = await ethers.getContractFactory("CommonChainExecutors");
		await expect(
			upgrades.deployProxy(
				CommonChainExecutors,
				[ethers.constants.AddressZero, [image1, image2, image3], token],
				{
					kind: "uups",
					initializer: "__CommonChainExecutors_init",
					constructorArgs: [attestationVerifier.address, 600]
				},
			)
		).to.be.revertedWith("ZERO_ADDRESS_ADMIN");
	});

	it("upgrades", async function () {
		const CommonChainExecutors = await ethers.getContractFactory("CommonChainExecutors");
		const commonChainExecutors = await upgrades.deployProxy(
			CommonChainExecutors,
			[addrs[0], [image1, image2, image3], token],
			{
				kind: "uups",
				initializer: "__CommonChainExecutors_init",
				constructorArgs: [addrs[10], 600]
			},
		);
		await upgrades.upgradeProxy(
			commonChainExecutors.address,
			CommonChainExecutors,
			{
				kind: "uups",
				constructorArgs: [addrs[10], 600]
			}
		);

		expect(await commonChainExecutors.ATTESTATION_VERIFIER()).to.equal(addrs[10]);
		expect(await commonChainExecutors.ATTESTATION_MAX_AGE()).to.equal(600);

		expect(await commonChainExecutors.hasRole(await commonChainExecutors.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
		expect(await commonChainExecutors.getRoleMemberCount(await commonChainExecutors.DEFAULT_ADMIN_ROLE())).to.equal(1);
		{
			const { PCR0, PCR1, PCR2 } = await commonChainExecutors.getWhitelistedImage(getImageId(image1));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image1);
		}
		{
			const { PCR0, PCR1, PCR2 } = await commonChainExecutors.getWhitelistedImage(getImageId(image2));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image2);
		}
		{
			const { PCR0, PCR1, PCR2 } = await commonChainExecutors.getWhitelistedImage(getImageId(image3));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image3);
		}
	});

	it("does not upgrade without admin", async function () {
		const CommonChainExecutors = await ethers.getContractFactory("CommonChainExecutors");
		const commonChainExecutors = await upgrades.deployProxy(
			CommonChainExecutors,
			[addrs[0], [image1, image2, image3], token],
			{
				kind: "uups",
				initializer: "__CommonChainExecutors_init",
				constructorArgs: [addrs[10], 600]
			},
		);

		await expect(
			upgrades.upgradeProxy(commonChainExecutors.address, CommonChainExecutors.connect(signers[1]), {
				kind: "uups",
				constructorArgs: [addrs[10], 600],
			}),
		).to.be.revertedWith("only admin");
	});
});

describe("CommonChainExecutors - Verify", function () {
	let signers: Signer[];
	let addrs: string[];
	let attestationVerifier: AttestationVerifier;
	let token: string;
	let commonChainExecutors: CommonChainExecutors;

	before(async function () {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
		const attestationVerifierContract = await upgrades.deployProxy(
			AttestationVerifier,
			[[image1], [addrs[14]], addrs[0]],
			{ kind: "uups" },
		);
		attestationVerifier = getAttestationVerifier(attestationVerifierContract.address, signers[0]);

		token = addrs[1];

		const CommonChainExecutors = await ethers.getContractFactory("CommonChainExecutors");
		const commonChainExecutorsContract = await upgrades.deployProxy(
			CommonChainExecutors,
			[addrs[0], [image2, image3], token],
			{
				kind: "uups",
				initializer: "__CommonChainExecutors_init",
				constructorArgs: [attestationVerifier.address, 600]
			},
		);
		commonChainExecutors = getCommonChainExecutors(commonChainExecutorsContract.address, signers[0]);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can verify enclave key", async function () {
		const timestamp = await time.latest() * 1000;
		let wallet14 = walletForIndex(14).connect(commonChainExecutors.provider);
		let wallet15 = walletForIndex(15).connect(commonChainExecutors.provider);
		let attestation = createAttestation(normalize(wallet15.publicKey), image3, wallet14, 2, 4096, timestamp - 540000);

		await expect(commonChainExecutors.connect(signers[1]).verifyKey(attestation, normalize(wallet15.publicKey), getImageId(image3), 2, 4096, timestamp - 540000))
			.to.emit(commonChainExecutors, "EnclaveKeyVerified").withArgs(normalize(wallet15.publicKey), getImageId(image3));
		expect(await commonChainExecutors.getVerifiedKey(addrs[15])).to.equal(getImageId(image3));
	});
});

describe.only("CommonChainExecutors - Register executor", function () {
	let signers: Signer[];
	let addrs: string[];
	let token: Pond;
	let attestationVerifier: AttestationVerifier;
	let commonChainExecutors: CommonChainExecutors;

	before(async function () {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));

		const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
		const attestationVerifierContract = await upgrades.deployProxy(
			AttestationVerifier,
			[[image1], [addrs[14]], addrs[0]],
			{ kind: "uups" },
		);
		attestationVerifier = getAttestationVerifier(attestationVerifierContract.address, signers[0]);

		const Pond = await ethers.getContractFactory("Pond");
        const pondContract = await upgrades.deployProxy(Pond, ["Marlin", "POND"], {
            kind: "uups",
        });
        token = getPond(pondContract.address, signers[0]);

		const CommonChainExecutors = await ethers.getContractFactory("CommonChainExecutors");
		const commonChainExecutorsContract = await upgrades.deployProxy(
			CommonChainExecutors,
			[addrs[0], [image2, image3], token.address],
			{
				kind: "uups",
				initializer: "__CommonChainExecutors_init",
				constructorArgs: [attestationVerifier.address, 600]
			},
		);
		commonChainExecutors = getCommonChainExecutors(commonChainExecutorsContract.address, signers[0]);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can register executor", async function () {
		const timestamp = await time.latest() * 1000;
		let wallet14 = walletForIndex(14).connect(commonChainExecutors.provider);
		let wallet15 = walletForIndex(15).connect(commonChainExecutors.provider);
		let attestation = createAttestation(normalize(wallet15.publicKey), image2, wallet14, 2, 4096, timestamp - 540000);

		let jobCapacity = 20;
		const message = ethers.utils.solidityPack(
			["uint256"],
			[jobCapacity],
		);
		const digest = ethers.utils.keccak256(message);
		let sign = wallet15._signingKey().signDigest(digest);
		let signature = ethers.utils.joinSignature(sign);

		await expect(commonChainExecutors.connect(signers[1]).registerExecutor(attestation, normalize(wallet15.publicKey), image2.PCR0, image2.PCR1, image2.PCR2, 2, 4096, timestamp - 540000, jobCapacity, signature, 0))
			.to.emit(commonChainExecutors, "EnclaveKeyVerified").withArgs(normalize(wallet15.publicKey), getImageId(image2));
		expect(await commonChainExecutors.getVerifiedKey(addrs[15])).to.equal(getImageId(image2));

	});

	it('can deregister executor', async function () {
		const timestamp = await time.latest() * 1000;
		let wallet14 = walletForIndex(14).connect(commonChainExecutors.provider);
		let wallet15 = walletForIndex(15).connect(commonChainExecutors.provider);
		let attestation = createAttestation(normalize(wallet15.publicKey), image2, wallet14, 2, 4096, timestamp - 540000);

		let jobCapacity = 20;
		const message = ethers.utils.solidityPack(
			["uint256"],
			[jobCapacity],
		);
		const digest = ethers.utils.keccak256(message);
		let sign = wallet15._signingKey().signDigest(digest);
		let signature = ethers.utils.joinSignature(sign);

		await commonChainExecutors.connect(signers[1]).registerExecutor(attestation, normalize(wallet15.publicKey), image2.PCR0, image2.PCR1, image2.PCR2, 2, 4096, timestamp - 540000, jobCapacity, signature, 0);

		await expect(commonChainExecutors.connect(signers[1]).deregisterExecutor(normalize(wallet15.publicKey)))
			.to.emit(commonChainExecutors, "ExecutorDeregistered").withArgs(normalize(wallet15.publicKey));

		expect(await commonChainExecutors.getVerifiedKey(addrs[15])).to.equal(constants.HashZero);
	});

});

function normalize(key: string): string {
	return '0x' + key.substring(4);
}

function createAttestation(
	enclaveKey: string,
	image: AttestationAutherUpgradeable.EnclaveImageStruct,
	sourceEnclaveKey: Wallet,
	CPU: number,
	memory: number,
	timestamp: number,
): string {
	const ATTESTATION_PREFIX = "Enclave Attestation Verified";
	const message = ethers.utils.defaultAbiCoder.encode(
		["string", "bytes", "bytes", "bytes", "bytes", "uint256", "uint256", "uint256"],
		[ATTESTATION_PREFIX, enclaveKey, image.PCR0, image.PCR1, image.PCR2, CPU, memory, timestamp]
	);
	const digest = ethers.utils.keccak256(message);
	const sign = sourceEnclaveKey._signingKey().signDigest(digest);
	return ethers.utils.joinSignature(sign);
}

function createSignature(
	msg: string,
	sourceEnclaveKey: Wallet,
): string {
	const ATTESTATION_PREFIX = "attestation-auther-sample-";
	const message = ethers.utils.solidityPack(
		["string", "string"],
		[ATTESTATION_PREFIX, msg],
	);
	const digest = ethers.utils.keccak256(message);
	const sign = sourceEnclaveKey._signingKey().signDigest(digest);
	return ethers.utils.joinSignature(sign);
}

function walletForIndex(idx: number): Wallet {
	let wallet = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk", "m/44'/60'/0'/0/" + idx.toString());

	return wallet;
}
