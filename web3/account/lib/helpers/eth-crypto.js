const ethUtil = require('ethereumjs-util');
const crypto = require('crypto');

function bufferFromUint8Array(arr) {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.length);
}

const EthCrypto = function EthCrypto() {};

EthCrypto.prototype.sign = (msgBuf, privateKeyHex) => {
  const msgHash = ethUtil.hashPersonalMessage(msgBuf);
  const signatureObject = ethUtil.ecsign(msgHash, ethUtil.toBuffer(privateKeyHex));
  const signature = Buffer.concat([
    signatureObject.r,
    signatureObject.s,
    ethUtil.toBuffer(signatureObject.v),
  ]);
  // console.log('signatureObject:'+signatureObject);
  // console.log('msgBuf:'+msgBuf);
  // console.log('r:'+signatureObject.r);
  // console.log('s:'+signatureObject.s);
  // console.log('v:'+signatureObject.v);
  // console.log('signature:'+ethUtil.bufferToHex(signature));
  return signature;
};

EthCrypto.prototype.verify = (msgBuf, signatureHex, address) => {
  const msgHash = ethUtil.hashPersonalMessage(msgBuf);
  signatureHex = signatureHex.split('x')[1];
  var r = ethUtil.toBuffer('0x'+signatureHex.substring(0, 64))
  var s = ethUtil.toBuffer('0x'+signatureHex.substring(64, 128))
  var v = parseInt('0x'+signatureHex.substring(128, 130));
  const publicKey = ethUtil.ecrecover(
    msgHash,
    v,
    r,
    s
  );
  // console.log(ethUtil.pubToAddress(publicKey));
  // console.log(address);
  // console.log('msgBuf:'+msgBuf);
  // console.log('r:'+r);
  // console.log('s:'+s);
  // console.log('v:'+v);
  // console.log('signature:'+signatureHex);
  return ethUtil.pubToAddress(publicKey).equals(address);
};

EthCrypto.prototype.generateNonceBuffer = () => {
  return crypto.randomBytes(32);
}

EthCrypto.prototype.createSaltedMsgBuf = (msgJson, nonceBuf, timeStampBuf) => {
  let msgString = JSON.stringify(msgJson);
  let msgBuf = ethUtil.toBuffer(msgString);
  let saltedMsgBuf = Buffer.concat([msgBuf, nonceBuf, timeStampBuf]);
  // console.log(nonceBuf);
  // console.log(msgString);
  // console.log(msgBuf);
  // console.log("createSaltedMsgBuf");
  // console.log(msgJson);
  // console.log(nonceBuf);
  // console.log(timeStampBuf);
  // console.log(saltedMsgBuf);
  return saltedMsgBuf;
}

module.exports = new EthCrypto();
