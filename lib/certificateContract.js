const ethAbi = require('ethereumjs-abi');
const fs = require('fs');
const path = require('path');
const chainProvider = require('@marlinprotocol/ethereum-provider');

function bufferFromUint8Array(arr) {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.length);
}

// Doesn't work with overloads
function methodSignature(abi, method) {
  const abiMethod = abi.find(element => element.name === method);
  const inputSig = abiMethod.inputs.reduce((acc, cur) => (acc === '' ? cur.type : `${acc},${cur.type}`), '');
  const outputSig = abiMethod.outputs.reduce((acc, cur) => (acc === '' ? cur.type : `${acc},${cur.type}`), '');

  return `${method}(${inputSig}):(${outputSig})`;
}

const CertificateContract = function base() {};

CertificateContract.prototype.contractAddress = '0x6b8fdef3daf08c6c94a2afa75f1d78f8b7a2c14a';

CertificateContract.prototype.abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, './certificate.abi')));

function encodeSettleWinningCertificate(abi, winningCertificate) {
  const { signature: winningSig, serviceCertificate } = winningCertificate;
  const { signature: serviceSig, authorizationCertificate } = serviceCertificate;
  const authSig = authorizationCertificate.signature;

  const encodedAbi = ethAbi.simpleEncode(
    methodSignature(abi, 'settleWinningCertificate'),
    `0x${bufferFromUint8Array(authorizationCertificate.publisherAddress).toString('hex')}`,
    `0x${bufferFromUint8Array(authorizationCertificate.clientAddress).toString('hex')}`,
    authorizationCertificate.maxNonce,
    serviceCertificate.nonce,
    [
      authSig[authSig.length - 1],
      serviceSig[serviceSig.length - 1],
      winningSig[winningSig.length - 1],
    ],
    [
      bufferFromUint8Array(authSig.slice(0, 32)),
      bufferFromUint8Array(serviceSig.slice(0, 32)),
      bufferFromUint8Array(winningSig.slice(0, 32)),
    ],
    [
      bufferFromUint8Array(authSig.slice(32, 64)),
      bufferFromUint8Array(serviceSig.slice(32, 64)),
      bufferFromUint8Array(winningSig.slice(32, 64)),
    ],
  );

  return encodedAbi;
}

CertificateContract.prototype.submitWinningCertificate = function submit(winningCertificate) {
  // Build method call ABI
  const encodedAbi = encodeSettleWinningCertificate(this.abi, winningCertificate);

  // Build tx. Still need to set from, nonce and sign. Can be handled by rpc library.
  const txPayload = {
    to: this.contractAddress,
    gasPrice: 0,
    gas: 200000,
    value: 0,
    data: encodedAbi,
  };

  chainProvider.rpc.sendTransaction(txPayload);
};

module.exports = new CertificateContract();
