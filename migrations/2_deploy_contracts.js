const Capacity = artifacts.require("Proxy.sol")


module.exports = function(deployer) {
    deployer.deploy(Capacity, "0x0000000000000000000000000000000000000000");
};
  