const ethAbi = require('ethereumjs-abi');
const EthTx = require('ethereumjs-tx');
const fs = require('fs');

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

const CertificateContract = () => {};

CertificateContract.prototype.contractAddress = '0x60b5f36b62e492c47d7d66b15d9ba9091f18eb5c';

CertificateContract.prototype.abi = JSON.parse(fs.readFileSync('./certificate.abi'));

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
  const encodedAbi = encodeSubmitWinningCertificate(this.abi, winningCertificate);

  // Build tx
  const tx = new EthTx({
    gasPrice: 0,
    gasLimit: 200000,
    to: this.contractAddress,
    value: 0,
    data: encodedAbi,
  });
  return tx;
};

module.exports = new CertificateContract();
