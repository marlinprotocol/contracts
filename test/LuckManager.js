const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");

const Luck = artifacts.require("LuckManager.sol");
const LuckProxy = artifacts.require("LuckManagerProxy.sol");

contract("Luck Manager", function (accounts) {
    let LuckInstance;
    let PotInstance;
    it("deploy all contracts", async function () {
		let potDeployment = await Pot.new();
		let potProxyInstance = await PotProxy.new(potDeployment.address);
		PotInstance = await Pot.at(potProxyInstance.address);
		let luckDeployment = await Luck.new();
		let luckProxyInstance = await LuckProxy.new(luckDeployment.address);
		LuckInstance = await Pot.at(luckProxyInstance.address);
	});
	
	it("Initialize all contracts" , async () => {

    });
    
    it("Check all initilization params", async () => {
        // 
    });

    it("initialize luck for a role", async () => {

    });

    it("Get luck for a specific epoch and role", async () => {

    });

    it("Change Role params with goverance", async () => {

    });
});