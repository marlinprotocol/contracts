const Logic = artifacts.require("LGTLogic.sol");
const Proxy = artifacts.require("LGTProxy.sol");

module.exports = function (deployer) {
  deployer
    .deploy(Logic)
    .then(function () {
      return deployer.deploy(Proxy, Logic.address);
    })
    .then(function () {
      console.log("***********************************************");
      console.log(Logic.address, "LGTLogic.address");
      console.log(Proxy.address, "LGTProxy.address");
      console.log("***********************************************");
    });
};
