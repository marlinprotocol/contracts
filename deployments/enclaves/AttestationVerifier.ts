import { ethers, upgrades, run } from 'hardhat';
import { Contract } from 'ethers';
import * as fs from 'fs';
import { AttestationVerifier } from "../../typechain-types";
import { upgrade as upgradeUtil } from '../utils/Upgrade';
const config = require('./config');

export async function deploy(enclaveImages?: AttestationVerifier.EnclaveImageStruct[], enclaveKeys?: string[], noLog?: boolean): Promise<Contract> {
    let chainId = (await ethers.provider.getNetwork()).chainId;

    const chainConfig = config[chainId];

    const AttestationVerifier = await ethers.getContractFactory('AttestationVerifier');

    var addresses: {[key: string]: {[key: string]: string}} = {};
    if(!noLog) {
        console.log("Chain Id:", chainId);

        if(fs.existsSync('address.json')) {
            addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
        }
    
        if(addresses[chainId] === undefined) {
            addresses[chainId] = {};
        }
    
        if(addresses[chainId]['AttestationVerifier'] !== undefined) {
            console.log("Existing deployment:", addresses[chainId]['AttestationVerifier']);
            return AttestationVerifier.attach(addresses[chainId]['AttestationVerifier']);
        }
    }

    if(enclaveImages === undefined) {
        enclaveImages = [];
        for(let i = 0; i < chainConfig.enclaveImages.length; i++) {
            enclaveImages.push(chainConfig.enclaveImages[i].PCR);
        }
    }

    if(enclaveKeys === undefined) {
        enclaveKeys = [];
        for(let i = 0; i < chainConfig.enclaveImages.length; i++) {
            enclaveKeys.push(chainConfig.enclaveImages[i].enclaveKey);
        }
    }

    let attestationVerifier = await upgrades.deployProxy(AttestationVerifier, [enclaveImages, enclaveKeys], { kind: "uups" });

    if(!noLog) {
        console.log("Deployed addr:", attestationVerifier.address);

        addresses[chainId]['AttestationVerifier'] = attestationVerifier.address;

        fs.writeFileSync('address.json', JSON.stringify(addresses, null, 2), 'utf8');
    }

    return attestationVerifier;
}

export async function upgrade() {
    await upgradeUtil('AttestationVerifier', 'AttestationVerifier', []);
}

export async function verify() {
    let chainId = (await ethers.provider.getNetwork()).chainId;
    console.log("Chain Id:", chainId);

    var addresses: {[key: string]: {[key: string]: string}} = {};
    if(fs.existsSync('address.json')) {
        addresses = JSON.parse(fs.readFileSync('address.json', 'utf8'));
    }

    if(addresses[chainId] === undefined || addresses[chainId]['AttestationVerifier'] === undefined) {
        throw new Error("Attestation Verifier not deployed");
    }

    const implAddress = await upgrades.erc1967.getImplementationAddress(addresses[chainId]['AttetationVerifier']);

    await run("verify:verify", {
        address: implAddress,
        constructorArguments: []
    });

    console.log("Attestation Verifier verified");
}