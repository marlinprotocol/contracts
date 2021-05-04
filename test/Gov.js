const GovernorAlpha = artifacts.require("GovernorAlpha.sol");
const Timelock = artifacts.require("Timelock.sol");
const MPondProxy = artifacts.require("MPondProxy.sol");
const MPondLogic = artifacts.require("MPondLogic.sol");
const web3Utils = require("web3-utils");
// const TestingContract = artifacts.require("GovernanceTester.sol");

var govInstance;
var MPondInstance;
var timelockInstance;
var proposalId;
var testingInstance;

var governanceAddress;
var MPondAddress;
var timelockAddress;

contract.skip("Governance", function (accounts, network) {
  // address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description
  console.log(network);
  var tempAddress = accounts[9];
  var targets = [];
  const values = [0];
  const signatures = ["update(uint256)"];
  // const calldatas = [
  //   "0x0000000000000000000000000000000000000000000000000000000000000045",
  // ];
  const calldatas = [
    web3.eth.abi.encodeParameters(
      ["uint256"],
      ["0x0000000000000000000000000000000000000000000000000000000000000045"]
    ),
  ];
  const description = "This is a sample description";

  it("deploy contracts", function () {
    return GovernorAlpha.deployed()
      .then(function (instance) {
        govInstance = instance;
        governanceAddress = instance.address;
        return govInstance.MPond();
      })
      .then(function (address) {
        MPondAddress = address;
        return MPondLogic.at(MPondAddress);
      })
      .then(function (instance) {
        MPondInstance = instance;
        return govInstance.timelock();
      })
      .then(function (address) {
        timelockAddress = address;
        return Timelock.at(timelockAddress);
      })
      .then(function (instance) {
        timelockInstance = instance;
        return MPondInstance.initialize(
          accounts[4],
          accounts[11],
          accounts[12]
        ); //accounts[12] is assumed to temp x-chain bridge address
      })
      .then(function () {
        let valuesToCheck = {governanceAddress, MPondAddress, timelockAddress};
        console.log(valuesToCheck);
        return;
      });
  });
  it("Deploy a tesing instance which can be updated by governance, value 5", function () {
    return TestingContract.new(timelockInstance.address, 5)
      .then(function (instance) {
        testingInstance = instance;
        targets.push(testingInstance.address);
        return testingInstance.value();
      })
      .then(function (value) {
        assert.equal(value, 5, "Should be 5");
        return;
      });
  });
  it("check timelocks", function () {
    return timelockInstance.delay().then(function (delay) {
      // console.log("timelock delay", delay);
    });
  });

  it("check balances of MPond token and transfer MPond to other accounts", function () {
    return MPondInstance.balanceOf(accounts[4])
      .then(function () {
        return MPondInstance.transfer(
          accounts[6],
          new web3Utils.BN("100000000000000000000"),
          {
            from: accounts[4],
          }
        );
      })
      .then(function () {
        return MPondInstance.transfer(
          accounts[7],
          new web3Utils.BN("100000000000000000000"),
          {
            from: accounts[4],
          }
        );
      })
      .then(function () {
        return MPondInstance.transfer(
          accounts[8],
          new web3Utils.BN("100000000000000000000"),
          {
            from: accounts[4],
          }
        );
      })
      .then(function () {
        return MPondInstance.transfer(
          accounts[9],
          new web3Utils.BN("100000000000000000000"),
          {
            from: accounts[4],
          }
        );
      });
  });

  it("other users who have balances should also be able to delegate", function () {
    return MPondInstance.delegate(
      accounts[6],
      new web3Utils.BN("100000000000000000000"),
      {
        from: accounts[6],
      }
    )
      .then(function () {
        return MPondInstance.delegate(
          accounts[7],
          new web3Utils.BN("100000000000000000000"),
          {
            from: accounts[7],
          }
        );
      })
      .then(function () {
        return MPondInstance.delegate(
          accounts[8],
          new web3Utils.BN("100000000000000000000"),
          {
            from: accounts[8],
          }
        );
      })
      .then(function () {
        return MPondInstance.delegate(
          accounts[9],
          new web3Utils.BN("100000000000000000000"),
          {
            from: accounts[9],
          }
        );
      })
      .then(function () {
        return addBlocks(2, accounts);
      });
  });

  it("check current votes", function () {
    return MPondInstance.delegate(
      accounts[4],
      new web3Utils.BN("400000000000000000000"),
      {
        from: accounts[4],
      }
    ).then(function () {
      return MPondInstance.getCurrentVotes(accounts[4])
        .then(function (votes) {
          // console.log({votes});
          // assert latter

          // this transactions is only to increase the few block
          return addBlocks(2, accounts);
        })
        .then(async function () {
          let block = await web3.eth.getBlock("latest");
          return MPondInstance.getPriorVotes(accounts[4], block.number - 1);
        })
        .then(function (priorVotes) {
          // console.log(priorVotes);
          return;
        })
        .then(function () {
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
        return govInstance.castVote(proposalId, false, {from: accounts[6]});
      })
      .then(function () {
        return govInstance.castVote(proposalId, true, {from: accounts[7]});
      })
      .then(function () {
        return govInstance.castVote(proposalId, true, {from: accounts[8]});
      })
      .then(function () {
        return govInstance.castVote(proposalId, true, {from: accounts[9]});
      })
      .then(async function () {
        return govInstance.castVote(proposalId, true, {from: accounts[11]});
      })
      .then(function () {
        return govInstance.castVote(proposalId, true, {from: accounts[4]});
      })
      .then(function (transaction) {
        return govInstance.proposals(proposalId);
      })
      .then(async function (proposal) {
        // console.log("proposal, after cast vote by all accounts");
        // console.log(proposal);
        await addBlocks(200, accounts);
        return govInstance.state(proposalId);
      })
      .then(async function (state) {
        // console.log(
        //   "state for proposal after casting all votes and adding 20 blocks",
        //   state
        // );
        await govInstance.queue(proposalId); //account-3 is timelock admin
        return govInstance.proposals(proposalId);
      })
      .then(function (proposal) {
        // console.log("proposal, after queuing the proposal");
        // console.log(proposal);
        return govInstance.state(proposalId);
      })
      .then(function (state) {
        // console.log("state after queueing", state);
        return addBlocks(200, accounts);
      })
      .then(function () {
        return increaseTime(5 * 86400);
      })
      .then(function () {
        return addBlocks(1, accounts);
      })
      .then(function () {
        return govInstance.execute(proposalId);
      })
      .then(function (tx) {
        print(tx);
        return testingInstance.value();
      })
      .then(function (value) {
        assert.equal(value, 69, "Value should be 69");
        return;
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

async function increaseTime(time) {
  await web3.currentProvider.send(
    {
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time],
      id: 0,
    },
    () => {}
  );
}

function print(data) {
  console.log(JSON.stringify(data, null, 4));
}
