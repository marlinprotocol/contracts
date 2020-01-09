const Accounts = require('web3-eth-accounts');
const Utils = require('web3-utils');

const accounts = new Accounts();

const Crypto = function Crypto() {};

Crypto.prototype.sign = (msg, privateKey) => {
  const signatureObject = accounts.sign(msg, `0x${privateKey.toString('hex')}`);
  return Buffer.from(signatureObject.signature.substr(2), 'hex');
};

Crypto.prototype.verify = (msg, signature, address) => {
  const signatureAddress = Buffer.from(
    accounts.recover(`0x${msg.toString('hex')}`, `0x${signature.toString('hex')}`).substr(2),
    'hex',
  );
  return address.compare(signatureAddress) === 0;
};

Crypto.prototype.hash = msg => Buffer.from(Utils.keccak256(msg).substr(2), 'hex');

module.exports = new Crypto();
