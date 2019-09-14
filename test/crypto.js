var chai = require('chai');
var expect = chai.expect;

var crypto = require('../lib/crypto.js');
var utils = require('./utils.js');

var privateKey = utils.hexStringToArr('360970a734fe426d73f06224de95aca35a88031bd5d7851c7b340ecdb5a94f84');
var publicKey = utils.hexStringToArr('f1cb00a966c77dcc6d2c59c8f5181a4a68ed374e8b0412b08e1ee7a81059b7e34e419719eff5c26095a6c34afd936368ae2af7a5e85fcefd1201e2a72497ca48');
var testMsg = Uint8Array.from('test message');
var testSignature = utils.hexStringToArr('cf029ecf49a1b14f7abb8322dd027298d6521acfdf357ca9f221ad5191fbf5466efbea552ac33cfd90784c2a01cfc8174d48c47c09b6df4c3cb3b67f38d52a7c1c');

//---------------- Sign ----------------//

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
      var signature = crypto.sign(testMsg, privateKey);
      expect(signature).to.deep.equal(testSignature);
    });
  });
});

//---------------- Verify ----------------//

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
      var isVerified = crypto.verify(testMsg, testSignature, publicKey);
      expect(isVerified).to.be.true;
    });
  });
});
