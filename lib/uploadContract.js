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
   * @returns {Object} Web3 transaction object, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id14
   */
  addPublisherOffer(publisherOffer) {
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
    );
  }

  /**
   * Serve publisher offer.
   *
   * @param {String} offerId - Id of offer to serve
   * @returns {Object} Web3 transaction object, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id14
   */
  servePublisherOffer(offerId) {
    return this.contract.methods.servePublisherOffer(offerId);
  }

  /**
   * Read publisher offer.
   *
   * @param {String} offerId - Id of offer to read
   * @returns {Object} Web3 transaction object, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id14
   */
  readPublisherOffer(offerId) {
    return this.contract.methods.readPublisherOffer(offerId);
  }
}

module.exports = UploadContract;
