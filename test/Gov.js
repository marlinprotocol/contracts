const GovernorAlpha = artifacts.require("GovernorAlpha.sol");
const Timelock = artifacts.require("Timelock.sol");
const mPondLogic = artifacts.require("MPondLogic.sol");
const { time } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const web3Utils = require("web3-utils");
const ethers = require("ethers");

var govInstance;
var mPondInstance;
var timelockInstance;
var proposalId;

var governanceAddress;
var mPondAddress;
var timelockAddress;

contract("Governance", function (accounts, network) {
  // address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description
  // console.log(network);
  it("deploy contracts", function () {
    return GovernorAlpha.deployed()
      .then(function (instance) {
        govInstance = instance;
        governanceAddress = instance.address;
        return govInstance.mPond();
      })
      .then(function (address) {
        mPondAddress = address;
        return mPondLogic.at(mPondAddress);
      })
      .then(function (instance) {
        mPondInstance = instance;
        return govInstance.timelock();
      })
      .then(function (address) {
        timelockAddress = address;
        return Timelock.at(timelockAddress);
      })
      .then(function (instance) {
        timelockInstance = instance;
        return mPondInstance.initialize(
          accounts[4],
          accounts[11],
          accounts[12]
        ); //accounts[12] is assumed to temp x-chain bridge address
      })
      .then(async function () {
        let valuesToCheck = {governanceAddress, mPondAddress, timelockAddress};
        // console.log(valuesToCheck);
        return;
      });
  });

  it("check timelocks", function () {
    return timelockInstance.delay().then(function (delay) {
      // console.log("timelock delay", delay);
    });
  });

  it("check balances of mPond token and transfer mPond to other accounts", function () {
    return mPondInstance
      .balanceOf(accounts[4])
      .then(function () {
        return mPondInstance.transfer(accounts[6], new web3Utils.BN("3e23"), {
          from: accounts[4],
        });
      })
      .then(function () {
        return mPondInstance.transfer(accounts[7], new web3Utils.BN("3e23"), {
          from: accounts[4],
        });
      })
      .then(function () {
        return mPondInstance.transfer(accounts[8], new web3Utils.BN("3e23"), {
          from: accounts[4],
        });
      })
      .then(function () {
        return mPondInstance.transfer(accounts[9], new web3Utils.BN("3e23"), {
          from: accounts[4],
        });
      });
  });

  it("other users who have balances should also be able to delegate", function () {
    return mPondInstance
      .delegate(accounts[6], new web3Utils.BN("3e23"), {from: accounts[6]})
      .then(function () {
        return mPondInstance.delegate(accounts[7], new web3Utils.BN("3e23"), {
          from: accounts[7],
        });
      })
      .then(function () {
        return mPondInstance.delegate(accounts[8], new web3Utils.BN("3e23"), {
          from: accounts[8],
        });
      })
      .then(function () {
        return mPondInstance.delegate(accounts[9], new web3Utils.BN("3e23"), {
          from: accounts[9],
        });
      })
      .then(function () {
        return addBlocks(2, accounts);
      });
  });

  it("check current votes", function () {
    return mPondInstance
      .delegate(accounts[4], new web3Utils.BN("4000000000000000000"), {
        from: accounts[4],
      })
      .then(function () {
        return mPondInstance
          .getCurrentVotes(accounts[4])
          .then(function (votes) {
            // console.log({votes});
            // assert latter

            // this transactions is only to increase the few block
            return addBlocks(2, accounts);
          })
          .then(async function () {
            let block = await web3.eth.getBlock("latest");
            return mPondInstance.getPriorVotes(accounts[4], block.number - 1);
          })
          .then(function (priorVotes) {
            // console.log(priorVotes);
            return;
          })
          .then(async function () {

            // delegate 7k mponds
            await mPondInstance
            .delegate(accounts[11], new web3Utils.BN("7000000000000000000000"), {
              from: accounts[11] });

            // check votes
            const votesAcc11 = 
            await mPondInstance.getCurrentVotes(accounts[11]);
            console.log("votes for acc11: ", votesAcc11.toString());
            
            // helper function
            function encodeParameters(types, values) {
              const abi = new ethers.utils.AbiCoder();
              return abi.encode(types, values);
            }

            // tx to execute via governance
            const targets = [mPondAddress];
            const values = ["0"];
            const signatures = ["approve(address,uint256)"];
            const calldatas = [encodeParameters(['address', 'uint256'],
            [accounts[1], 1])];
            const description = "approve 1 mpond for acc 1";

            return govInstance.propose(
              targets,
              values,
              signatures,
              calldatas,
              description,
              {from: accounts[4]}
            );
          })
          .then(function (transaction) {
            // console.log(transaction.logs[0].args[0]);
            proposalId = transaction.logs[0].args[0];
            return;
          });
      });
  });

  it.skip("change timelock admins", function () {
    return timelockInstance
      .admin()
      .then(function (data) {
        // console.log(data);
        return timelockInstance.pendingAdmin();
      })
      .then(function (pendingAdmin) {
        // console.log(pendingAdmin);
        return timelockInstance.setPendingAdmin(governanceAddress, {
          from: accounts[3],
        });
      })
      .then(function () {
        return govInstance.__acceptAdmin({from: accounts[5]});
      });
  });

  it("check proposal actions", function () {
    return govInstance
      .getActions(proposalId)
      .then(function (actions) {
        // console.log("actions");
        // console.log(actions);
        return govInstance.state(proposalId);
      })
      .then(function (state) {
        // console.log("state");
        // console.log(state);
        return govInstance.proposals(proposalId);
      })
      .then(function (proposal) {
        // console.log("proposal, just after creation");
        // console.log(proposal);
      });
  });

  it("caste different votes and check the proposal", function () {
    return addBlocks(2, accounts)
      .then(function () {
        return govInstance.castVote(proposalId, true, {from: accounts[6]});
      })
      .then(function () {
        return govInstance.castVote(proposalId, true, {from: accounts[7]});
      })
      .then(async function () {
        const votesAcc4 = await mPondInstance.getCurrentVotes(accounts[4]);
        console.log(votesAcc4.toString());
        return govInstance.castVote(proposalId, true, {from: accounts[4]});
      })
      .then(async function () {
        return govInstance.castVote(proposalId, true, {from: accounts[11]});
      })
      .then(function () {
        return govInstance.castVote(proposalId, false, {from: accounts[9]});
      })
      .then(function (transaction) {
        return govInstance.proposals(proposalId);
      })
      .then(async function (proposal) {
        console.log("proposal, after cast vote by all accounts");
        console.log(proposal);
        console.log("Advancing 17210 blocks. Will take a while...");
        for (let i = 0; i < 17210; ++i) {
            await time.advanceBlock();
        };
        return govInstance.state(proposalId);
      })
      .then(async function (state) {
        // console.log("state", state);
        await govInstance.queue(proposalId); //account-3 is timelock admin
        return govInstance.proposals(proposalId);
      })
      .then(function (proposal) {
        console.log("proposal, after queuing the proposal");
        console.log(proposal);
        return govInstance.state(proposalId);
      })
      .then(function (state) {
        console.log("state after queueing", state);
        return time.increase(time.duration.days(3));
      })
      .then(function () {
        return govInstance.execute(proposalId);
      });
  });
});

async function increaseBlocks(accounts) {
  // this transactions is only to increase the few block
  return web3.eth.sendTransaction({
    from: accounts[1],
    to: accounts[2],
    value: 1,
  });
}

async function addBlocks(count, accounts) {
  for (let index = 0; index < count; index++) {
    await increaseBlocks(accounts);
  }
  return;
}
