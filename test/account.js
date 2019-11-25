const ethUtil = require('ethereumjs-util');
const { describe, it } = require('mocha');
const { expect } = require('chai');

const Account = require('../lib/account.js');

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
