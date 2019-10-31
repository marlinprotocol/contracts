const chainProvider = require('@marlinprotocol/ethereum-provider');
const certificateBackend = require('@marlinprotocol/certificate-eth-backend');

const Crypto = function base() {};

Crypto.prototype.sign = chainProvider.crypto.sign;
Crypto.prototype.verify = chainProvider.crypto.verify;
Crypto.prototype.hash = chainProvider.crypto.hash;

Crypto.prototype.submitWinningCertificate =
  certificateBackend.certificateContract.submitWinningCertificate;

module.exports = new Crypto();
