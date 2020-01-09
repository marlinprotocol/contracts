const { describe, it } = require('mocha');
const { expect } = require('chai');

const AuthorizationCertificate = require('../lib/authorizationCertificate.js');

const creds = require('./credentials.js');

const validAuthCert = {
  publisherAddress: Buffer.from(creds.publisherAccount.address.substr(2), 'hex'),
  clientAddress: Buffer.from(creds.clientAccount.address.substr(2), 'hex'),
  maxNonce: 200,
  signature: Buffer.from('f67ce10bf1a6c95b0a3a44911e629dfffb7f9d658f99a320687dcd41b20b142c6f47f8bad0bc0b2d4a4caf3d1f1fd1c533fae0ad06c86f2f82e9471a16afa1a31c', 'hex'),
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

      expect(authCert.publisherAddress.compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(authCert.clientAddress.compare(validAuthCert.clientAddress)).to.equal(0);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
    });

    it('should construct properly with signature', () => {
      const authCert = new AuthorizationCertificate(
        validAuthCert.publisherAddress,
        validAuthCert.clientAddress,
        validAuthCert.maxNonce,
        validAuthCert.signature,
      );

      expect(authCert.publisherAddress.compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(authCert.clientAddress.compare(validAuthCert.clientAddress)).to.equal(0);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(authCert.signature.compare(validAuthCert.signature)).to.equal(0);
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

      authCert.sign(Buffer.from(creds.publisherAccount.privateKey.substr(2), 'hex'));

      expect(authCert.publisherAddress.compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(authCert.clientAddress.compare(validAuthCert.clientAddress)).to.equal(0);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(authCert.signature.compare(validAuthCert.signature)).to.equal(0);
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

      expect(authCert.publisherAddress.compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(authCert.clientAddress.compare(validAuthCert.clientAddress)).to.equal(0);
      expect(authCert.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(authCert.signature.compare(validAuthCert.signature)).to.equal(0);

      expect(authCert.verify()).to.equal(true);
    });
  });
});
