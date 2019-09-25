const ethrpc = require('ethrpc');
const config = require('./config.js');

const Rpc = function base() {
  ethrpc.connect({
    wsAddresses: [config.wsAddress],
  }, (err) => {
    if (err) {
      // console.error('Failed to connect to Ethereum node.');
    } else {
      // console.log('Connected to Ethereum node!');
    }
  });
};

Rpc.prototype.sendTransaction = (tx) => {
  ethrpc.packageAndSubmitRawTransaction(tx, config.address, config.privateKey, 'privateKey');
};

module.exports = Rpc();
