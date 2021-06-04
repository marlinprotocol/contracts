const Web3 = require("web3");
const networks = require("./networks");
const web3 = new Web3(networks[process.env.NETWORK]);

web3.eth.accounts.wallet.add(process.env.PRIV_KEY);

console.log(web3.eth.accounts.wallet[0].address);
