const TestERC20 = artifacts.require("TestERC20.sol");

module.exports = function (deployer, network, accounts) {
    if (network == "development") {
        deployer.deploy(TestERC20, 1000000000).then(function () {
            console.log("Test ERC20 Address: ", TestERC20.address);
        });
    }
};
