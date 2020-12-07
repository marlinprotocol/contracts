const Web3 = require("web3");
const web3 = new Web3(
  "https://kovan.infura.io/v3/9dc997986f8840daa0e6ccb1d8d0d757"
);
const contractAddress = "0x2d386ca2BCB4CB6eaD9C2B65FC476425F6e1cD04";
const TokenLogicCompiled = require("../build/contracts/TokenLogic.json");

// proxy admin slot
web3.eth
  .getStorageAt(
    contractAddress,
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
  )
  .then(function (result) {
    console.log("Proxy Admin");
    console.log(result);
    console.log("Proxy Admin");
  });

// logic contract slot
web3.eth
  .getStorageAt(
    contractAddress,
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  )
  .then(function (result) {
    console.log("Logic Contract Slot");
    console.log(result);
    console.log("Logic Contract Slot");
  });

async function checkBalance() {
    let checkingAddress = "0x9BB6494b43af142cdEf01Bd92575b1b3C6Fe28c5"
  const tokenInstance = new web3.eth.Contract(
    TokenLogicCompiled.abi,
    contractAddress
  );
  let balance = await tokenInstance.methods
    .balanceOf(checkingAddress)
    .call();

    console.log(`Balance of address: ${checkingAddress} is ${balance}`)
  return 
}

checkBalance().then().catch(console.log);
