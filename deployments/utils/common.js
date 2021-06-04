const fs = require("fs");

const accountsPath = "../config/accounts.json";

const updateEntry = async (file, network, key, value) => {
    let data = JSON.parse(fs.readFileSync(file));
    data[network][key] = value;
    return new Promise((resolve, reject) => {
        fs.writeFile(file, JSON.stringify(data, null, 2), () => {
            resolve();
        });
    })
}

const loadAccounts = async(web3, network) => {
    const allAccounts = require(accountsPath);
    const accounts = allAccounts[network];
    for(let account in accounts) {
        await web3.eth.accounts.wallet.add(accounts[account]);
    }
    return web3;
}

module.exports = {
    updateEntry,
    loadAccounts
}