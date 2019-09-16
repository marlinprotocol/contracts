const fs = require('fs');
const path = require('path');


/**
 * Class wrapping upload contract.
 *
 * @property {String} address - Contract address
 */
class UploadContract {
  /**
   * Creates a new upload contract instance.
   *
   * @param {Object} Web3Contract - Web3 Contract class - usually `web3.eth.Contract`
   * @param {String} [address] - Address of contract, can be set after construction
   */
  constructor(Web3Contract, address = undefined) {
    this.abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, './upload.abi')));
    this.contract = new Web3Contract(this.abi, address);
  }

  get address() {
    return this.contract.options.address;
  }

  set address(address) {
    this.contract.options.address = address;
  }

  /**
   * Create and add new publisher offer.
   *
   * @param {PublisherOffer} publisherOffer - Publisher offer to add
   * @param {Object} options - Transaction options
   * @returns {PromiEvent} PromiEvent, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id22
   */
  addPublisherOffer(publisherOffer, options) {
    return this.contract.methods.addPublisherOffer(
      publisherOffer.namespace,
      publisherOffer.archiveUrl,
      publisherOffer.storageReward,
      publisherOffer.deliveryReward,
      publisherOffer.duration,
      publisherOffer.expiry,
      publisherOffer.replication,
      publisherOffer.requiredStake,
      publisherOffer.geoHash,
      publisherOffer.archiveSize,
      publisherOffer.archiveHash,
    ).send(options);
  }

  /**
   * Serve publisher offer.
   *
   * @param {String} offerId - Id of offer to serve
   * @param {Object} options - Transaction options
   * @returns {PromiEvent} PromiEvent, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id22
   */
  servePublisherOffer(offerId, options) {
    return this.contract.methods.servePublisherOffer(offerId).send(options);
  }

  /**
   * Read publisher offer.
   *
   * @param {String} offerId - Id of offer to read
   * @param {Object} options - Transaction options
   * @returns {PromiEvent} PromiEvent, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id22
   */
  readPublisherOffer(offerId, options) {
    return this.contract.methods.readPublisherOffer(offerId).call(options);
  }
}

module.exports = UploadContract;
