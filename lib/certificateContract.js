const fs = require('fs');
const path = require('path');

/**
 * Class wrapping certificate contract.
 *
 * @property {String} address - Contract address
 */
class CertificateContract {
  /**
   * Creates a new certificate contract instance.
   *
   * @param {Object} Web3Contract - Web3 Contract class - usually `web3.eth.Contract`
   * @param {String} [address] - Address of contract, can be set after construction
   */
  constructor(Web3Contract, address = undefined) {
    this.abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, './certificate.abi')));
    this.contract = new Web3Contract(this.abi, address);
  }

  get address() {
    return this.contract.options.address;
  }

  set address(address) {
    this.contract.options.address = address;
  }

  /**
   * Settle payment for winning certificate.
   *
   * @param {String} offerId - Offer Id
   * @param {ClaimCertificate} winningCertificate - Winning claim certificate
   * @returns {Object} Web3 transaction object, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id14
   */
  settleWinningCertificate(offerId, winningCertificate) {
    const { signature: winningSig, serviceCertificate } = winningCertificate;
    const { signature: serviceSig, authorizationCertificate } = serviceCertificate;
    const authSig = authorizationCertificate.signature;

    return this.contract.methods.settleWinningCertificate(
      offerId,
      authorizationCertificate.publisherAddress,
      authorizationCertificate.clientAddress,
      authorizationCertificate.maxNonce,
      serviceCertificate.nonce,
      [
        parseInt(`0x${authSig.slice(130, 132)}`, 16),
        parseInt(`0x${serviceSig.slice(130, 132)}`, 16),
        parseInt(`0x${winningSig.slice(130, 132)}`, 16),
      ],
      [
        `0x${authSig.slice(2, 66)}`,
        `0x${serviceSig.slice(2, 66)}`,
        `0x${winningSig.slice(2, 66)}`,
      ],
      [
        `0x${authSig.slice(66, 130)}`,
        `0x${serviceSig.slice(66, 130)}`,
        `0x${winningSig.slice(66, 130)}`,
      ],
    );
  }
}

module.exports = CertificateContract;
