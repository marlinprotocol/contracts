const ethUtil = require('ethereumjs-util');
const { describe, it } = require('mocha');
const { expect } = require('chai');

const Account = require('../lib/account.js');

const testPrivateKey =
  ethUtil.toBuffer('0x45faf455e1d575fca98b74fd1048c009b271dfd5186de7ca4dbe1873f8fd4696');
const testPublicKey = ethUtil.toBuffer('0x1bc990fd5637008b057c2ea64368636698aaefaa60cf9828d7349ddd30be1538ba1c2e0bf08ead588e7122f53bc5fb11ae88f482aa52c4759139377a0f38023c');
const testAddress = ethUtil.toBuffer('0x3155E21bD8E7C053672bc7144B0d197780a888C7');

// ---------------- New account ---------------- //

describe('account', () => {
  describe('new', () => {
    const newAccount = Account.create();
    it('should contain valid private key', () => {
      const isValid = ethUtil.isValidPrivate(newAccount.privateKey);
      expect(isValid).to.be.true; // eslint-disable-line no-unused-expressions
    });
    it('should contain valid public key', () => {
      const isValid = ethUtil.isValidPublic(newAccount.publicKey);
      expect(isValid).to.be.true; // eslint-disable-line no-unused-expressions
    });
    it('should contain valid address', () => {
      const isValid = ethUtil.isValidAddress(ethUtil.bufferToHex(newAccount.address));
      expect(isValid).to.be.true; // eslint-disable-line no-unused-expressions
    });
    it('should have correct public key corresponding to private key', () => {
      const publicKey = ethUtil.privateToPublic(newAccount.privateKey);
      expect(publicKey).to.deep.equal(newAccount.publicKey);
    });
    it('should have correct address corresponding to public key', () => {
      const address = ethUtil.publicToAddress(newAccount.publicKey);
      expect(address).to.deep.equal(newAccount.address);
    });
  });
});

// ---------------- Existing account from private key ---------------- //

describe('account', () => {
  describe('from private key', () => {
    const newAccount = Account.fromPrivateKey(testPrivateKey);
    it('should contain valid private key', () => {
      const isValid = ethUtil.isValidPrivate(newAccount.privateKey);
      expect(isValid).to.be.true; // eslint-disable-line no-unused-expressions
    });
    it('should contain valid public key', () => {
      const isValid = ethUtil.isValidPublic(newAccount.publicKey);
      expect(isValid).to.be.true; // eslint-disable-line no-unused-expressions
    });
    it('should contain valid address', () => {
      const isValid = ethUtil.isValidAddress(ethUtil.bufferToHex(newAccount.address));
      expect(isValid).to.be.true; // eslint-disable-line no-unused-expressions
    });
    it('should have correct public key corresponding to private key', () => {
      const publicKey = ethUtil.privateToPublic(newAccount.privateKey);
      expect(publicKey).to.deep.equal(newAccount.publicKey);
    });
    it('should have correct address corresponding to public key', () => {
      const address = ethUtil.publicToAddress(newAccount.publicKey);
      expect(address).to.deep.equal(newAccount.address);
    });
    it('should have correct private key', () => {
      expect(newAccount.privateKey).to.deep.equal(testPrivateKey);
    });
    it('should have correct public key', () => {
      expect(newAccount.publicKey).to.deep.equal(testPublicKey);
    });
    it('should have correct address', () => {
      expect(newAccount.address).to.deep.equal(testAddress);
    });
  });
});
