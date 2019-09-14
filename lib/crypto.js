ethUtil = require('ethereumjs-util')

function bufferFromUint8Array(arr) {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.length)
}

var Crypto = function () {};

Crypto.prototype.sign = function (msg, privateKey) {
  const msgHash = ethUtil.hashPersonalMessage(msg);
  const signatureObject = ethUtil.ecsign(msgHash, bufferFromUint8Array(privateKey));
  const signature = Buffer.concat([signatureObject.r, signatureObject.s, Uint8Array.from([signatureObject.v])], 65);
  return new Uint8Array(signature.buffer, signature.byteOffset, signature.length);
}

Crypto.prototype.verify = function (msg, signature, publicKey) {
  const msgHash = ethUtil.hashPersonalMessage(msg);
  const signaturePublicKey = ethUtil.ecrecover(msgHash, signature[signature.length - 1], bufferFromUint8Array(signature.slice(0, 32)), bufferFromUint8Array(signature.slice(32, 64)));
  return signaturePublicKey.equals(publicKey);
}

module.exports = new Crypto();
