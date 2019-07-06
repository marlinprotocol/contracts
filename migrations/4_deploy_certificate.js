const CertificateVerifier = artifacts.require('CertificateVerifier.sol');
const Certificate = artifacts.require('Certificate.sol');
const Upload = artifacts.require('Upload.sol');
const MockToken = artifacts.require('MockToken.sol');

module.exports = async function (deployer, network) {
  if (network === 'development') {
    deployer.link(CertificateVerifier, Certificate)
      .then(() => {
        return deployer.deploy(Certificate, MockToken.address, Upload.address);
      })
      .then(() => {
        console.log('Linked CertificateVerifier and deployed Certificate contract');
      });
  } else {
    deployer.link(CertificateVerifier, Certificate)
      .then(() => {
        return deployer.deploy(Certificate, process.env.MARLIN_TOKEN_ADDRESS, Upload.address);
      })
      .then(() => {
        console.log('Deployed Certificate contract');
      });
  }
};
