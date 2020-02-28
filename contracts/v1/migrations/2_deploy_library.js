const CertificateVerifier = artifacts.require('CertificateVerifier.sol');

module.exports = async function (deployer, network) {
  deployer.deploy(CertificateVerifier)
    .then(() => {
      console.log('Deployed Library');
    });
};
