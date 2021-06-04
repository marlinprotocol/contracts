const fs = require("fs");

const TokenLogicCompiled = require("../../../../build/contracts/TokenLogic.json");
const TokenProxyCompiled = require("../../../../build/contracts/TokenProxy.json");

const MPONDToken = require("../../../../build/contracts/MPondLogic.json");
const MPONDProxy = require("../../../../build/contracts/MPondProxy.json");

const utils = require("../utils");

const config = require("../config/config.json");
const deployedAddressesPath = "./config/deployedAddresses.json";

const deployPond  = async (web3, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    if(deployedAddresses[network].pond != "") {
        return (new web3.eth.Contract(TokenLogicCompiled.abi, deployedAddresses[network].pond));
    }
    const PONDInstance = await utils.contract.deployWithProxyAndAdmin(
        web3,
        TokenLogicCompiled.abi, 
        TokenLogicCompiled.bytecode, 
        TokenProxyCompiled.abi, 
        TokenProxyCompiled.bytecode, 
        config[network].tokens.pond.proxyAdmin,
        {
            from: config[network].tokens.pond.deployer,
            gas: 5000000
        }
    );
    await utils.common.updateEntry(deployedAddressesPath, network, "pond", PONDInstance.options.address);
    return PONDInstance;
}

const initPond  = async (PONDInstance, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    await PONDInstance.methods.initialize(
        config[network].tokens.pond.name,
        config[network].tokens.pond.symbol,
        config[network].tokens.pond.decimals,
        deployedAddresses[network].bridge
    ).send({
        from: config[network].tokens.pond.holder,
        gas: 400000
    });
}

const deployMpond = async (web3, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    if(deployedAddresses[network].mpond != "") {
        return (new web3.eth.Contract(MPONDToken.abi, deployedAddresses[network].mpond));
    }
    const MPONDInstance = await utils.contract.deployWithProxyAndAdmin(
        web3, 
        MPONDToken.abi, 
        MPONDToken.bytecode, 
        MPONDProxy.abi, 
        MPONDProxy.bytecode, 
        config[network].tokens.mpond.proxyAdmin,
        {
            from: config[network].tokens.mpond.deployer,
            gas: 5000000
        }
    );
    await utils.common.updateEntry(deployedAddressesPath, network, "mpond", MPONDInstance.options.address);
    console.log(`MPOND token deployed at ${MPONDInstance.options.address}`)
    return MPONDInstance;
}

const initMpond = async (MPONDInstance, network) => {
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath));
    await MPONDInstance.methods.initialize(
        config[network].tokens.mpond.holder,
        deployedAddresses[network].bridge,
        config[network].tokens.mpond.maticBridge
    ).send({
        from: config[network].tokens.mpond.admin,
        gas: 4000000
    });
    console.log(`MPOND token initialized`);
}

module.exports = {
    deploy: {
        pond: deployPond,
        mpond: deployMpond
    },
    init: {
        pond: initPond,
        mpond: initMpond
    }
}