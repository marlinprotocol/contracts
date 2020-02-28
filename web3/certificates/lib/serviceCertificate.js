const crypto = require('./crypto.js');

/**
 * Class representing service certificates.
 *
 * @property {AuthorizationCertificate} authorizationCertificate -
 *                                      Authorization certificate for session
 * @property {Uint8} nonce - Nonce corresponding to request
 * @property {String} signature - Signature validating certificate, signed by client
 */
class ServiceCertificate {
  /**
   * Creates a service certificate.
   *
   * @param {AuthorizationCertificate} authorizationCertificate -
   *                                      Authorization certificate for session
   * @param {Uint8} nonce - Nonce corresponding to request
   * @param {String} [signature] - Signature validating certificate, signed by client
   */
  constructor(authorizationCertificate, nonce, signature = undefined) {
    this.authorizationCertificate = authorizationCertificate;
    this.nonce = nonce;
    this.signature = signature;
  }

  /**
   * Signs the certificate and sets signature.
   *
   * @param {String} clientPrivateKey - Client's private key
   * @returns {String} Signature
   */
  sign(clientPrivateKey) {
    const msg = `0x${this.authorizationCertificate.signature.substr(2)}${this.nonce.toString(16)}`;
    this.signature = crypto.sign(msg, clientPrivateKey);
    return this.signature;
  }

  /**
   * Verifies the signature and nonce.
   * @returns {boolean} True if verification was successful
   */
  verify() {
    const msg = `0x${this.authorizationCertificate.signature.substr(2)}${this.nonce.toString(16)}`;
    return this.nonce > 0 && this.nonce <= this.authorizationCertificate.maxNonce && crypto.verify(
      msg,
      this.signature,
      this.authorizationCertificate.clientAddress,
    ) && this.authorizationCertificate.verify();
  }
}

module.exports = ServiceCertificate;
