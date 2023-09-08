import { expect } from "chai";
import { Signer } from "ethers";
import { ethers, upgrades } from "hardhat";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { defaultAbiCoder, keccak256, parseUnits, solidityPack } from "ethers/lib/utils";

const image1 = {
    PCR0: parseUnits("1", 115).toHexString(),
    PCR1: parseUnits("2", 114).toHexString(),
    PCR2: parseUnits("3", 114).toHexString(),
};

const image2 = {
    PCR0: parseUnits("4", 114).toHexString(),
    PCR1: parseUnits("5", 114).toHexString(),
    PCR2: parseUnits("6", 114).toHexString(),
};

describe("Attestation Verifier", function() {
    let signers: Signer[];
	let addrs: string[];

	before(async function() {
		signers = await ethers.getSigners();
		addrs = await Promise.all(signers.map((a) => a.getAddress()));
	});

	takeSnapshotBeforeAndAfterEveryTest(async () => {});

    it("deploys with initialization disabled", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await AttestationVerifier.deploy();

        await expect(
            attestationVerifier.initialize([], []),
        ).to.be.revertedWith("Initializable: contract is already initialized");

        await expect(
            attestationVerifier.initialize([image1], [addrs[0]]),
        ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("deploys as proxy and initializes", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        console.log(parseUnits("1", 114).toHexString())
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [[image1], [addrs[0]]],
            { kind: "uups" },
        );

        const imageId = await attestationVerifier.isVerified(addrs[0]);

        expect(imageId).to.equal(keccak256(solidityPack(["bytes", "bytes", "bytes"], [image1.PCR0, image1.PCR1, image1.PCR2])));
        let {PCR0, PCR1, PCR2} = await attestationVerifier.whitelistedImages(imageId);
        expect({PCR0, PCR1, PCR2}).to.deep.equal(image1);
    });

    it("deploys as proxy and initialize with multiple images", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        const attestationVerifier = await upgrades.deployProxy(
            AttestationVerifier,
            [[image1, image2], [addrs[0], addrs[1]]],
            { kind: "uups" },
        );

        let imageId0 = await attestationVerifier.isVerified(addrs[0]);
        expect(imageId0).to.equal(keccak256(solidityPack(["bytes", "bytes", "bytes"], [image1.PCR0, image1.PCR1, image1.PCR2])));
        let {PCR0: PCR00, PCR1: PCR01, PCR2: PCR02} = await attestationVerifier.whitelistedImages(imageId0);
        expect({PCR00, PCR01, PCR02}).to.deep.equal(image1);

        let imageId1 = await attestationVerifier.isVerified(addrs[1]);
        let {PCR0: PCR10, PCR1: PCR11, PCR2: PCR12} = await attestationVerifier.whitelistedImages(imageId1);
        expect(imageId1).to.equal(keccak256(solidityPack(["bytes", "bytes", "bytes"], [image2.PCR0, image2.PCR1, image2.PCR2])));
        expect({PCR0: PCR10, PCR1: PCR11, PCR2: PCR12}).to.deep.equal(image2);
    });

    it("does not initialize with mismatched lengths", async function() {
        const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
        await expect(
            upgrades.deployProxy(
                AttestationVerifier,
                [[image1], [addrs[0], addrs[1]]],
                { kind: "uups" },
            )
        ).to.be.revertedWith("AV:I-Image and key length mismatch");
    });

    it("upgrades", async function() {
        
    });
});

// describe("MarketV1", function() {

// 	it("upgrades", async function() {
// 		const MarketV1 = await ethers.getContractFactory("MarketV1");
// 		const marketv1 = await upgrades.deployProxy(
// 			MarketV1,
// 			[addrs[11], SELECTORS, WAIT_TIMES],
// 			{ kind: "uups" },
// 		);
// 		await upgrades.upgradeProxy(marketv1.address, MarketV1, { kind: "uups" });

// 		await Promise.all(
// 			SELECTORS.map(async (s, idx) => {
// 				expect(await marketv1.lockWaitTime(s)).to.equal(WAIT_TIMES[idx]);
// 			}),
// 		);
// 		expect(
// 			await marketv1.hasRole(await marketv1.DEFAULT_ADMIN_ROLE(), addrs[0]),
// 		).to.be.true;
// 		expect(await marketv1.token()).to.equal(addrs[11]);
// 	});

// 	it("does not upgrade without admin", async function() {
// 		const MarketV1 = await ethers.getContractFactory("MarketV1");
// 		const marketv1 = await upgrades.deployProxy(
// 			MarketV1,
// 			[addrs[11], SELECTORS, WAIT_TIMES],
// 			{ kind: "uups" },
// 		);

// 		await expect(
// 			upgrades.upgradeProxy(marketv1.address, MarketV1.connect(signers[1]), {
// 				kind: "uups",
// 			}),
// 		).to.be.revertedWith("only admin");
// 	});
// });

// testERC165(
// 	"MarketV1",
// 	async function(_signers: Signer[], addrs: string[]) {
// 		const MarketV1 = await ethers.getContractFactory("MarketV1");
// 		const marketv1 = await upgrades.deployProxy(
// 			MarketV1,
// 			[addrs[11], SELECTORS, WAIT_TIMES],
// 			{ kind: "uups" },
// 		);
// 		return marketv1;
// 	},
// 	{
// 		IAccessControl: [
// 			"hasRole(bytes32,address)",
// 			"getRoleAdmin(bytes32)",
// 			"grantRole(bytes32,address)",
// 			"revokeRole(bytes32,address)",
// 			"renounceRole(bytes32,address)",
// 		],
// 		IAccessControlEnumerable: [
// 			"getRoleMember(bytes32,uint256)",
// 			"getRoleMemberCount(bytes32)",
// 		],
// 	},
// );

// testAdminRole("MarketV1", async function(_signers: Signer[], addrs: string[]) {
// 	const MarketV1 = await ethers.getContractFactory("MarketV1");
// 	const marketv1 = await upgrades.deployProxy(
// 		MarketV1,
// 		[addrs[11], SELECTORS, WAIT_TIMES],
// 		{ kind: "uups" },
// 	);
// 	return marketv1;
// });