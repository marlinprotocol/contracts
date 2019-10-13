crypto = require('./crypto.js')

class ServiceCertificate {
  constructor(authorizationCertificate, nonce, signature=undefined) {
    this.authorizationCertificate = authorizationCertificate;
    this.nonce = nonce;
    this.signature = signature;
  }

  sign(clientPrivateKey) {
    var msg = this.authorizationCertificate.signature.concat([nonce]);
    this.signature = crypto.sign(msg, clientPrivateKey);
    return this.signature;
  }

  verify() {
    var msg = this.authorizationCertificate.signature.concat([nonce]);
    return crypto.verify(msg, this.signature, this.authorizationCertificate.clientAddress) && this.authorizationCertificate.verify();
  }
}
