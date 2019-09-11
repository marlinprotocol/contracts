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
      `0x${authorizationCertificate.publisherAddress.toString('hex')}`,
      `0x${authorizationCertificate.clientAddress.toString('hex')}`,
      authorizationCertificate.maxNonce,
      serviceCertificate.nonce,
      [
        authSig[authSig.length - 1],
        serviceSig[serviceSig.length - 1],
        winningSig[winningSig.length - 1],
      ],
      [
        authSig.slice(0, 32),
        serviceSig.slice(0, 32),
        winningSig.slice(0, 32),
      ],
      [
        authSig.slice(32, 64),
        serviceSig.slice(32, 64),
        winningSig.slice(32, 64),
      ],
    );
  }
}

module.exports = CertificateContract;
