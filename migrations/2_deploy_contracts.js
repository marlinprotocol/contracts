const ProxyC = artifacts.require("Proxy.sol")
const Logic = artifacts.require("Logic.sol")

var logicContractAddress;

module.exports = function(deployer) {
    deployer.deploy(Logic).then(function(){
        logicContractAddress = Logic.address
        return deployer.deploy(ProxyC, logicContractAddress);
      })
    
};
  