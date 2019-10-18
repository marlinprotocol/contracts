const CertificateContract = function certificateContractBase() {};

CertificateContract.prototype.contractAddress = '0x60b5f36b62e492c47d7d66b15d9ba9091f18eb5c';

CertificateContract.prototype.abi = JSON.parse(fs.readFileSync('smartContracts/Certificate.abi'));

module.exports = new CertificateContract();
