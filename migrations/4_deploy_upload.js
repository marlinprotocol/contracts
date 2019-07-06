const Upload = artifacts.require('Upload.sol');
const Certificate = artifacts.require('Certificate.sol');

module.exports = async function (deployer, network) {
  deployer.deploy(Upload, Certificate.address)
    .then(() => {
      console.log('Deployed Upload');
    });
};
