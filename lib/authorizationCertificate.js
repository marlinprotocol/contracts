crypto = require('./crypto.js')

class AuthorizationCertificate {
  constructor(publisherAddress, clientAddress, maxNonce, signature=undefined) {
    this.publisherAddress = publisherAddress;
    this.clientAddress = clientAddress;
    this.maxNonce = maxNonce;
    this.signature = signature;
  }

  sign(publisherPrivateKey) {
    var msg = this.publisherAddress.concat(this.clientAddress).concat([maxNonce]);
    this.signature = crypto.sign(msg, publisherPrivateKey);
    return this.signature;
  }

  verify() {
    var msg = this.publisherAddress.concat(this.clientAddress).concat([maxNonce]);
    return crypto.verify(msg, this.signature, this.publisherAddress);
  }
}
