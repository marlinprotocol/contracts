// var privateKey = "0cfc85ef0a6885191729ddb8788b3a77e21e4927e236f87b1c32e63c8ca58cb6";
// // var address = "0x987263f5A229D787BDE7f593181A2E0e7B77F5EB";

// var ethers = require('ethers');
// var message = "1111111122223333333344444444555555556666666666666666666666666666666666666666666666666666666666666666";

// var wallet = new ethers.Wallet(privateKey)
// // console.log(JSON.stringify(wallet, null, 4));

// var signature = wallet.signMessage(message)

// signature.then(function(data){
//     var sig = ethers.utils.splitSignature(data);
//     console.log(sig)
// })

// // var promise = contract.verifyString(message, sig.v, sig.r, sig.s);
// // promise.then(function(signer) {
// //     console.log(signer === wallet.address);
// // });

// // var r = "dd559fe4c8e2a3e1926209ee05928f86510ddce888d52c0a01fc76e62489a2b9" // bytes32
// // var s = "779cebcd2e7f46025c4669169f937627dcbd74b980f67709479d15d5c918ed5b" // bytes32
// // var v = 27; //uint8 //1b hex

var Web3 = require('web3');
var web3 = new Web3(Web3.givenProvider || 'http://127.0.0.1:8545');


// var msg = new Buffer('1111111122223333333344444444555555556666666666666666666666666666666666666666666666666666666666666666', 'hex').toString();
var msg = Buffer.from('1111111122223333333344444444555555556666666666666666666666666666666666666666666666666666666666666666', 'hex');


// web3.eth.getAccounts(function(err, accounts){
//     if(!err){
//         var address = web3.utils.toChecksumAddress(accounts[0]);
//         var h = web3.utils.keccak256(msg);
//         // var h = msg;
//         web3.eth.sign(h, address, function(err,data){
//             if(!err){
//                 console.log("address", address)
//                 var r = `0x${data.slice(2, 66)}`
//                 var s = `0x${data.slice(66, 130)}`
//                 var v = data.slice(130, 132) == "00" ? 27 : 28;
//                 console.log({h,v,r,s})
//             }
//         });
//     }
// })
async function test(){
    let address = await web3.eth.getAccounts();
    address = web3.utils.toChecksumAddress(address[0]);

    var h = web3.utils.keccak256(msg);

    let data = await web3.eth.sign(h, address);
    console.log("address", address)
    var r = `0x${data.slice(2, 66)}`
    var s = `0x${data.slice(66, 130)}`
    var v = data.slice(130, 132) == "00" ? 27 : 28;
    console.log({h,v,r,s})
}
test();
// setTimeout(function(){
//     web3.eth.getAccounts(console.log)
// },1000);