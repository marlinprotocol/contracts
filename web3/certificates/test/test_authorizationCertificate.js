const { describe, it } = require('mocha');
const { expect } = require('chai');

const AuthorizationCertificate = require('../lib/authorizationCertificate.js');

const creds = require('./credentials.js');

const validAuthCert = {
  publisherAddress: creds.publisherAccount.address,
  clientAddress: creds.clientAccount.address,
  maxNonce: 200,
  signature: '0xf67ce10bf1a6c95b0a3a44911e629dfffb7f9d658f99a320687dcd41b20b142c6f47f8bad0bc0b2d4a4caf3d1f1fd1c533fae0ad06c86f2f82e9471a16afa1a31c',
};

// ---------------- Constructors ----------------//

describe('AuthorizationCertificate', () => {
  describe('constructor', () => {
    it('should construct properly without signature', () => {
      const authCert = new AuthorizationCertificate(
        validAuthCert.publisherAddress,
        validAuthCert.clientAddress,
        validAuthCert.maxNonce,
      );

      expect(authCert.publisherAddress).to.equal(validAuthCert.publisherAddress);
      expect(authCert.clientAddress).to.equal(validAuthCert.clientAddress);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
    });

    it('should construct properly with signature', () => {
      const authCert = new AuthorizationCertificate(
        validAuthCert.publisherAddress,
        validAuthCert.clientAddress,
        validAuthCert.maxNonce,
        validAuthCert.signature,
      );

      expect(authCert.publisherAddress).to.equal(validAuthCert.publisherAddress);
      expect(authCert.clientAddress).to.equal(validAuthCert.clientAddress);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(authCert.signature).to.equal(validAuthCert.signature);
    });
  });
});


// ---------------- Signing ----------------//

describe('AuthorizationCertificate', () => {
  describe('sign', () => {
    it('should produce correct signature', () => {
      const authCert = new AuthorizationCertificate(
        validAuthCert.publisherAddress,
        validAuthCert.clientAddress,
        validAuthCert.maxNonce,
      );

      authCert.sign(creds.publisherAccount.privateKey);

      expect(authCert.publisherAddress).to.equal(validAuthCert.publisherAddress);
      expect(authCert.clientAddress).to.equal(validAuthCert.clientAddress);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(authCert.signature).to.equal(validAuthCert.signature);
    });
  });
});


// ---------------- Verification ----------------//

describe('AuthorizationCertificate', () => {
  describe('verify', () => {
    it('should verify valid certificate', () => {
      const authCert = new AuthorizationCertificate(
        validAuthCert.publisherAddress,
        validAuthCert.clientAddress,
        validAuthCert.maxNonce,
        validAuthCert.signature,
      );

      expect(authCert.publisherAddress).to.equal(validAuthCert.publisherAddress);
      expect(authCert.clientAddress).to.equal(validAuthCert.clientAddress);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(authCert.signature).to.equal(validAuthCert.signature);

      expect(authCert.verify()).to.equal(true);
    });
  });
});
