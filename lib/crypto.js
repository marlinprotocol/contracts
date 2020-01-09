const Accounts = require('web3-eth-accounts');
const Utils = require('web3-utils');

const accounts = new Accounts();

const Crypto = function Crypto() {};

Crypto.prototype.sign = (msg, privateKey) => {
  const signatureObject = accounts.sign(msg, privateKey);
  return signatureObject.signature;
};

Crypto.prototype.verify = (msg, signature, address) => {
  const signatureAddress = accounts.recover(msg, signature);
  return address === signatureAddress;
};

Crypto.prototype.hash = msg => Buffer.from(Utils.keccak256(msg).substr(2), 'hex');

module.exports = new Crypto();
