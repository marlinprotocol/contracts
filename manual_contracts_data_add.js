const GovernorAlphaAbi = require("./build/contracts/GovernorAlpha.json").abi;
const tokenAbi = require("./build/contracts/Comp.json").abi;
const Web3 = require("web3");
const web3 = new Web3("http://34.93.40.96:8545");
const web3Utils = require("web3-utils");

const privKeys = [
  "1b83be2fc81050af5c5ebc714105d87f52636edc01dc2c62257fef7f562fc654",
  "1eae96f17cfe5ca1995530ca9f3b595583d713052a6e3898f1e1c441e89eae51",
  "172d94caea195103ee412de2d0b1a9db3b1e83a027ad15483f3c66223eb3aa31",
  "ea2ba5f4f9dbc562523545351642337dfe28d15313c67343621ce69268811dd6",
  "e4d6377bc42be08808a118a066947b2b43a8099cd57a2c93b673b113915415d8",
  "1acecbf0180e32ffbfe2696d6e1489ee450ef2c8ae29c76d9127da792a3d074d",
  "ee87c9bc1d06bffc71f6bd1e69b1a965224317f03b0964c46c38a61377b4871c",
];

for (let index = 0; index < privKeys.length; index++) {
  const privateKey = privKeys[index];
  web3.eth.accounts.wallet.add(privateKey);
}

const addresses = [
  "0xFC57cBd6d372d25678ecFDC50f95cA6759b3162b",
  "0xdeFF2Cd841Bd47592760cE068a113b8E594F8553", // token admin
  "0xAF2f0545245C13a4a3a8e4E597a2F4cf65B65088", //extra address
  "0xb8148b8471492B17C6a1e34DA915d48300b52197", // extra address
  "0x88BC9131cc36437B6fEdf38d196d6facd54c7204", //extra address
  "0x8e5129957707C059a242f37BEddbfbD2A09529e0", // extra address
  "0x730F2706CD6e6e6b66E1A4Ee75B7a2d3eA6Bee13",
];

var governanceInstance = new web3.eth.Contract(
  GovernorAlphaAbi,
  "0x00ffcf91ed6107b1f03813d02bbab26c3edfbb98" // kovan address
);
var tokenInstance = new web3.eth.Contract(
  tokenAbi,
  "0x20065f17565b7ab7a2e271178f38b9eaa2576f0f" // kovan address
);

tokenInstance.methods.symbol().call().then(console.log);
let addressToUse = addresses[addresses.length - 1];
// governanceInstance.methods.state(3).call().then(console.log);
tokenInstance.methods.balanceOf(addressToUse).call().then(console.log);
tokenInstance.methods.getCurrentVotes(addressToUse).call().then(console.log);
governanceInstance.methods.proposals(4).call().then(console.log);
// send tokens to any address
// tokenInstance.methods
//   .transfer(addressToUse, new web3Utils.BN("100000100000000000000000"))
//   .send({from: addresses[1], gas: 0xfffff}, console.log);

//delegate to self, can be any address
// tokenInstance.methods
//   .delegate(addressToUse)
//   .send({from: addressToUse, gas: 0xfffff}).then(console.log);

//create proposal
// const targets = ["0x0000000000000000000000000000000000000000"]; //this will be genuine contract in production
// const values = ["0x2223"];
// const signatures = ["34440011"];
// const calldatas = ["0x7888"];
// const description = "Lion Tuna";

// governanceInstance.methods
//   .propose(targets, values, signatures, calldatas, description)
//   .send({from: addressToUse, gas: 0xfffff}).then(console.log).catch(function(ex){
//     console.log(ex);
//   })

// vote
// governanceInstance.methods.castVote(4, false)
//   .send({from: addressToUse, gas: 0xfffff}).then(console.log).catch(function(ex){
//     console.log(ex);
//   })

// 0x7d89D52c464051FcCbe35918cf966e2135a17c43 (Timelock contract)
// Pond.address 0xEa2923b099b4B588FdFAD47201d747e3b9599A5f (The erc20 token for governance)
// GovernorAlpha.address 0xeDAA76873524f6A203De2Fa792AD97E459Fca6Ff (Governance Contract)
// pondAdmin 0xdeFF2Cd841Bd47592760cE068a113b8E594F8553 erc20 admin address. all the erc20 tokens are currently in this address
// guardianAddress 0xAF2f0545245C13a4a3a8e4E597a2F4cf65B65088 governance contract's admin
// timelockAdmin 0xedaa76873524f6a203de2fa792ad97e459fca6ff At time of deployment is same as GovernonAlpha address

// web3.eth.getTransactionReceipt("0xc9441ea20c11ab7d003943306b6f4c3e92222552f61b87984782530c84731d53").then(print);

function print(data) {
  console.log(JSON.stringify(data, null, 4));
}

// /contracts/Token/*
// /contracts/governance/*
// /contracts/Bridge/*
