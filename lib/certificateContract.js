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

CertificateContract.prototype.contractAddress = '0x60b5f36b62e492c47d7d66b15d9ba9091f18eb5c';

CertificateContract.prototype.abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, './certificate.abi')));

function encodeSubmitWinningCertificate(abi, winningCertificate) {
  const { signature: winningSig, serviceCertificate } = winningCertificate;
  const { signature: serviceSig, authorizationCertificate } = serviceCertificate;
  const authSig = authorizationCertificate.signature;
  const encodedAbi = ethAbi.simpleEncode(
    methodSignature(abi, 'submitWinningCertificate'),
    authorizationCertificate.publisherAddress,
    authorizationCertificate.clientAddress,
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

CertificateContract.prototype.submitWinningCertificate = async (winningCertificate) => {
  // Build method call ABI
  const encodedAbi = encodeSubmitWinningCertificate(this.abi, winningCertificate);

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
