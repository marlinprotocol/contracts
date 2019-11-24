const ethWallet = require('ethereumjs-wallet');
const fs = require('fs');

function Uint8ArrayFromBuffer(buffer) {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
}

/**
 * Class representing an account.
 *
 * @property {Uint8Array} privateKey - Private key of account
 * @property {Uint8Array} publicKey - Public key of account
 * @property {Uint8Array} address - Address of account
 */
class Account {
  /**
   * Creates a new account.
   *
   * @returns {Account} New account
   */
  static create() {
    const account = Account();
    account.wallet = ethWallet.generate();
    account.privateKey = Uint8ArrayFromBuffer(account.wallet.getPrivateKey());
    account.publicKey = Uint8ArrayFromBuffer(account.wallet.getPublicKey());
    account.address = Uint8ArrayFromBuffer(account.wallet.getAddress());

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
    account.privateKey = Uint8ArrayFromBuffer(account.wallet.getPrivateKey());
    account.publicKey = Uint8ArrayFromBuffer(account.wallet.getPublicKey());
    account.address = Uint8ArrayFromBuffer(account.wallet.getAddress());

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
