import { expect } from "chai";
import { Signer, Wallet, BigNumber as BN, constants } from "ethers";
import { ethers, network, upgrades } from "hardhat";
import { AttestationAutherSample, AttestationAutherUpgradeable } from "../../typechain-types/contracts/enclaves/AttestationAutherSample";
import { AttestationVerifier, CommonChainGateways, Pond } from "../../typechain-types";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { keccak256, parseUnits, solidityPack } from "ethers/lib/utils";
import { testERC165 } from "../helpers/erc165";
import { testAdminRole } from "../helpers/rbac";
import { getAttestationAutherSample, getAttestationVerifier, getCommonChainGateways, getPond } from "../../utils/typechainConvertor";
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

describe("CommonChainGateways - Init", function () {
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

		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		const commonChainGateways = await CommonChainGateways.deploy(addrs[10], 600);

		expect(await commonChainGateways.ATTESTATION_VERIFIER()).to.equal(addrs[10]);
		expect(await commonChainGateways.ATTESTATION_MAX_AGE()).to.equal(600);

		await expect(
			commonChainGateways.__CommonChainGateways_init(addrs[0], [], token),
		).to.be.revertedWith("Initializable: contract is already initialized");

		await expect(
			commonChainGateways.__CommonChainGateways_init(addrs[0], [image1, image2], token),
		).to.be.revertedWith("Initializable: contract is already initialized");
	});

	it("deploys as proxy and initializes", async function () {
		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		const commonChainGateways = await upgrades.deployProxy(
			CommonChainGateways,
			[addrs[0], [image1], token],
			{
				kind: "uups",
				initializer: "__CommonChainGateways_init",
				constructorArgs: [attestationVerifier.address, 600]
			},
		);

		expect(await commonChainGateways.ATTESTATION_VERIFIER()).to.equal(attestationVerifier.address);
		expect(await commonChainGateways.ATTESTATION_MAX_AGE()).to.equal(600);

		expect(await commonChainGateways.hasRole(await commonChainGateways.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
		expect(await commonChainGateways.getRoleMemberCount(await commonChainGateways.DEFAULT_ADMIN_ROLE())).to.equal(1);
		{
			const { PCR0, PCR1, PCR2 } = await commonChainGateways.getWhitelistedImage(getImageId(image1));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image1);
		}
	});

	it("cannot initialize with zero address as admin", async function () {
		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		await expect(
			upgrades.deployProxy(
				CommonChainGateways,
				[ethers.constants.AddressZero, [image1, image2, image3], token],
				{
					kind: "uups",
					initializer: "__CommonChainGateways_init",
					constructorArgs: [attestationVerifier.address, 600]
				},
			)
		).to.be.revertedWith("ZERO_ADDRESS_ADMIN");
	});

	it("upgrades", async function () {
		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		const commonChainGateways = await upgrades.deployProxy(
			CommonChainGateways,
			[addrs[0], [image1, image2, image3], token],
			{
				kind: "uups",
				initializer: "__CommonChainGateways_init",
				constructorArgs: [addrs[10], 600]
			},
		);
		await upgrades.upgradeProxy(
			commonChainGateways.address,
			CommonChainGateways,
			{
				kind: "uups",
				constructorArgs: [addrs[10], 600]
			}
		);

		expect(await commonChainGateways.ATTESTATION_VERIFIER()).to.equal(addrs[10]);
		expect(await commonChainGateways.ATTESTATION_MAX_AGE()).to.equal(600);

		expect(await commonChainGateways.hasRole(await commonChainGateways.DEFAULT_ADMIN_ROLE(), addrs[0])).to.be.true;
		expect(await commonChainGateways.getRoleMemberCount(await commonChainGateways.DEFAULT_ADMIN_ROLE())).to.equal(1);
		{
			const { PCR0, PCR1, PCR2 } = await commonChainGateways.getWhitelistedImage(getImageId(image1));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image1);
		}
		{
			const { PCR0, PCR1, PCR2 } = await commonChainGateways.getWhitelistedImage(getImageId(image2));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image2);
		}
		{
			const { PCR0, PCR1, PCR2 } = await commonChainGateways.getWhitelistedImage(getImageId(image3));
			expect({ PCR0, PCR1, PCR2 }).to.deep.equal(image3);
		}
	});

	it("does not upgrade without admin", async function () {
		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		const commonChainGateways = await upgrades.deployProxy(
			CommonChainGateways,
			[addrs[0], [image1, image2, image3], token],
			{
				kind: "uups",
				initializer: "__CommonChainGateways_init",
				constructorArgs: [addrs[10], 600]
			},
		);

		await expect(
			upgrades.upgradeProxy(commonChainGateways.address, CommonChainGateways.connect(signers[1]), {
				kind: "uups",
				constructorArgs: [addrs[10], 600],
			}),
		).to.be.revertedWith("only admin");
	});
});

