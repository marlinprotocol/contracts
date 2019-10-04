const { describe, it } = require('mocha');
const { expect } = require('chai');

const crypto = require('../lib/crypto.js');
const utils = require('./utils.js');

const privateKey = utils.hexStringToArr('360970a734fe426d73f06224de95aca35a88031bd5d7851c7b340ecdb5a94f84');
const address = utils.hexStringToArr('fD82f9A61b3c600B8B83b8ADDBEc35D5C27C4105');
const testMsg = Uint8Array.from('test message');
const testSignature = utils.hexStringToArr('cf029ecf49a1b14f7abb8322dd027298d6521acfdf357ca9f221ad5191fbf5466efbea552ac33cfd90784c2a01cfc8174d48c47c09b6df4c3cb3b67f38d52a7c1c');

// ---------------- Sign ----------------//

describe('crypto', () => {
  describe('sign', () => {
    it('should export a function', () => {
      expect(crypto.sign).to.be.a('function');
    });
  });
});

describe('crypto', () => {
  describe('sign', () => {
    it('should produce correct signature with test data', () => {
      const signature = crypto.sign(testMsg, privateKey);
      expect(signature).to.deep.equal(testSignature);
    });
  });
});

// ---------------- Verify ----------------//

describe('crypto', () => {
  describe('verify', () => {
    it('should export a function', () => {
      expect(crypto.verify).to.be.a('function');
    });
  });
});

describe('crypto', () => {
  describe('verify', () => {
    it('should verify signature with test data', () => {
      const isVerified = crypto.verify(testMsg, testSignature, address);
      expect(isVerified).to.be.true; // eslint-disable-line no-unused-expressions
    });
  });
});
