const crypto = require('./crypto.js');

/**
 * Class representing claim certificates.
 *
 * @property {ServiceCertificate} serviceCertificate - Service certificate
 * @property {Uint8Array} signature - Signature validating certificate, signed by node
 */
class ClaimCertificate {
  /**
   * Creates a claim certificate.
   *
   * @param {ServiceCertificate} serviceCertificate - Service certificate
   * @param {Uint8Array} [signature] - Signature validating certificate, signed by node
   */
  constructor(serviceCertificate, signature = undefined) {
    this.serviceCertificate = serviceCertificate;
    this.signature = signature;
  }

  /**
   * Signs the certificate and sets signature.
   *
   * @param {Uint8Array} nodePrivateKey - Node's private key
   * @returns {Uint8Array} Signature
   */
  sign(nodePrivateKey) {
    this.signature = crypto.sign(this.serviceCertificate.signature, nodePrivateKey);
    return this.signature;
  }

  /**
   * Checks if the certificate wins the micropayment lottery.
   * @returns {boolean} True if certificate is winning
   */
  isWinning() {
    const finalHash = crypto.hash(this.signature);
    // 0x3 ~ last two bits => 25% winning chance
    // eslint-disable-next-line no-bitwise
    return (finalHash[0] & 3) === 0 && this.serviceCertificate.verify();
  }

  /**
   * Submits the certificate to the blockchain.
   */
  submit() {
    crypto.submitWinningCertificate(this);
  }
}

module.exports = ClaimCertificate;
