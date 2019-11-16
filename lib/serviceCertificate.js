const crypto = require('./crypto.js');
const utils = require('./utils.js');

/**
 * Class representing service certificates.
 *
 * @property {AuthorizationCertificate} authorizationCertificate -
 *                                      Authorization certificate for session
 * @property {Uint8} nonce - Nonce corresponding to request
 * @property {Uint8Array} signature - Signature validating certificate, signed by client
 */
class ServiceCertificate {
  /**
   * Creates a service certificate.
   *
   * @param {AuthorizationCertificate} authorizationCertificate -
   *                                      Authorization certificate for session
   * @param {Uint8} nonce - Nonce corresponding to request
   * @param {Uint8Array} [signature] - Signature validating certificate, signed by client
   */
  constructor(authorizationCertificate, nonce, signature = undefined) {
    this.authorizationCertificate = authorizationCertificate;
    this.nonce = nonce;
    this.signature = signature;
  }

  /**
   * Signs the certificate and sets signature.
   *
   * @param {Uint8Array} clientPrivateKey - Client's private key
   * @returns {Uint8Array} Signature
   */
  sign(clientPrivateKey) {
    const msg = utils.concatUint8Arrays(this.authorizationCertificate.signature, [this.nonce]);
    this.signature = crypto.sign(msg, clientPrivateKey);
    return this.signature;
  }

  /**
   * Verifies the signature and nonce.
   * @returns {boolean} True if verification was successful
   */
  verify() {
    const msg = utils.concatUint8Arrays(this.authorizationCertificate.signature, [this.nonce]);
    return this.nonce > 0 && this.nonce <= this.authorizationCertificate.maxNonce && crypto.verify(
      msg,
      this.signature,
      this.authorizationCertificate.clientAddress,
    ) && this.authorizationCertificate.verify();
  }
}

module.exports = ServiceCertificate;
