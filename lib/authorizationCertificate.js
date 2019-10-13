var crypto = require('./crypto.js');
var utils = require('./utils.js');

class AuthorizationCertificate {
  constructor(publisherAddress, clientAddress, maxNonce, signature=undefined) {
    this.publisherAddress = publisherAddress;
    this.clientAddress = clientAddress;
    this.maxNonce = maxNonce;
    this.signature = signature;
  }

  sign(publisherPrivateKey) {
    var msg = utils.concatUint8Arrays(this.publisherAddress, this.clientAddress, [maxNonce]);
    this.signature = crypto.sign(msg, publisherPrivateKey);
    return this.signature;
  }

  verify() {
    var msg = utils.concatUint8Arrays(this.publisherAddress, this.clientAddress, [maxNonce]);
    return crypto.verify(msg, this.signature, this.publisherAddress);
  }
}
