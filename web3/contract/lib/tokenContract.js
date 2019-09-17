const fs = require('fs');
const path = require('path');

/**
 * Class wrapping token contract.
 *
 * @property {String} address - Contract address
 */
class TokenContract {
  /**
   * Creates a new token contract instance.
   *
   * @param {Object} Web3Contract - Web3 Contract class - usually `web3.eth.Contract`
   * @param {String} [address] - Address of contract, can be set after construction
   */
  constructor(Web3Contract, address = undefined) {
    this.abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, './token.abi')));
    this.contract = new Web3Contract(this.abi, address);
  }

  get address() {
    return this.contract.options.address;
  }

  set address(address) {
    this.contract.options.address = address;
  }

  /**
   * Get balance of given address.
   *
   * @param {String} address - Address to get balance of
   * @param {Object} options - Transaction options
   * @returns {Promise} Returns balance, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id17
   */
  balanceOf(address, options) {
    return this.contract.methods.balanceOf(address).call(options);
  }

  /**
   * Transfer token to address.
   *
   * @param {String} to - To address
   * @param {Uint256} amount - Transfer amount
   * @param {Object} options - Transaction options
   * @returns {PromiEvent} PromiEvent, ref: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id22
   */
  transfer(to, amount, options) {
    return this.contract.methods.transfer(to, amount).send(options);
  }
}

module.exports = TokenContract;
