const ethWallet = require('ethereumjs-wallet');
const fs = require('fs');

/**
 * Class representing an account.
 *
 * @property {Buffer} privateKey - Private key of account
 * @property {Buffer} publicKey - Public key of account
 * @property {Buffer} address - Address of account
 */
class Account {
  /**
   * Creates a new account.
   *
   * @returns {Account} New account
   */
  static create() {
    const account = new Account();
    account.wallet = ethWallet.generate();
    account.privateKey = account.wallet.getPrivateKey();
    account.publicKey = account.wallet.getPublicKey();
    account.address = account.wallet.getAddress();

    return account;
  }

  /**
   * Initializes account from private key.
   *
   * @param {Buffer} privateKey - Private key
   * @returns {Account} Account derived from private key
   */
  static fromPrivateKey(privateKey) {
    const account = Account();
    account.wallet = ethWallet.fromPrivateKey(privateKey);
    account.privateKey = account.wallet.getPrivateKey();
    account.publicKey = account.wallet.getPublicKey();
    account.address = account.wallet.getAddress();

    return account;
  }

  /**
   * Initializes account from file.
   *
   * @param {String} filePath - Path to keystore file
   * @param {String} password - Encryption password
   * @returns {Account} Account initialized with data from file
   */
  static fromFile(filePath, password) {
    const data = fs.readFileSync(filePath);
    const account = Account();
    account.wallet = ethWallet.fromV3(data, password, false);
    account.privateKey = account.wallet.getPrivateKey();
    account.publicKey = account.wallet.getPublicKey();
    account.address = account.wallet.getAddress();

    return account;
  }

  /**
   * Encrypts and writes account to file.
   *
   * @param {String} filePath - Path where keystore file should be stored
   * @param {String} password - Encryption password
   */
  toFile(filePath, password) {
    fs.writeFileSync(
      filePath,
      this.wallet.toV3(password),
    );
  }
}

module.exports = Account;
