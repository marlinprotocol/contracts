const crypto = require('./crypto.js');

/**
 * Class representing authorization certificates.
 *
 * @property {Buffer} publisherAddress - Publisher's address
 * @property {Buffer} clientAddress - Client's address
 * @property {Uint8} maxNonce - Maximum nonce permitted by certificate for the session
 * @property {Buffer} signature - Signature validating certificate, signed by publisher
 */
class AuthorizationCertificate {
  /**
   * Creates an authorization certificate.
   *
   * @param {Buffer} publisherAddress - Publisher's address
   * @param {Buffer} clientAddress - Client's address
   * @param {Uint8} maxNonce - Maximum nonce permitted by the certificate
   * @param {Buffer} [signature] - Signature validating the certificate, signed by publisher
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
   * @param {Buffer} publisherPrivateKey - Publisher's private key
   * @returns {Buffer} Signature
   */
  sign(publisherPrivateKey) {
    const msg = Buffer.concat([
      this.publisherAddress,
      this.clientAddress,
      Buffer.from([this.maxNonce]),
    ]);
    this.signature = crypto.sign(msg, publisherPrivateKey);
    return this.signature;
  }

  /**
   * Verifies the signature.
   * @returns {boolean} True if verification was successful
   */
  verify() {
    const msg = Buffer.concat([
      this.publisherAddress,
      this.clientAddress,
      Buffer.from([this.maxNonce]),
    ]);
    return crypto.verify(msg, this.signature, this.publisherAddress);
  }
}

module.exports = AuthorizationCertificate;
