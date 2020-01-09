const crypto = require('./crypto.js');

/**
 * Class representing claim certificates.
 *
 * @property {ServiceCertificate} serviceCertificate - Service certificate
 * @property {Buffer} signature - Signature validating certificate, signed by node
 */
class ClaimCertificate {
  /**
   * Creates a claim certificate.
   *
   * @param {ServiceCertificate} serviceCertificate - Service certificate
   * @param {Buffer} [signature] - Signature validating certificate, signed by node
   */
  constructor(serviceCertificate, signature = undefined) {
    this.serviceCertificate = serviceCertificate;
    this.signature = signature;
  }

  /**
   * Signs the certificate and sets signature.
   *
   * @param {Buffer} nodePrivateKey - Node's private key
   * @returns {Buffer} Signature
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
    return (finalHash[0] & 0x3) === 0 && this.serviceCertificate.verify();
  }
}

module.exports = ClaimCertificate;
