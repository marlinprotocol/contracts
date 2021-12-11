const config = require("../config/config.json");

const whitelist = async (MPONDInstance, network, address) => {
   await MPONDInstance.methods.addWhiteListAddress(address).send({
        from: config[network].tokens.mpond.admin,
        gas: 500000
    });
}

const fundAccount = async (MPONDInstance, network, address, amount) => {
    await MPONDInstance.methods.transfer(address, amount).send({
        from: config[network].tokens.mpond.holder,
        gas: 500000
    })
}

const getAdmin = async (MPONDInstance) => {
    return (await MPONDInstance.methods.admin().call());
}

module.exports = {
    whitelist,
    fundAccount,
    getAdmin
}