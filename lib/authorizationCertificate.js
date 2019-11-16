const crypto = require('./crypto.js');
const utils = require('./utils.js');

/**
 * Class representing authorization certificates.
 *
 * @property {Uint8Array} publisherAddress - Publisher's address
 * @property {Uint8Array} clientAddress - Client's address
 * @property {Uint8} maxNonce - Maximum nonce permitted by certificate for the session
 * @property {Uint8Array} signature - Signature validating certificate, signed by publisher
 */
class AuthorizationCertificate {
  /**
   * Creates an authorization certificate.
   *
   * @param {Uint8Array} publisherAddress - Publisher's address
   * @param {Uint8Array} clientAddress - Client's address
   * @param {Uint8} maxNonce - Maximum nonce permitted by the certificate
   * @param {Uint8Array} [signature] - Signature validating the certificate, signed by publisher
   */
  constructor(publisherAddress, clientAddress, maxNonce, signature = undefined) {
    this.publisherAddress = publisherAddress;
    this.clientAddress = clientAddress;
    this.maxNonce = maxNonce;
    this.signature = signature;
  }

  /**
   * Signs the certificate and sets signature.
   *
   * @param {Uint8Array} publisherPrivateKey - Publisher's private key
   * @returns {Uint8Array} Signature
   */
  sign(publisherPrivateKey) {
    const msg = utils.concatUint8Arrays(this.publisherAddress, this.clientAddress, [this.maxNonce]);
    this.signature = crypto.sign(msg, publisherPrivateKey);
    return this.signature;
  }

  /**
   * Verifies the signature.
   * @returns {boolean} True if verification was successful
   */
  verify() {
    const msg = utils.concatUint8Arrays(this.publisherAddress, this.clientAddress, [this.maxNonce]);
    return crypto.verify(msg, this.signature, this.publisherAddress);
  }
}

module.exports = AuthorizationCertificate;
