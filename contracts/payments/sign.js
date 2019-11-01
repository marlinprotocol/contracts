const Web3 = require('web3');

const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545', null, {});


//Hash Generation of Payment Object -> Just for Testing
console.log(web3.eth.accounts.hashMessage("0xffcf8fdee72ac11b5c542428b35eef5769c409f07bb0a26f16471e1a4f48ca3f31025faaf3665cb56170938e4d6880c3ae3e729931d146d0cd765871b5f880cecbc979e2b38434cf341681c7817cbce3b599af691b22d491bde2303f2f43325b2108d26f1eaba1e32b"));
// console.log(web3.utils.hexToBytes("0xffcf8fdee72ac11b5c542428b35eef5769c409f0"));
//Signature Generation from Payment Object and Private Key
console.log(web3.eth.accounts.sign("0xffcf8fdee72ac11b5c542428b35eef5769c409f07bb0a26f16471e1a4f48ca3f31025faaf3665cb56170938e4d6880c3ae3e729931d146d0cd765871b5f880cecbc979e2b38434cf341681c7817cbce3b599af691b22d491bde2303f2f43325b2108d26f1eaba1e32b", "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1").signature);
console.log(web3.eth.accounts.sign("8264", "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1").signature);