let LINToken = artifacts.require("TokenLogic.sol");
let LINProxy = artifacts.require("TokenProxy.sol");

let Pot = artifacts.require("Pot.sol");
let PotProxy = artifacts.require("PotProxy.sol");


contract("Reward Pot", function (accounts) {    
    let LINInstance;
    let PotInstance;


    it("Deploy all contracts", () => {
        await LINProxy.deployed()
        .then(function (instance) {
            LINInstance = await LINToken.at(instance.address);
            return LINInstance;
        });
        await PotProxy.deployed()
        .then((instance) => {
            PotInstance = await Pot.at(instance.address);
            return PotInstance;
        });
    })

    it("Initialize Pot", () => {
        await LINInstance.initialize()
    })
});