const Web3 = require("web3");
const LINProxy = artifacts.require("TokenProxy.sol");
const Pot = artifacts.require("Pot.sol");

const web3 = new Web3("http://127.0.0.1:8545/");

module.exports = async function (deployer, network, accounts) {
    let admin = accounts[1];
    let governanceProxy = accounts[6];
    let firstEpochStartBlock;
    let EthBlocksPerEpoch = 4;
    await web3.eth.getBlockNumber((err, blockNo) => {
        firstEpochStartBlock = blockNo + 10;
    });

    await deployer.deploy(Pot, governanceProxy, LINProxy.address, firstEpochStartBlock, EthBlocksPerEpoch, ["0x0", "0x1"], [30, 70]);
}