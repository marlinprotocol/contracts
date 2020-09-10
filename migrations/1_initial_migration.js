const Migrations = artifacts.require("Migrations");

module.exports = function (deployer, network, accounts) {
  if (network == "development") {
    deployer.deploy(Migrations);
  }
};
