const crypto = require('./crypto.js');
const utils = require('./utils.js');

class ServiceCertificate {
  constructor(authorizationCertificate, nonce, signature = undefined) {
    this.authorizationCertificate = authorizationCertificate;
    this.nonce = nonce;
    this.signature = signature;
  }

  sign(clientPrivateKey) {
    const msg = utils.concatUint8Arrays(this.authorizationCertificate.signature, [this.nonce]);
    this.signature = crypto.sign(msg, clientPrivateKey);
    return this.signature;
  }

  verify() {
    const msg = utils.concatUint8Arrays(this.authorizationCertificate.signature, [this.nonce]);
    return crypto.verify(
      msg,
      this.signature,
      this.authorizationCertificate.clientAddress,
    ) && this.authorizationCertificate.verify();
  }
}

module.exports = ServiceCertificate;
