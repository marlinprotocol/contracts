// Use ethers ^6.9.0 to run this
// Not a proper test, deploy and run few commands, verification is done manually
// use this command: '$ npx hardhat run ServerlessRelay.ts'

import { ethers, upgrades } from "hardhat";

async function main() {
    // Enclave Verifier Contract
    const enclave_verifier = await ethers.deployContract("EnclaveVerifier",
        [
            ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]
        ]);
    await enclave_verifier.waitForDeployment();
    let ev_addr = await enclave_verifier.getAddress();
    console.log("Enclave Verifier Deployed Address: ", ev_addr);

    // Serverless Contract
    const ServerlessRelay = await ethers.getContractFactory("ServerlessRelay");
    console.log("Deploying ServerlessRelay...")
    let serverlessrelay = await upgrades.deployProxy(
        ServerlessRelay,
        [
            "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            ev_addr
        ],
        {
            kind : "uups"
        });
    await serverlessrelay.waitForDeployment();
    let svls_addr = await serverlessrelay.getAddress();
    console.log("ServerlessRelay Deployed address: ", svls_addr);
    await serverlessrelay.registerProvider("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    await serverlessrelay.activateProvider();
    
    // User Contract
    const user = await ethers.deployContract("User", [svls_addr]);
    await user.waitForDeployment();
    console.log("User Deployed Address: ", await user.getAddress());
    // Prepare json data
    const json_str = '{\"num\": 4}';
    // let json_struct = JSON.parse(json_str);
    const jsonDataBytes = ethers.toUtf8Bytes(json_str);
    // const jsonDataBytes = ethers.AbiCoder.defaultAbiCoder().encode(['string'], [json_str]);
    await user.setJob(jsonDataBytes, {value: ethers.parseUnits("2", "ether")});
    await user.setJob(jsonDataBytes, {value: ethers.parseUnits("2", "ether")});

    // Finish Job
    let tx_hash = "0xc7d9122f583971d4801747ab24cf3e83984274b8d565349ed53a73e0a547d113";
    let req_hash = ethers.dataSlice(ethers.keccak256(ethers.concat([tx_hash, jsonDataBytes])), 0, 4);
    let abi_encoder = ethers.AbiCoder.defaultAbiCoder();
    let data = abi_encoder.encode(["bytes4", "bool", "bytes", "uint", "uint"], [req_hash, true, "0x02", 10, 0]);
    console.log("Encoded bytes data: ", data);
    
    // let ret = ethers.toUtf8Bytes("Hello");
    let hashed_bytes = ethers.keccak256(data);
    let sign1 = new ethers.SigningKey("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    let sign = sign1.sign(hashed_bytes).serialized;
    await serverlessrelay.jobFinish(0, data, sign);

    console.log(await user.queryFilter("CalledBack"));
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
