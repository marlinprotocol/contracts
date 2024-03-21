import { ethers, upgrades } from "hardhat";

async function main() {
    //Create Enclave Image object
    const img = {
        PCR0 : ethers.utils.arrayify("0xcfa7554f87ba13620037695d62a381a2d876b74c2e1b435584fe5c02c53393ac1c5cd5a8b6f92e866f9a65af751e0462"),
        PCR1 : ethers.utils.arrayify("0xbcdf05fefccaa8e55bf2c8d6dee9e79bbff31e34bf28a99aa19e6b29c37ee80b214a414b7607236edf26fcb78654e63f"),
        PCR2 : ethers.utils.arrayify("0x20caae8a6a69d9b1aecdf01a0b9c5f3eafd1f06cb51892bf47cef476935bfe77b5b75714b68a69146d650683a217c5b3"),
    };
    // Admin address
    let admin_addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    // Deploy Token Contract
    let token_addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    // Attestation Verifier
    const AttestationVerifier = await ethers.getContractFactory("AttestationVerifier");
    console.log("Deploying AttestationVerifier")
    let attestationverifier = await upgrades.deployProxy(
        AttestationVerifier,
        [
            [img],
            [admin_addr],
            admin_addr
        ],
        {
            kind : "uups"
        });
    let av_addr = attestationverifier.address;
    console.log("AttestationVerifier Deployed address: ", av_addr);

    // Request Chain Relay Contract
    const ServerlessRelay = await ethers.getContractFactory("RequestChainContract");
    console.log("Deploying RequestChainContract...")
    let serverlessrelay = await upgrades.deployProxy(
        ServerlessRelay,
        [
            admin_addr,
            token_addr,
            [img]
        ],
        {
            initializer : "__RequestChainContract_init",
            kind : "uups",
            constructorArgs : [
                av_addr,
                1000
            ]
        });
    let svls_addr = serverlessrelay.address;
    console.log("ServerlessRelay Deployed address: ", svls_addr);

    // Common Chain Contract
    const CommonChainContract = await ethers.getContractFactory("CommonChainContract");
    console.log("Deploying CommonChainContract...")
    let jobManagement = await upgrades.deployProxy(
        CommonChainContract,
        [
            admin_addr,
            [img],
            token_addr,
            1,
            10
        ],
        {
            initializer : "__CommonChainContract_init",
            kind : "uups",
            constructorArgs : [
                av_addr,
                1000
            ]
        });
    let job_mgmt_addr = jobManagement.address;
    console.log("CommonChainContract Deployed address: ", job_mgmt_addr);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
