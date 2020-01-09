const Wallet = require("./wallet");

myWallet = new Wallet();

let privateKey = "0x348ce564d427a3311b6536bbcff9390d69395b06ed6c486954e971d960fe8709"
let providerUrl = "https://rinkeby.infura.io/v3/56a2f6543c244ce28411a49bf97cbb42"

myWallet.init({
	"privateKey": privateKey,
	"providerUrl": providerUrl
});


myWallet.getEtherBalanceinWei("0xb8CE9ab6943e0eCED004cDe8e3bBed6568B2Fa01")
.then(result => {
	console.log(result)
})


myWallet.getEtherBalance("0xb8CE9ab6943e0eCED004cDe8e3bBed6568B2Fa01")
.then(result => {
	console.log(result)
})

myWallet.transferEther("0x1020e2B8C3bBA3C14e0028f1892D318452e316B0", 10)
// .then(result => {
// 	console.log(result)
// })

/*
.on('transactionHash',function(hash) {console.log(transactionHash)})
.on('receipt', function(receipt) {console})
.on('error', console.error); // If a out of gas error, the second parameter is the receipt.
*/
