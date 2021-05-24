const config = require("../config/config.json");

const fundAccount = async (PONDInstance, network, address, amount) => {
    await PONDInstance.methods.transfer(address, amount).send({
        from: config[network].tokens.pond.holder,
        gas: 500000
    })
}

const balanceOf = async (PONDInstance, address) => {
    return await PONDInstance.methods.balanceOf(address).call();
}

module.exports = {
    fundAccount,
    balanceOf
}