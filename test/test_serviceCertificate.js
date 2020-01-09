const { describe, it } = require('mocha');
const { expect } = require('chai');

const AuthorizationCertificate = require('../lib/authorizationCertificate.js');
const ServiceCertificate = require('../lib/serviceCertificate.js');

const creds = require('./credentials.js');

const validAuthCert = new AuthorizationCertificate(
  Buffer.from(creds.publisherAccount.address.substr(2), 'hex'),
  Buffer.from(creds.clientAccount.address.substr(2), 'hex'),
  200,
  Buffer.from('f67ce10bf1a6c95b0a3a44911e629dfffb7f9d658f99a320687dcd41b20b142c6f47f8bad0bc0b2d4a4caf3d1f1fd1c533fae0ad06c86f2f82e9471a16afa1a31c', 'hex'),
);

const validServiceCert = {
  authorizationCertificate: validAuthCert,
  nonce: 100,
  signature: Buffer.from('4109651d6444b1ef5ae5000f59486d1fcd0cafcb4d33227606756253015a62410df026dc375911ff5cfa130d7b0f954370dd325b4c1d3fd6fcfa027be968d9d21b', 'hex'),
};


// ---------------- Constructors ----------------//

describe('ServiceCertificate', () => {
  describe('constructor', () => {
    it('should construct properly without signature', () => {
      const serviceCert = new ServiceCertificate(
        validServiceCert.authorizationCertificate,
        validServiceCert.nonce,
      );

      expect(serviceCert.authorizationCertificate.publisherAddress
        .compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.clientAddress
        .compare(validAuthCert.clientAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature
        .compare(validAuthCert.signature)).to.equal(0);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
    });

    it('should construct properly with signature', () => {
      const serviceCert = new ServiceCertificate(
        validServiceCert.authorizationCertificate,
        validServiceCert.nonce,
        validServiceCert.signature,
      );

      expect(serviceCert.authorizationCertificate.publisherAddress
        .compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.clientAddress
        .compare(validAuthCert.clientAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature
        .compare(validAuthCert.signature)).to.equal(0);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
      expect(serviceCert.signature.compare(validServiceCert.signature)).to.equal(0);
    });
  });
});


// ---------------- Signing ----------------//

describe('ServiceCertificate', () => {
  describe('sign', () => {
    it('should produce correct signature', () => {
      const serviceCert = new ServiceCertificate(
        validServiceCert.authorizationCertificate,
        validServiceCert.nonce,
      );

      serviceCert.sign(Buffer.from(creds.clientAccount.privateKey.substr(2), 'hex'));

      expect(serviceCert.authorizationCertificate.publisherAddress
        .compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.clientAddress
        .compare(validAuthCert.clientAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature
        .compare(validAuthCert.signature)).to.equal(0);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
      expect(serviceCert.signature.compare(validServiceCert.signature)).to.equal(0);
    });
  });
});


// ---------------- Verification ----------------//

describe('ServiceCertificate', () => {
  describe('verify', () => {
    it('should verify valid certificate', () => {
      const serviceCert = new ServiceCertificate(
        validServiceCert.authorizationCertificate,
        validServiceCert.nonce,
        validServiceCert.signature,
      );

      expect(serviceCert.authorizationCertificate.publisherAddress
        .compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.clientAddress
        .compare(validAuthCert.clientAddress)).to.equal(0);
      expect(serviceCert.authorizationCertificate.maxNonce).to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature
        .compare(validAuthCert.signature)).to.equal(0);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
      expect(serviceCert.signature.compare(validServiceCert.signature)).to.equal(0);

      expect(serviceCert.verify()).to.equal(true);
    });
  });
});
