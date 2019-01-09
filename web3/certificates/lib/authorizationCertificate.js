const crypto = require('./crypto.js');

/**
 * Class representing authorization certificates.
 *
 * @property {String} publisherAddress - Publisher's address
 * @property {String} clientAddress - Client's address
 * @property {Uint8} maxNonce - Maximum nonce permitted by certificate for the session
 * @property {String} signature - Signature validating certificate, signed by publisher
 */
class AuthorizationCertificate {
  /**
   * Creates an authorization certificate.
   *
   * @param {String} publisherAddress - Publisher's address
   * @param {String} clientAddress - Client's address
   * @param {Uint8} maxNonce - Maximum nonce permitted by the certificate
   * @param {String} [signature] - Signature validating the certificate, signed by publisher
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
   * @param {String} publisherPrivateKey - Publisher's private key
   * @returns {String} Signature
   */
  sign(publisherPrivateKey) {
    const msg = `0x${this.publisherAddress.substr(2)}${this.clientAddress.substr(2)}${this.maxNonce.toString(16)}`;
    this.signature = crypto.sign(msg, publisherPrivateKey);
    return this.signature;
  }

  /**
   * Verifies the signature.
   * @returns {boolean} True if verification was successful
   */
  verify() {
    const msg = `0x${this.publisherAddress.substr(2)}${this.clientAddress.substr(2)}${this.maxNonce.toString(16)}`;
    return crypto.verify(msg, this.signature, this.publisherAddress);
  }
}

module.exports = AuthorizationCertificate;
