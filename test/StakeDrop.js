const AddressRegistry = artifacts.require("AddressRegistry.sol");
const StakeRegistry = artifacts.require("StakeRegistry.sol");
const ValidatorRegistry = artifacts.require("ValidatorRegistry.sol");
const Distribution = artifacts.require("Distribution.sol");
const mPondProxy = artifacts.require("mPondProxy.sol");
const mPondLogic = artifacts.require("mPondLogic.sol");
const web3Utils = require("web3-utils");

contract("Stake Drop testing", function (accounts) {
  var validatorInstance;
  var addressInstance;
  var stakeInstance;
  var tokenInstance;
  var distributionInstance;

  it("Deploy all contracts", function () {
    return ValidatorRegistry.new()
      .then(function (instance) {
        validatorInstance = instance;
        let offlineSigner = accounts[0];
        return AddressRegistry.new(offlineSigner);
      })
      .then(function (instance) {
        addressInstance = instance;
        let governance = accounts[0];
        return StakeRegistry.new(validatorInstance.address, governance);
      })
      .then(function (instance) {
        stakeInstance = instance;
        return mPondProxy.new(mPondLogic.address, {from: accounts[1]});
      })
      .then(function (proxyContract) {
        return mPondLogic.at(proxyContract.address);
      })
      .then(function (instance) {
        tokenInstance = instance;
        return Distribution.new(
          validatorInstance.address,
          stakeInstance.address,
          addressInstance.address,
          tokenInstance.address
        );
      })
      .then(function (instance) {
        distributionInstance = instance;
        return;
      });
  });

  it("Init proxy contracts", function () {
    let mPondAdmin = accounts[0];
    let bridgeAddress = accounts[10];
    return tokenInstance.initialize(mPondAdmin, bridgeAddress);
  });

  it("Validator Registry: add 2,2,3,4 validators in epochs 1,2,3,4", function () {
    let validator1 = web3Utils.keccak256("validator 1");
    let validator2 = web3Utils.keccak256("validator 2");
    let validator3 = web3Utils.keccak256("validator 3");
    let validator4 = web3Utils.keccak256("validator 4");
    // return validatorInstance.addValidator(1, validator1);
    return validatorInstance
      .addValidatorsBulk(1, [validator1, validator2])
      .then(function () {
        return validatorInstance.addValidatorsBulk(2, [validator1, validator2]);
      })
      .then(function () {
        return validatorInstance.addValidatorsBulk(3, [
          validator1,
          validator2,
          validator3,
        ]);
      })
      .then(function () {
        return validatorInstance.addValidatorsBulk(4, [
          validator1,
          validator2,
          validator3,
          validator4,
        ]);
      });
  });

  it("Freeze epochs", function () {
    return validatorInstance
      .freezeEpoch(1)
      .then(function () {
        return validatorInstance.freezeEpoch(2);
      })
      .then(function () {
        return validatorInstance.freezeEpoch(3);
      })
      .then(function () {
        return validatorInstance.freezeEpoch(4);
      });
  });

  it("Register delgators", function () {
    let delegator1 = web3Utils.keccak256("delegator 1");
    let delegator1EthAddress = accounts[11];
    return addressInstance
      .addAddressBulk([delegator1], [delegator1EthAddress])
      .then(function () {
        let delegator2 = web3Utils.keccak256("delegator 2");
        let delegator2EthAddress = accounts[12];
        let delegator3 = web3Utils.keccak256("delegator 3");
        let delegator3EthAddress = accounts[13];
        let delegator4 = web3Utils.keccak256("delegator 4");
        let delegator4EthAddress = accounts[14];
        let delegator5 = web3Utils.keccak256("delegator 5");
        let delegator5EthAddress = accounts[15];
        let delegator6 = web3Utils.keccak256("delegator 6");
        let delegator6EthAddress = accounts[16];
        let delegator7 = web3Utils.keccak256("delegator 7");
        let delegator7EthAddress = accounts[17];
        return addressInstance.addAddressBulk(
          [
            delegator2,
            delegator3,
            delegator4,
            delegator5,
            delegator6,
            delegator7,
          ],
          [
            delegator2EthAddress,
            delegator3EthAddress,
            delegator4EthAddress,
            delegator5EthAddress,
            delegator6EthAddress,
            delegator7EthAddress,
          ]
        );
      });
  });
  it("Add Stakes and checks", function () {
    let validator1 = web3Utils.keccak256("validator 1");
    let validator2 = web3Utils.keccak256("validator 2");
    let validator3 = web3Utils.keccak256("validator 3");
    let validator4 = web3Utils.keccak256("validator 4");

    let delegator1 = web3Utils.keccak256("delegator 1");
    let delegator2 = web3Utils.keccak256("delegator 2");
    let delegator3 = web3Utils.keccak256("delegator 3");
    let delegator4 = web3Utils.keccak256("delegator 4");
    let delegator5 = web3Utils.keccak256("delegator 5"); // assume he delegates to non-listed in 1st epoch
    return stakeInstance
      .addTotalStakeForEpoch(1, 1000)
      .then(function () {
        return stakeInstance.addStakeBulk(1, [delegator1], [validator1], [100]);
      })
      .then(function () {
        return stakeInstance.addStakeBulk(
          1,
          [delegator2, delegator3, delegator4, delegator5],
          [validator2, validator2, validator1, validator3],
          [200, 300, 400, 500]
        );
      })
      .then(function (transaction) {
        // console.log(transaction.tx);
        let [log2, log3, log4, log5] = transaction.logs;
        assert.equal(log2.event, "StakeAdded", "Event should StakeAdded");
        assert.equal(log3.event, "StakeAdded", "Event should StakeAdded");
        assert.equal(log4.event, "StakeAdded", "Event should StakeAdded");
        assert.equal(log5.event, "StakeSkipped", "Event should StakeAdded");
        return stakeInstance.rewardPerAddress(delegator1);
      })
      .then(function (reward) {
        assert.equal(
          reward,
          100000000000000000,
          "0.1 mPond should be the reward"
        );
        return stakeInstance.addTotalStakeForEpoch(3, 50000);
      })
      .then(function () {
        return stakeInstance.addStakeBulk(
          3,
          [delegator1, delegator2, delegator3, delegator4],
          [validator3, validator2, validator3, validator1],
          [40000, 5000, 4000, 1000]
        );
      })
      .then(function () {
        return stakeInstance.rewardPerAddress(delegator1);
      })
      .then(function (reward) {
        assert.equal(
          reward,
          900000000000000000,
          "0.9 mPond should be the reward"
        );
        return;
      });
  });

  it("Prepopulate the stakeDrop contract", function () {
    return tokenInstance.transfer(
      distributionInstance.address,
      new web3Utils.BN("100000000000000000000")
    );
  });

  it("withdraw balance", function () {
    let delegator1EthAddress = accounts[11];
    return distributionInstance
      .getUnclaimedAmount({from: delegator1EthAddress})
      .then(function (reward) {
        assert.equal(
          reward,
          900000000000000000,
          "0.9 mPond should be the reward"
        );
        return tokenInstance.enableAllTransfers();
      })
      .then(function () {
        return distributionInstance.claimAmount({from: delegator1EthAddress});
      })
      .then(function () {
        return distributionInstance.getUnclaimedAmount({
          from: delegator1EthAddress,
        });
      })
      .then(function (reward) {
        assert.equal(reward, 0, "No pending reward should be left");
        return tokenInstance.balanceOf(delegator1EthAddress);
      })
      .then(function (balance) {
        assert.equal(
          balance,
          900000000000000000,
          "0.9 mPond should be the balance"
        );
        return;
      });
  });
});
