const fs = require('fs');
const path = require('path');

class CertificateContract {
  constructor(Web3Contract, address = undefined) {
    this.abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, './certificate.abi')));
    this.contract = new Web3Contract(this.abi, address);
  }

  get address() {
    return this.contract.options.address;
  }

  set address(address) {
    this.contract.options.address = address;
  }

  settleWinningCertificate(winningCertificate) {
    const { signature: winningSig, serviceCertificate } = winningCertificate;
    const { signature: serviceSig, authorizationCertificate } = serviceCertificate;
    const authSig = authorizationCertificate.signature;

    return this.contact.settleWinningCertificate(
      winningCertificate.offerId,
      `0x${authorizationCertificate.publisherAddress.toString('hex')}`,
      `0x${authorizationCertificate.clientAddress.toString('hex')}`,
      authorizationCertificate.maxNonce,
      serviceCertificate.nonce,
      [
        authSig[authSig.length - 1],
        serviceSig[serviceSig.length - 1],
        winningSig[winningSig.length - 1],
      ],
      [
        authSig.slice(0, 32),
        serviceSig.slice(0, 32),
        winningSig.slice(0, 32),
      ],
      [
        authSig.slice(32, 64),
        serviceSig.slice(32, 64),
        winningSig.slice(32, 64),
      ],
    );
  }
}

module.exports = CertificateContract;
