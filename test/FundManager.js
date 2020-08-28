// Token
const LINProxy = artifacts.require("TokenProxy.sol");
const LINToken = artifacts.require("TokenLogic.sol");

const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");

const Fund = artifacts.require("FundManager.sol");
const FundProxy = artifacts.require("FundManagerProxy.sol");

contract("Fund Manager", function (accounts) {
    let LINInstance;
    let FundInstance;
    let PotInstance;
    it("deploy all contracts", async function () {
		let LINDeployment = await LINToken.new();
		let proxyInstance = await LINProxy.new(LINDeployment.address);
		LINInstance = await LINToken.at(proxyInstance.address);
		let potDeployment = await Pot.new();
		let potProxyInstance = await PotProxy.new(potDeployment.address);
		PotInstance = await Pot.at(potProxyInstance.address);
		let fundDeployment = await Fund.new();
		let fundProxyInstance = await FundProxy.new(fundDeployment.address);
		FundInstance = await Pot.at(fundProxyInstance.address);
	});
	
	it("Initialize all contracts" , async () => {

	});

	it("verify all initilized variables", async () => {
		// check MAX_INT
		// check LIN contraact
		// check governance  contract
	});

	it("update LIN allocation", async () => {
		// give allocation of LIN to fund
		// increase the allocation and check if unallocated balance and fund balance is getting updated
	});

	it("Check if fund creation works", async () => {
		// create a fund without governance
		// create a fund with governance but with more money than the unallocated balance
		// create fund with end epoch less than current epoch
		// create fund with end epoch equal to current epoch
		// create a fund with governance with money sufficient to create fund
		// check if innflation, endEpoch, lastDrawnEpoch and pot are correctly set
		// check if next inflation, next inflation update epoch and unclaimedwithdrawal are correctly set
	});

	it("Update Fund Inflation", async () => {
		// try updating inflation without governance
		// try to update inflation of past and current epoch
		// try to update inflation for a pot that doesn't exist
		// update inflation before the fund ends and with higher inflation such that unallocated balance is not sufficient
		// update inflation before the fund ends and with higher inflation such that unallocated balance is sufficient
		// update inflation before fund ends and with lower inflation
		// update inflation before a new inflation took effect
		// update inflation after a new inflation took effect but no one draw from pot, so wasn't updated
		// Fund a pot after it ended
		// update inflation after the fund ends
	});

	it("Update End epoch of fund", async () => {
		// try updating end epoch without governance
		// try updating inflation for a pot that doesn't exist
		// try updating end epoch in the past or current epoch
		// update end epoch if it is later than the current end epoch and there is no inflation update set
		// update end epoch if it is later than the current end epoch and there is inflation update set
		// update end epoch if it is before current end epoch and inflation update is before new end epoch
		// update end epoch if it is before current end epoch and inflation update is after new end epoch
	});

	it("update fund pot", async () => {
		// try updating fund pot without governance
		// update pot fund address with governance and without governance
		// check if previous fund was remove and new one was added
	});

	it("Draw from pot", async () => {
		// try draing from a pot that doesn't exist
		// try drawing from  a block which is already drawnn
		// try drawing when there was a inflation change after last drawn epoch to drawn block
		// try drawing when fund ended
		// try drawing when fund hasn't ended and check updated data as well as return value
	});
});
