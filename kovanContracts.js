const Web3 = require("web3");
const web3 = new Web3("http://34.93.40.96:8545");
const mPongLogicAbi = require("./build/contracts/mPondLogic.json").abi;
const mPongLogicProxy = require("./build/contracts/mPondProxy.json").abi;
const mPongLogicBytecode = require("./build/contracts/mPondLogic.json")
  .bytecode;
const web3Utils = require("web3-utils");

const privKeys = [
  "1b83be2fc81050af5c5ebc714105d87f52636edc01dc2c62257fef7f562fc654",
  "1eae96f17cfe5ca1995530ca9f3b595583d713052a6e3898f1e1c441e89eae51",
];
const addresses = [
  "0xFC57cBd6d372d25678ecFDC50f95cA6759b3162b",
  "0xdeFF2Cd841Bd47592760cE068a113b8E594F8553",
];

for (let index = 0; index < privKeys.length; index++) {
  const privateKey = privKeys[index];
  web3.eth.accounts.wallet.add(privateKey);
}

var contract = new web3.eth.Contract(mPongLogicAbi);