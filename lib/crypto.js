const ethUtil = require('ethereumjs-util');

function bufferFromUint8Array(arr) {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.length);
}

const Crypto = function base() {};

Crypto.prototype.sign = (msg, privateKey) => {
  const msgHash = ethUtil.hashPersonalMessage(msg);
  const signatureObject = ethUtil.ecsign(msgHash, bufferFromUint8Array(privateKey));
  const signature = Buffer.concat([
    signatureObject.r,
    signatureObject.s,
    Uint8Array.from([signatureObject.v]),
  ], 65);
  return new Uint8Array(signature.buffer, signature.byteOffset, signature.length);
};

Crypto.prototype.verify = (msg, signature, address) => {
  const msgHash = ethUtil.hashPersonalMessage(msg);
  const publicKey = ethUtil.ecrecover(
    msgHash,
    signature[signature.length - 1],
    bufferFromUint8Array(signature.slice(0, 32)),
    bufferFromUint8Array(signature.slice(32, 64)),
  );

  return ethUtil.pubToAddress(publicKey).equals(address);
};

Crypto.prototype.hash = (msg) => {
  const msgHash = ethUtil.keccak256(bufferFromUint8Array(msg));

  return new Uint8Array(msgHash.buffer, msgHash.byteOffset, msgHash.length);
};

module.exports = new Crypto();
