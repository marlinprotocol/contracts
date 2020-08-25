const LuckManager = artifacts.require("LuckManager.sol");
const Pot = artifacts.require("Pot.sol");

module.exports = async function (deployer, network, accounts) {
    let governanceProxy = accounts[6];

    deployer.deploy(LuckManager, governanceProxy, Pot.address, ["0x0", "0x1"], [[5, 4, 5, 0, 20, 20], [5, 4, 5, 0, 20, 20]]);
}
