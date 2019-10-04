const config = require('config');
const ethrpc = require('ethrpc');

const Rpc = function Rpc() {};

Rpc.prototype.connect = function connect(callback, force = false) {
  if (this.isConnected && !force) {
    callback();
    return;
  }

  this.isConnected = false;
  ethrpc.connect({
    wsAddresses: config.has('ethereum.rpc.wsAddresses') ? config.get('ethereum.rpc.wsAddresses') : [],
    httpAddresses: config.has('ethereum.rpc.httpAddresses') ? config.get('ethereum.rpc.httpAddresses') : [],
    ipcAddresses: config.has('ethereum.rpc.ipcAddresses') ? config.get('ethereum.rpc.ipcAddresses') : [],
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
    if (err) { return; } // TODO: Better error handling
    ethrpc.packageAndSubmitRawTransaction(
      tx,
      config.get('ethereum.account.address'),
      config.get('ethereum.account.privateKey'),
      'privateKey',
    );
  });
};

module.exports = new Rpc();
