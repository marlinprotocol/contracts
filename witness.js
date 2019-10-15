const Web3 = require('web3');

const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545', null, {});

let wit, witInit;
let privateKeys = ['0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1', '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c', '0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913']
let nodes = ['0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1', '0xffcf8fdee72ac11b5c542428b35eef5769c409f0', '0x22d491bde2303f2f43325b2108d26f1eaba1e32b', '0xe11ba2b4d45eaed5996cd0823791e0c93114882d']

let witness = [];

for(i=0;i<nodes.length - 1;i++){
    if(witness.length == 0){
        wit = nodes[1] + web3.eth.accounts.sign(nodes[1],privateKeys[0]).signature
        witness.push(wit);
        console.log(`\nW${i+1}: ${witness[i]}`);
    }else{
        witInit = witness[i-1] + nodes[i+1];
        witInit = witInit.split("0x").join(' ').trim().replace(/\s/g, "");
        witInit = "0x"+witInit;
        // console.log(`\n-----------------------------------${witInit}----------------------------------`)
        wit = web3.eth.accounts.sign(witInit,privateKeys[i]).signature;
        // console.log("\nHere: "+wit+"::"+witInit+"::"+privateKeys[i]);
        witness.push(witInit + wit);
        console.log(`\nW${i+1}: ${witness[i]}`)
    }
}

console.log(`-----------------------------------------------------------`);
console.log(`Final Witness: 0x${witness[witness.length-1].split("0x").join('')}`);
let finalWitness = "0x"+witness[witness.length-1].split("0x").join('');
console.log(`-----------------------------------------------------------`);
console.log(`Receiver Signature: ${web3.eth.accounts.sign(finalWitness, "0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743").signature}`);
