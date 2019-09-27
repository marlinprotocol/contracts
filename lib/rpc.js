const ethrpc = require('ethrpc');
const config = require('./config.js');

const Rpc = function base() {};

Rpc.prototype.connect = function connect(callback, force = false) {
  if (this.isConnected && !force) {
    callback();
    return;
  }

  this.isConnected = false;
  ethrpc.connect({
    wsAddresses: config.wsAddresses,
    httpAddresses: config.httpAddresses,
    ipcAddresses: config.ipcAddresses,
  }, (err) => {
    if (err) {
      callback(err);
    } else {
      this.isConnected = true;
      callback();
    }
  });
};

Rpc.prototype.sendTransaction = function sendTransaction(tx) {
  this.connect((err) => {
    if (err) { return; }
    ethrpc.packageAndSubmitRawTransaction(tx, config.address, config.privateKey, 'privateKey');
  });
};

module.exports = new Rpc();