describe("CommonChainGateways - Verify", function () {
	let signers: Signer[];
	let addrs: string[];
	let attestationVerifier: AttestationVerifier;
	let token: string;
	let commonChainGateways: CommonChainGateways;

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

		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		const commonChainGatewaysContract = await upgrades.deployProxy(
			CommonChainGateways,
			[addrs[0], [image2, image3], token],
			{
				kind: "uups",
				initializer: "__CommonChainGateways_init",
				constructorArgs: [attestationVerifier.address, 600]
			},
		);
		commonChainGateways = getCommonChainGateways(commonChainGatewaysContract.address, signers[0]);
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can verify enclave key", async function () {
		const timestamp = await time.latest() * 1000;
		let wallet14 = walletForIndex(14).connect(commonChainGateways.provider);
		let wallet15 = walletForIndex(15).connect(commonChainGateways.provider);
		let attestation = createAttestation(normalize(wallet15.publicKey), image3, wallet14, 2, 4096, timestamp - 540000);

		await expect(commonChainGateways.connect(signers[1]).verifyKey(attestation, normalize(wallet15.publicKey), getImageId(image3), 2, 4096, timestamp - 540000))
			.to.emit(commonChainGateways, "EnclaveKeyVerified").withArgs(normalize(wallet15.publicKey), getImageId(image3));
		expect(await commonChainGateways.getVerifiedKey(addrs[15])).to.equal(getImageId(image3));
	});
});

describe("CommonChainGateways - Global chains", function () {
	let signers: Signer[];
	let addrs: string[];
	let token: Pond;
	let attestationVerifier: AttestationVerifier;
	let commonChainGateways: CommonChainGateways;

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

		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		const commonChainGatewaysContract = await upgrades.deployProxy(
			CommonChainGateways,
			[addrs[0], [image2, image3], token.address],
			{
				kind: "uups",
				initializer: "__CommonChainGateways_init",
				constructorArgs: [attestationVerifier.address, 600]
			},
		);
		commonChainGateways = getCommonChainGateways(commonChainGatewaysContract.address, signers[0]);

	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can add global chain", async function () {
		let chainIds = [1];
		let reqChains = [
			{
				contractAddress: addrs[1],
				rpcUrl: "https://eth.rpc"
			}
		]
		await commonChainGateways.addChainGlobal(chainIds, reqChains);

		let {contractAddress, rpcUrl} = await commonChainGateways.requestChains(1);
		expect({contractAddress, rpcUrl}).to.deep.eq(reqChains[0]);
	});

	it("can remove global chain", async function () {
		let chainIds = [1];
		await commonChainGateways.removeChainGlobal(chainIds);

		let {contractAddress, rpcUrl} = await commonChainGateways.requestChains(1);
		expect(contractAddress).to.be.eq(constants.AddressZero);
		expect(rpcUrl).to.be.eq("");
	});

});

describe("CommonChainGateways - Register gateway", function () {
	let signers: Signer[];
	let addrs: string[];
	let token: Pond;
	let attestationVerifier: AttestationVerifier;
	let commonChainGateways: CommonChainGateways;

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

		const CommonChainGateways = await ethers.getContractFactory("CommonChainGateways");
		const commonChainGatewaysContract = await upgrades.deployProxy(
			CommonChainGateways,
			[addrs[0], [image2, image3], token.address],
			{
				kind: "uups",
				initializer: "__CommonChainGateways_init",
				constructorArgs: [attestationVerifier.address, 600]
			},
		);
		commonChainGateways = getCommonChainGateways(commonChainGatewaysContract.address, signers[0]);

		let chainIds = [1];
		let reqChains = [
			{
				contractAddress: addrs[1],
				rpcUrl: "https://eth.rpc"
			}
		]
		await commonChainGateways.addChainGlobal(chainIds, reqChains);

	});

	takeSnapshotBeforeAndAfterEveryTest(async () => { });

	it("can register gateway", async function () {
		const timestamp = await time.latest() * 1000;
		let wallet14 = walletForIndex(14).connect(commonChainGateways.provider);
		let wallet15 = walletForIndex(15).connect(commonChainGateways.provider);
		let attestation = createAttestation(normalize(wallet15.publicKey), image2, wallet14, 2, 4096, timestamp - 540000);

		let chainIds = [1];
		const message = ethers.utils.solidityPack(
			["uint256[]"],
			[chainIds],
		);
		const digest = ethers.utils.keccak256(message);
		let sign = wallet15._signingKey().signDigest(digest);
		let signature = ethers.utils.joinSignature(sign);

		await expect(commonChainGateways.connect(signers[1]).registerGateway(attestation, normalize(wallet15.publicKey), image2.PCR0, image2.PCR1, image2.PCR2, 2, 4096, timestamp - 540000, [1], signature, 0))
			.to.emit(commonChainGateways, "EnclaveKeyVerified").withArgs(normalize(wallet15.publicKey), getImageId(image2));
		expect(await commonChainGateways.getVerifiedKey(addrs[15])).to.equal(getImageId(image2));

	});

	it('can deregister gateway', async function () {
		const timestamp = await time.latest() * 1000;
		let wallet14 = walletForIndex(14).connect(commonChainGateways.provider);
		let wallet15 = walletForIndex(15).connect(commonChainGateways.provider);
		let attestation = createAttestation(normalize(wallet15.publicKey), image2, wallet14, 2, 4096, timestamp - 540000);

		let chainIds = [1];
		const message = ethers.utils.solidityPack(
			["uint256[]"],
			[chainIds],
		);
		const digest = ethers.utils.keccak256(message);
		let sign = wallet15._signingKey().signDigest(digest);
		let signature = ethers.utils.joinSignature(sign);

		await commonChainGateways.connect(signers[1]).registerGateway(attestation, normalize(wallet15.publicKey), image2.PCR0, image2.PCR1, image2.PCR2, 2, 4096, timestamp - 540000, [1], signature, 0);

		await expect(commonChainGateways.connect(signers[1]).deregisterGateway(normalize(wallet15.publicKey)))
			.to.emit(commonChainGateways, "GatewayDeregistered").withArgs(normalize(wallet15.publicKey));

		expect(await commonChainGateways.getVerifiedKey(addrs[15])).to.equal(constants.HashZero);
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
