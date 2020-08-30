const LINToken = artifacts.require("TokenLogic.sol");
const LINProxy = artifacts.require("TokenProxy.sol");

const Pot = artifacts.require("Pot.sol");
const PotProxy = artifacts.require("PotProxy.sol");

const utils = require("web3-utils");
const truffleAssert = require("truffle-assertions");

const appConfig = require("../app-config");

contract("Reward Pot", async function (accounts) {
  let LINInstance;
  let PotInstance;
  let localConfig;

  it("Deploy all contracts", async () => {
    let LINDeployment = await LINToken.new();
    let proxyInstance = await LINProxy.new(LINDeployment.address);
    LINInstance = await LINToken.at(proxyInstance.address);
    let potDeployment = await Pot.new();
    let potProxyInstance = await PotProxy.new(potDeployment.address);
    PotInstance = await Pot.at(potProxyInstance.address);
  });

  it("Initialize Pot", async () => {
    await LINInstance.initialize(
      appConfig.LINData.name,
      appConfig.LINData.symbol,
      appConfig.LINData.decimals
    );
    await truffleAssert.reverts(
      LINInstance.initialize(
        appConfig.LINData.name,
        appConfig.LINData.symbol,
        appConfig.LINData.decimals
      )
    );
    let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
    let firstEpochStartBlock;
    let EthBlocksPerEpoch = appConfig.EthBlockPerEpoch;
    await web3.eth.getBlockNumber((err, blockNo) => {
      firstEpochStartBlock = blockNo + appConfig.potFirstEpochStartBlockDelay;
    });
    let roles = [];
    let distribution = [];
    let claimWaitEpochs = [];
    for (let role in appConfig.roleParams) {
      let currentRole = appConfig.roleParams[role];
      roles.push(currentRole.roleId);
      distribution.push(currentRole.allocation);
      claimWaitEpochs.push(currentRole.epochsToWaitForClaims);
    }

    localConfig = {
      firstEpochStartBlock,
      roles,
    };
    await PotInstance.initialize(
      governanceProxy,
      firstEpochStartBlock,
      EthBlocksPerEpoch,
      roles,
      distribution,
      [appConfig.LINData.id],
      [LINInstance.address],
      claimWaitEpochs
    );
    await truffleAssert.reverts(
      PotInstance.initialize(
        governanceProxy,
        firstEpochStartBlock,
        EthBlocksPerEpoch,
        roles,
        distribution,
        [appConfig.LINData.id],
        [LINInstance.address],
        claimWaitEpochs
      )
    );
  });

  it("check initilization variables", async () => {
    assert(
      localConfig.firstEpochStartBlock ==
        (await PotInstance.firstEpochStartBlock()),
      "firstEpochStartBlock wasn't set"
    );
    assert(
      appConfig.EthBlockPerEpoch == (await PotInstance.blocksPerEpoch()),
      "blocksPerEpoch wasn't set"
    );
    let {role, roleIndex} = getRole(-1);
    let roleId = await PotInstance.ids(role.roleId);
    assert(
      localConfig.roles[roleIndex] == roleId,
      `Role Ids not set, for index ${roleIndex} expected: ${localConfig.roles[roleIndex]}, got: ${roleId}`
    );
    let allocation = await PotInstance.potAllocation(
      localConfig.roles[roleIndex]
    );
    assert(
      role.allocation == allocation,
      `Pot allocation failed, for  ${localConfig.roles[roleIndex]} allocation expected: ${role.allocation}, got: ${allocation}`
    );
    let {epochsToWaitForClaims} = await PotInstance.claimWait(
      localConfig.roles[roleIndex]
    );
    assert(
      role.epochsToWaitForClaims == epochsToWaitForClaims,
      `Epochs to wait for claims not set, for ${localConfig.roles[roleIndex]} expected: ${role.epochsToWaitForClaims}, got: ${epochsToWaitForClaims}`
    );
    let tokenAddress = await PotInstance.tokens(appConfig.LINData.id);
    assert(
      tokenAddress == LINInstance.address,
      `TokenAddress not set, for tokenId ${appConfig.LINData.id}, expected: ${LINInstance.address}, got ${tokenAddress}`
    );
  });

  it("Governance decision implemented", async () => {
    let tempVerfierAddress = accounts[18];
    // add verifier
    await PotInstance.addVerifier(tempVerfierAddress, {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    assert(
      (await PotInstance.verifiers(tempVerfierAddress)) == true,
      "Governance unable to add verifier"
    );

    await truffleAssert.reverts(
      PotInstance.removeVerifier(tempVerfierAddress, {
        from: accounts[10],
      }),
      "Pot: Function can only be invoked by Governance Enforcer"
    );
    assert(
      (await PotInstance.verifiers(tempVerfierAddress)) == true,
      "Random account is able to remove verifiers"
    );
    // remove verifier
    await PotInstance.removeVerifier(tempVerfierAddress, {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    assert(
      (await PotInstance.verifiers(tempVerfierAddress)) == false,
      "Governance unable to remove verifier"
    );

    await truffleAssert.reverts(
      PotInstance.addVerifier(tempVerfierAddress, {from: accounts[10]}),
      "Pot: Function can only be invoked by Governance Enforcer"
    );
    assert(
      (await PotInstance.verifiers(tempVerfierAddress)) == false,
      "Random account is able to add verifiers"
    );
    // changeEpochsToWaitForClaims
    await PotInstance.changeEpochsToWaitForClaims(1217, 2, "0x0", {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    let claimWait = await PotInstance.claimWait("0x0");
    assert(
      claimWait.nextEpochsToWaitForClaims == 1217 &&
        claimWait.epochOfepochsToWaitForClaimsUpdate == 2,
      "Governance unable to change epochsToWaitForClaims"
    );

    await truffleAssert.reverts(
      PotInstance.changeEpochsToWaitForClaims(1000, 3, "0x0", {
        from: accounts[10],
      }),
      "Pot: Function can only be invoked by Governance Enforcer"
    );
    let claimWaitNonGov = await PotInstance.claimWait("0x0");
    assert(
      claimWaitNonGov.nextEpochsToWaitForClaims != 1000 &&
        claimWaitNonGov.epochOfepochsToWaitForClaimsUpdate != 3,
      "Random account is able to change epochsToWaitForClaims"
    );
    // changeEthBlocksPerEpoch
    await PotInstance.changeEthBlocksPerEpoch(142, {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    assert(
      (await PotInstance.blocksPerEpoch()) == 142,
      "Governance unable to change EthBlocksPerEpoch"
    );

    await truffleAssert.reverts(
      PotInstance.changeEthBlocksPerEpoch(172, {
        from: accounts[10],
      }),
      "Pot: Function can only be invoked by Governance Enforcer"
    );
    assert(
      (await PotInstance.blocksPerEpoch()) != 172,
      "Random account is able to change EthBlocksPerEpoch"
    );
    // allocatePot
    await PotInstance.allocatePot(["0x3", "0x4"], [20, 80], {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    assert(
      (await PotInstance.potAllocation("0x4")) == 80,
      "Governance unable to change allocations"
    );
    let roleData = getRole(0);
    assert(
      (await PotInstance.potAllocation(roleData.role.roleId)) == 0,
      "Previous allocation are still present"
    );

    await truffleAssert.reverts(
      PotInstance.allocatePot(["0x5", "0x6"], [61, 39], {
        from: accounts[10],
      }),
      "Pot: Function can only be invoked by Governance Enforcer"
    );
    assert(
      (await PotInstance.potAllocation("0x5")) != 61,
      "Random account is able to change allocation"
    );

    // add  testcase for   supportedcoinlist
  });

  it("check Epoch calculations", async () => {});

  it("check adding funds to pot", async () => {
    await before();
    await LINInstance.approve(PotInstance.address, 40);
    await truffleAssert.reverts(
      PotInstance.addToPot(
        [2, 3, 4],
        accounts[0],
        appConfig.LINData.id,
        [20, 32, 47],
        {
          from: accounts[appConfig.governanceProxyAccountIndex],
        }
      )
    );
    assert(
      await LINInstance.allowance(accounts[0], PotInstance.address) == 40,
      "Allowance not set correctly"
    );
    await LINInstance.approve(PotInstance.address, 99);
    await PotInstance.addToPot(
      [2, 3, 4],
      accounts[0],
      appConfig.LINData.id,
      [20, 32, 47],
      {
        from: accounts[20],
      }
    );
    let potValue = await PotInstance.getPotValue(4, appConfig.LINData.id);
    assert(potValue == 47, "Funds not added to pot");
  });

  it("check  pot allocation", async () => {
    await truffleAssert.reverts(
      PotInstance.allocatePot(["0x0", "0x1", "0x2"], [0, 17, 83])
    );
    await PotInstance.allocatePot(["0x0", "0x1", "0x2"], [0, 17, 83], {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    assert((await PotInstance.potAllocation("0x0")) == 0);
    assert((await PotInstance.potAllocation("0x2")) == 83);
  });

  it("check ticket claiming by verifier contracts", async () => {
    await PotInstance.addVerifier(accounts[10], {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    await truffleAssert.reverts(
      PotInstance.claimTicket(
        [
          appConfig.roleParams.producer.roleId,
          appConfig.roleParams.receiver.roleId,
        ],
        [accounts[12], accounts[13]],
        [5, 7, 9]
      )
    );
    await truffleAssert.reverts(
      PotInstance.claimTicket(
        [
          appConfig.roleParams.producer.roleId,
          appConfig.roleParams.receiver.roleId,
        ],
        [accounts[12], accounts[13]],
        [5, 7, 9],
        {
          from: accounts[10],
        }
      )
    );
    await PotInstance.claimTicket(
      [
        appConfig.roleParams.producer.roleId,
        appConfig.roleParams.receiver.roleId,
      ],
      [accounts[12], accounts[13]],
      [5, 7],
      {
        from: accounts[10],
      }
    );
    assert(
      (await PotInstance.getClaims(
        7,
        appConfig.roleParams.receiver.roleId,
        accounts[13]
      )) == 1
    );
    assert(
      (await PotInstance.getRemainingClaims(
        5,
        appConfig.roleParams.producer.roleId
      )) == 1
    );
    await PotInstance.claimTicket(
      [
        appConfig.roleParams.producer.roleId,
        appConfig.roleParams.receiver.roleId,
      ],
      [accounts[12], accounts[13]],
      [5, 5],
      {
        from: accounts[10],
      }
    );
    assert(
      (await PotInstance.getClaims(
        5,
        appConfig.roleParams.receiver.roleId,
        accounts[13]
      )) == 1
    );
    assert(
      (await PotInstance.getClaims(
        5,
        appConfig.roleParams.producer.roleId,
        accounts[12]
      )) == 2
    );
    assert(
      (await PotInstance.getRemainingClaims(
        5,
        appConfig.roleParams.producer.roleId
      )) == 2
    );
    await PotInstance.claimTicket(
      [
        appConfig.roleParams.producer.roleId,
        appConfig.roleParams.producer.roleId,
      ],
      [accounts[14], accounts[13]],
      [5, 5],
      {
        from: accounts[10],
      }
    );
    assert(
      (await PotInstance.getRemainingClaims(
        5,
        appConfig.roleParams.producer.roleId
      )) == 4
    );
    assert(
      (await PotInstance.getMaxClaims(
        5,
        appConfig.roleParams.producer.roleId
      )) == 4
    );
  });

  it("check fee reward claims by winners", async () => {
    await before();
    await PotInstance.changeEthBlocksPerEpoch(1, {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    let verifierAccount = accounts[10];
    await PotInstance.addVerifier(verifierAccount, {
      from: accounts[appConfig.governanceProxyAccountIndex],
    });
    // approve LIN to pot
    await LINInstance.approve(PotInstance.address, 99);
    let originalEpoch = await PotInstance.getEpoch(
      await web3.eth.getBlockNumber()
    );
    console.log(originalEpoch);
    await truffleAssert.reverts(
      PotInstance.changeEpochsToWaitForClaims(
        7,
        originalEpoch,
        appConfig.roleParams.receiver.roleId,
        {
          from: accounts[appConfig.governanceProxyAccountIndex],
        }
      ),
      "Pot: can't  change wait time for claims in previous epochs"
    );
    // this will be effected from next epoch
    await PotInstance.changeEpochsToWaitForClaims(
      7,
      originalEpoch + 2,
      appConfig.roleParams.receiver.roleId,
      {
        from: accounts[appConfig.governanceProxyAccountIndex],
      }
    );
    await PotInstance.addToPot(
      [originalEpoch],
      accounts[0],
      appConfig.LINData.id,
      [20],
      {
        from: accounts[20],
      }
    );
    await PotInstance.claimTicket(
      [
        appConfig.roleParams.producer.roleId,
        appConfig.roleParams.receiver.roleId,
      ],
      [accounts[12], accounts[13]],
      [originalEpoch, originalEpoch],
      {
        from: accounts[10],
      }
    );
    // Fails as wait time is not completed
    await truffleAssert.reverts(
      PotInstance.claimFeeReward(
        appConfig.roleParams.receiver.roleId, 
        [originalEpoch],
        {
          from: accounts[13],
        }
      ),
      "Pot: Fee can't be redeemed before wait time"
    );
    let currentEpoch = await PotInstance.getEpoch(
      await web3.eth.getBlockNumber()
    );
    console.log(currentEpoch);
    // 7 epochs passed at this epoch, so this is the edge case
    await truffleAssert.reverts(
      PotInstance.claimFeeReward(
        appConfig.roleParams.receiver.roleId,
        [originalEpoch],
        {
          from: accounts[13],
        }
      ),
      "Pot: Fee can't be redeemed before wait time"
    );
    // Should succeed as  wait time is done
    await PotInstance.claimFeeReward(
      appConfig.roleParams.receiver.roleId,
      [originalEpoch],
      {
        from: accounts[13],
      }
    );
    // Should fail as fee is already
    await truffleAssert.reverts(
      PotInstance.claimFeeReward(
        appConfig.roleParams.receiver.roleId,
        [originalEpoch],
        {
          from: accounts[13],
        }
      ),
      "Pot: No claims to redeem"
    );
    // This fails because random accounts doesn't have a fee to claim.
    await truffleAssert.reverts(
      PotInstance.claimFeeReward(appConfig.roleParams.receiver.roleId, [
        originalEpoch,
      ]),
      "Pot: No claims to redeem"
    );
    currentEpoch = await PotInstance.getEpoch(await web3.eth.getBlockNumber());
    console.log(currentEpoch);
  });

  async function before() {
    // Deploy
    let LINDeployment = await LINToken.new();
    let proxyInstance = await LINProxy.new(LINDeployment.address);
    LINInstance = await LINToken.at(proxyInstance.address);
    let potDeployment = await Pot.new();
    let potProxyInstance = await PotProxy.new(potDeployment.address);
    PotInstance = await Pot.at(potProxyInstance.address);
    // Initialize
    await LINInstance.initialize(
      appConfig.LINData.name,
      appConfig.LINData.symbol,
      appConfig.LINData.decimals
    );
    let governanceProxy = accounts[appConfig.governanceProxyAccountIndex];
    let firstEpochStartBlock;
    let EthBlocksPerEpoch = appConfig.EthBlockPerEpoch;
    await web3.eth.getBlockNumber((err, blockNo) => {
      firstEpochStartBlock = blockNo + 1;
    });
    let roles = [];
    let distribution = [];
    let claimWaitEpochs = [];
    for (let role in appConfig.roleParams) {
      let currentRole = appConfig.roleParams[role];
      roles.push(currentRole.roleId);
      distribution.push(currentRole.allocation);
      claimWaitEpochs.push(currentRole.epochsToWaitForClaims);
    }

    localConfig = {
      firstEpochStartBlock,
      roles,
    };
    await PotInstance.initialize(
      governanceProxy,
      firstEpochStartBlock,
      EthBlocksPerEpoch,
      roles,
      distribution,
      [appConfig.LINData.id],
      [LINInstance.address],
      claimWaitEpochs
    );
    await LINInstance.mint(
      accounts[0], 
      100000
    );
  }

  function getRole(roleIndex) {
    if (roleIndex < 0 || roleIndex >= localConfig.roles.length) {
      roleIndex = parseInt(Math.random() * localConfig.roles.length);
    }
    if (roleIndex == localConfig.roles.length) {
      roleIndex = 0;
    }
    console.log(Object.keys(appConfig.roleParams)[roleIndex]);
    let role =
      appConfig.roleParams[Object.keys(appConfig.roleParams)[roleIndex]];
    return {role, roleIndex};
  }
});
