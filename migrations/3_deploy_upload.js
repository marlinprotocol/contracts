const Upload = artifacts.require('Upload.sol');
const MockToken = artifacts.require('MockToken.sol');

module.exports = async function (deployer, network) {
  if (network === 'development') {
     deployer.deploy(MockToken)
       .then(() => {
         return deployer.deploy(Upload, MockToken.address);
       })
       .then(() => {
         console.log('Deployed MockToken contract and Upload contract');
       });
   } else {
     deployer.deploy(Upload, process.env.MARLIN_TOKEN_ADDRESS)
       .then(() => {
         console.log('Deployed Upload contract');
       });
   }
};
