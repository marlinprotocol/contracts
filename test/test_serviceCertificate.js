const { describe, it } = require('mocha');
const { expect } = require('chai');

const AuthorizationCertificate = require('../lib/authorizationCertificate.js');
const ServiceCertificate = require('../lib/serviceCertificate.js');

const creds = require('./credentials.js');

const validAuthCert = new AuthorizationCertificate(
  creds.publisherAccount.address,
  creds.clientAccount.address,
  200,
  '0xf67ce10bf1a6c95b0a3a44911e629dfffb7f9d658f99a320687dcd41b20b142c6f47f8bad0bc0b2d4a4caf3d1f1fd1c533fae0ad06c86f2f82e9471a16afa1a31c',
);

const validServiceCert = {
  authorizationCertificate: validAuthCert,
  nonce: 100,
  signature: '0x4109651d6444b1ef5ae5000f59486d1fcd0cafcb4d33227606756253015a62410df026dc375911ff5cfa130d7b0f954370dd325b4c1d3fd6fcfa027be968d9d21b',
};


// ---------------- Constructors ----------------//

describe('ServiceCertificate', () => {
  describe('constructor', () => {
    it('should construct properly without signature', () => {
      const serviceCert = new ServiceCertificate(
        validServiceCert.authorizationCertificate,
        validServiceCert.nonce,
      );

      expect(serviceCert.authorizationCertificate.publisherAddress)
        .to.equal(validAuthCert.publisherAddress);
      expect(serviceCert.authorizationCertificate.clientAddress)
        .to.equal(validAuthCert.clientAddress);
      expect(serviceCert.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature)
        .to.equal(validAuthCert.signature);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
    });

    it('should construct properly with signature', () => {
      const serviceCert = new ServiceCertificate(
        validServiceCert.authorizationCertificate,
        validServiceCert.nonce,
        validServiceCert.signature,
      );

      expect(serviceCert.authorizationCertificate.publisherAddress)
        .to.equal(validAuthCert.publisherAddress);
      expect(serviceCert.authorizationCertificate.clientAddress)
        .to.equal(validAuthCert.clientAddress);
      expect(serviceCert.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature)
        .to.equal(validAuthCert.signature);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
      expect(serviceCert.signature).to.equal(validServiceCert.signature);
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

      serviceCert.sign(creds.clientAccount.privateKey);

      expect(serviceCert.authorizationCertificate.publisherAddress)
        .to.equal(validAuthCert.publisherAddress);
      expect(serviceCert.authorizationCertificate.clientAddress)
        .to.equal(validAuthCert.clientAddress);
      expect(serviceCert.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature)
        .to.equal(validAuthCert.signature);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
      expect(serviceCert.signature).to.equal(validServiceCert.signature);
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

      expect(serviceCert.authorizationCertificate.publisherAddress)
        .to.equal(validAuthCert.publisherAddress);
      expect(serviceCert.authorizationCertificate.clientAddress)
        .to.equal(validAuthCert.clientAddress);
      expect(serviceCert.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(serviceCert.authorizationCertificate.signature)
        .to.equal(validAuthCert.signature);

      expect(serviceCert.nonce).to.equal(validServiceCert.nonce);
      expect(serviceCert.signature).to.equal(validServiceCert.signature);

      expect(serviceCert.verify()).to.equal(true);
    });
  });
});
