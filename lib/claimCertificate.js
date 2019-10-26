const crypto = require('./crypto.js');

class ClaimCertificate {
  constructor(serviceCertificate, signature = undefined) {
    this.serviceCertificate = serviceCertificate;
    this.signature = signature;
  }

  sign(nodePrivateKey) {
    this.signature = crypto.sign(this.serviceCertificate.signature, nodePrivateKey);
    return this.signature;
  }

  isWinning() {
    // 0x3 ~ last two bits => 25% winning chance
    // eslint-disable-next-line no-bitwise
    return this.signature[0] & 0x3 === 0 && this.serviceCertificate.verify();
  }

  // submit() {
  //   // Submit to smart contract
  // }
}

module.exports = ClaimCertificate;
