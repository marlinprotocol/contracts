const CertificateVerifier = artifacts.require('CertificateVerifier.sol');
const Certificate = artifacts.require('Certificate.sol');
const MockToken = artifacts.require('MockToken.sol');

module.exports = async function (deployer, network) {
  if (network === 'development') {
    deployer.deploy(MockToken)
      .then(() => {
        return deployer.link(CertificateVerifier, Certificate);
      })
      .then(() => {
        return deployer.deploy(Certificate, MockToken.address);
      })
      .then(() => {
        console.log('Deployed Mock Token and Certificate');
      });
  } else {
    deployer.link(CertificateVerifier, Certificate)
      .then(() => {
        return deployer.deploy(Certificate, process.env.MARLIN_TOKEN_ADDRESS);
      })
      .then(() => {
        console.log('Deployed Certificate');
      });
  }
};
