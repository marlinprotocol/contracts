async function deployContract(web3, abi, bytecode, arguments, config) {
    const contract = new web3.eth.Contract(abi);
    const receiptPromise = new Promise((resolve, reject) => {
      contract
        .deploy({
            data: bytecode,
            arguments,
        })
        .send(config)
        .on("transactionHash", console.log)
        .on("receipt", (receipt) => {
            resolve(receipt.contractAddress);
        })
        .on("error", (error) => {
            reject(error);
        });
    });
  
    return receiptPromise;
}

async function deployWithProxy(web3, contractABI, contractBytecode, proxyABI, proxyBytecode, config) {
    const contractAddress = await deployContract(
        web3,
        contractABI,
        contractBytecode,
        [],
        config
    );
    const proxyAddress = await deployContract(
        web3,
        proxyABI,
        proxyBytecode,
        [contractAddress],
        config
    );
    console.log(`Contract: ${contractAddress} , Proxy: ${proxyAddress}`);
    
    return new web3.eth.Contract(contractABI, proxyAddress);
}

async function deployWithProxyAndAdmin(web3, contractABI, contractBytecode, proxyABI, proxyBytecode, proxyAdmin, config) {
    const contractAddress = await deployContract(
        web3,
        contractABI,
        contractBytecode,
        [],
        config
    );
    const proxyAddress = await deployContract(
        web3,
        proxyABI,
        proxyBytecode,
        [contractAddress, proxyAdmin],
        config
    );
    console.log(`Contract: ${contractAddress} , Proxy: ${proxyAddress}`);
    
    return (await new web3.eth.Contract(contractABI, proxyAddress));
}

module.exports = {
    deployWithProxyAndAdmin,
    deployWithProxy,
    deployContract
}