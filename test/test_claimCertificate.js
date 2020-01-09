const { describe, it } = require('mocha');
const { expect } = require('chai');

const AuthorizationCertificate = require('../lib/authorizationCertificate.js');
const ServiceCertificate = require('../lib/serviceCertificate.js');
const ClaimCertificate = require('../lib/claimCertificate.js');

const creds = require('./credentials.js');

const validAuthCert = new AuthorizationCertificate(
  Buffer.from(creds.publisherAccount.address.substr(2), 'hex'),
  Buffer.from(creds.clientAccount.address.substr(2), 'hex'),
  200,
  Buffer.from('f67ce10bf1a6c95b0a3a44911e629dfffb7f9d658f99a320687dcd41b20b142c6f47f8bad0bc0b2d4a4caf3d1f1fd1c533fae0ad06c86f2f82e9471a16afa1a31c', 'hex'),
);

const validServiceCert = new ServiceCertificate(
  validAuthCert,
  100,
  Buffer.from('4109651d6444b1ef5ae5000f59486d1fcd0cafcb4d33227606756253015a62410df026dc375911ff5cfa130d7b0f954370dd325b4c1d3fd6fcfa027be968d9d21b', 'hex'),
);

const winningClaimCert = {
  serviceCertificate: validServiceCert,
  signature: Buffer.from('df73a0e42b6dec194a018f1e3f1d3b52103c3cfa118ee2c0841c18de0a8aa5250cb805e389717245df27f05214fe944d58455669404bbddaeaae0115d31e54851b', 'hex'),
};


// ---------------- Constructors ----------------//

describe('ClaimCertificate', () => {
  describe('constructor', () => {
    it('should construct properly without signature', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      expect(claimCert.serviceCertificate.authorizationCertificate.publisherAddress
        .compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(claimCert.serviceCertificate.authorizationCertificate.clientAddress
        .compare(validAuthCert.clientAddress)).to.equal(0);
      expect(claimCert.serviceCertificate.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(claimCert.serviceCertificate.authorizationCertificate.signature
        .compare(validAuthCert.signature)).to.equal(0);

      expect(claimCert.serviceCertificate.nonce).to.equal(validServiceCert.nonce);
      expect(claimCert.serviceCertificate.signature.compare(validServiceCert.signature))
        .to.equal(0);
    });

    it('should construct properly with signature', () => {
      const claimCert = new ClaimCertificate(
        winningClaimCert.serviceCertificate,
        winningClaimCert.signature,
      );

      expect(claimCert.serviceCertificate.authorizationCertificate.publisherAddress
        .compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(claimCert.serviceCertificate.authorizationCertificate.clientAddress
        .compare(validAuthCert.clientAddress)).to.equal(0);
      expect(claimCert.serviceCertificate.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(claimCert.serviceCertificate.authorizationCertificate.signature
        .compare(validAuthCert.signature)).to.equal(0);

      expect(claimCert.serviceCertificate.nonce).to.equal(validServiceCert.nonce);
      expect(claimCert.serviceCertificate.signature.compare(validServiceCert.signature))
        .to.equal(0);

      expect(claimCert.signature.compare(winningClaimCert.signature)).to.equal(0);
    });
  });
});


// ---------------- Signing ----------------//

describe('ClaimCertificate', () => {
  describe('sign', () => {
    it('should produce correct signature', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      claimCert.sign(Buffer.from(creds.winningNodeAccount.privateKey.substr(2), 'hex'));

      expect(claimCert.serviceCertificate.authorizationCertificate.publisherAddress
        .compare(validAuthCert.publisherAddress)).to.equal(0);
      expect(claimCert.serviceCertificate.authorizationCertificate.clientAddress
        .compare(validAuthCert.clientAddress)).to.equal(0);
      expect(claimCert.serviceCertificate.authorizationCertificate.maxNonce)
        .to.equal(validAuthCert.maxNonce);
      expect(claimCert.serviceCertificate.authorizationCertificate.signature
        .compare(validAuthCert.signature)).to.equal(0);

      expect(claimCert.serviceCertificate.nonce).to.equal(validServiceCert.nonce);
      expect(claimCert.serviceCertificate.signature.compare(validServiceCert.signature))
        .to.equal(0);

      expect(claimCert.signature.compare(winningClaimCert.signature)).to.equal(0);
    });
  });
});


// ---------------- Winning check ----------------//

describe('ClaimCertificate', () => {
  describe('isWinning', () => {
    it('should return true with winning certificate', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      claimCert.sign(Buffer.from(creds.winningNodeAccount.privateKey.substr(2), 'hex'));

      expect(claimCert.isWinning()).to.equal(true);
    });

    it('should return false with losing certificate', () => {
      const claimCert = new ClaimCertificate(winningClaimCert.serviceCertificate);

      claimCert.sign(Buffer.from(creds.losingNodeAccount.privateKey.substr(2), 'hex'));

      expect(claimCert.isWinning()).to.equal(false);
    });
  });
});
