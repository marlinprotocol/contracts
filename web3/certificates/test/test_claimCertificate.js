const { describe, it } = require('mocha');
const { expect } = require('chai');

const AuthorizationCertificate = require('../lib/authorizationCertificate.js');
const ServiceCertificate = require('../lib/serviceCertificate.js');
const ClaimCertificate = require('../lib/claimCertificate.js');

const creds = require('./credentials.js');

const validAuthCert = new AuthorizationCertificate(
  creds.publisherAccount.address,
  creds.clientAccount.address,
  200,
  '0xf67ce10bf1a6c95b0a3a44911e629dfffb7f9d658f99a320687dcd41b20b142c6f47f8bad0bc0b2d4a4caf3d1f1fd1c533fae0ad06c86f2f82e9471a16afa1a31c',
);

const validServiceCert = new ServiceCertificate(
  validAuthCert,
  100,
  '0x4109651d6444b1ef5ae5000f59486d1fcd0cafcb4d33227606756253015a62410df026dc375911ff5cfa130d7b0f954370dd325b4c1d3fd6fcfa027be968d9d21b',
);

const winningClaimCert = {
  serviceCertificate: validServiceCert,
  signature: '0xdf73a0e42b6dec194a018f1e3f1d3b52103c3cfa118ee2c0841c18de0a8aa5250cb805e389717245df27f05214fe944d58455669404bbddaeaae0115d31e54851b',
};


// ---------------- Constructors ----------------//

describe('ClaimCertificate', () => {
  describe('constructor', () => {
    it('should construct properly without signature', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      expect(claimCert.serviceCertificate.authorizationCertificate.publisherAddress)
        .to.equal(validAuthCert.publisherAddress);
      expect(claimCert.serviceCertificate.authorizationCertificate.clientAddress)
        .to.equal(validAuthCert.clientAddress);
      expect(claimCert.serviceCertificate.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(claimCert.serviceCertificate.authorizationCertificate.signature)
        .to.equal(validAuthCert.signature);

      expect(claimCert.serviceCertificate.nonce).to.equal(validServiceCert.nonce);
      expect(claimCert.serviceCertificate.signature).to.equal(validServiceCert.signature);
    });

    it('should construct properly with signature', () => {
      const claimCert = new ClaimCertificate(
        winningClaimCert.serviceCertificate,
        winningClaimCert.signature,
      );

      expect(claimCert.serviceCertificate.authorizationCertificate.publisherAddress)
        .to.equal(validAuthCert.publisherAddress);
      expect(claimCert.serviceCertificate.authorizationCertificate.clientAddress)
        .to.equal(validAuthCert.clientAddress);
      expect(claimCert.serviceCertificate.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(claimCert.serviceCertificate.authorizationCertificate.signature)
        .to.equal(validAuthCert.signature);

      expect(claimCert.serviceCertificate.nonce).to.equal(validServiceCert.nonce);
      expect(claimCert.serviceCertificate.signature).to.equal(validServiceCert.signature);

      expect(claimCert.signature).to.equal(winningClaimCert.signature);
    });
  });
});


// ---------------- Signing ----------------//

describe('ClaimCertificate', () => {
  describe('sign', () => {
    it('should produce correct signature', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      claimCert.sign(creds.winningNodeAccount.privateKey);

      expect(claimCert.serviceCertificate.authorizationCertificate.publisherAddress)
        .to.equal(validAuthCert.publisherAddress);
      expect(claimCert.serviceCertificate.authorizationCertificate.clientAddress)
        .to.equal(validAuthCert.clientAddress);
      expect(claimCert.serviceCertificate.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(claimCert.serviceCertificate.authorizationCertificate.signature)
        .to.equal(validAuthCert.signature);

      expect(claimCert.serviceCertificate.nonce).to.equal(validServiceCert.nonce);
      expect(claimCert.serviceCertificate.signature).to.equal(validServiceCert.signature);

      expect(claimCert.signature).to.equal(winningClaimCert.signature);
    });
  });
});


// ---------------- Winning check ----------------//

describe('ClaimCertificate', () => {
  describe('isWinning', () => {
    it('should return true with winning certificate', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      claimCert.sign(creds.winningNodeAccount.privateKey);

      expect(claimCert.isWinning()).to.equal(true);
    });

    it('should return false with losing certificate', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      claimCert.sign(creds.losingNodeAccount.privateKey);

      expect(claimCert.isWinning()).to.equal(false);
    });
  });
});
