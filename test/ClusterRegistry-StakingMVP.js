const PONDToken = artifacts.require("TokenLogic.sol");
const PONDProxy = artifacts.require("TokenProxy.sol");

const MPONDToken = artifacts.require("MPondLogic.sol");
const MPONDProxy = artifacts.require("MPondProxy.sol");

const Stake = artifacts.require("StakeManager.sol");
const StakeProxy = artifacts.require("StakeManagerProxy.sol");

const RewardDelegators = artifacts.require("RewardDelegators.sol");
const RewardDelegatorsProxy = artifacts.require("RewardDelegatorsProxy.sol");

const ClusterRegistry = artifacts.require("ClusterRegistry.sol");
const ClusterRegistryProxy = artifacts.require("ClusterRegistryProxy.sol");

const PerfOracle = artifacts.require("ClusterRewards.sol");
const PerfOracleProxy = artifacts.require("ClusterRewardsProxy.sol");

const {BigNumber} = require("ethers/utils");
const appConfig = require("../app-config");
const truffleAssert = require("truffle-assertions");
const {AddressZero} = require("ethers/constants");

let clusterRegistry;

contract.only("Staking Flow", async function (accounts) {
  let PONDInstance;
  let MPONDInstance;
  let stakeContract;
  let perfOracle;
  let rewardDelegators;
  const bridge = accounts[2];
  const admin = accounts[1];
  const oracleOwner = accounts[10];
  const proxyAdmin = accounts[1];
  const rewardDelegatorsAdmin = accounts[2];
  const MPONDAccount = accounts[3];
  const registeredCluster = accounts[4];
  const registeredClusterRewardAddress = accounts[7];
  const unregisteredCluster = accounts[5];
  const unregisteredClusterRewardAddress = accounts[8];
  const deregisteredCluster = accounts[6];
  const deregisteredClusterRewardAddress = accounts[9];
  const registeredCluster1 = accounts[11];
  const registeredCluster2 = accounts[12];
  const registeredCluster3 = accounts[13];
  const registeredCluster4 = accounts[14];
  const delegator1 = accounts[15];
  const delegator2 = accounts[16];
  const delegator3 = accounts[17];
  const delegator4 = accounts[18];
  const clientKey1 = accounts[19];
  const clientKey2 = accounts[25];
  const stakeManagerOwner = accounts[20];
  const clusterRegistryOwner = accounts[21];
  const rewardDelegatorsOwner = accounts[22];
  const feeder = accounts[23];
  const dropBridgeAddress = accounts[24];
  
  let PONDTokenId;
  let MPONDTokenId;
  let ethereumNetworkID = web3.utils.keccak256("ETH");

  it("deploy stake contract and initialize tokens and whitelist stake contract", async () => {
    const PONDDeployment = await PONDToken.new();
    const pondProxyInstance = await PONDProxy.new(
      PONDDeployment.address,
      accounts[50]
    ); //assume that accounts-50 is proxy-admin
    PONDInstance = await PONDToken.at(pondProxyInstance.address);

    const MPONDDeployment = await MPONDToken.new();
    const MpondProxyInstance = await MPONDProxy.new(
      MPONDDeployment.address,
      accounts[50]
    ); //assume that accounts-50 is proxy-admin
    MPONDInstance = await MPONDToken.at(MpondProxyInstance.address);

    await PONDInstance.initialize(
      appConfig.PONDData.name,
      appConfig.PONDData.symbol,
      appConfig.PONDData.decimals,
      bridge
    );
    // accounts-21 is assumed to drop bridge address!..
    await MPONDInstance.initialize(MPONDAccount, bridge, accounts[21], {
      from: admin,
    });

    const stakeDeployment = await Stake.new();
    const stakeProxyInstance = await StakeProxy.new(
      stakeDeployment.address,
      proxyAdmin
    );
    stakeContract = await Stake.at(stakeProxyInstance.address);

    const clusterRegistryDeployment = await ClusterRegistry.new();
    const clusterRegistryProxy = await ClusterRegistryProxy.new(
      clusterRegistryDeployment.address,
      proxyAdmin
    );
    clusterRegistry = await ClusterRegistry.at(clusterRegistryProxy.address);

    const rewardDelegatorsDeployment = await RewardDelegators.new();
    const rewardDelegatorsProxy = await RewardDelegatorsProxy.new(
      rewardDelegatorsDeployment.address,
      proxyAdmin
    );
    rewardDelegators = await RewardDelegators.at(rewardDelegatorsProxy.address);

    const perfOracleDeployment = await PerfOracle.new();
    const perfOracleProxyInstance = await PerfOracleProxy.new(
      perfOracleDeployment.address,
      proxyAdmin
    );
    perfOracle = await PerfOracle.at(perfOracleProxyInstance.address);
    
    PONDTokenId = web3.utils.keccak256('POND')
    MPONDTokenId = web3.utils.keccak256('MPOND');

    await stakeContract.initialize(
      [PONDTokenId, MPONDTokenId],
      [PONDInstance.address, MPONDInstance.address],
      MPONDInstance.address,
      clusterRegistry.address,
      rewardDelegators.address,
      stakeManagerOwner,
      appConfig.staking.undelegationWaitTime
    );


    const selectors = [web3.utils.keccak256("COMMISSION_LOCK"),
    web3.utils.keccak256("SWITCH_NETWORK_LOCK"),
    web3.utils.keccak256("UNREGISTER_LOCK")];
    
    const lockWaitTimes = [4, 10, 22];

    await clusterRegistry.initialize(selectors, lockWaitTimes, clusterRegistryOwner);

    await rewardDelegators.initialize(
        stakeContract.address,
        perfOracle.address,
        clusterRegistry.address,
        rewardDelegatorsOwner,
        appConfig.staking.minMPONDStake,
        web3.utils.keccak256("MPOND"),
        PONDInstance.address,
        [PONDTokenId, MPONDTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
    )

    await perfOracle.initialize(
      oracleOwner, // oracleOwner,
      rewardDelegators.address,
      ["0xa486e4b27cce131bfeacd003018c22a55744bdb94821829f0ff1d4061d8d0533",
      "0x400c11d24cbc493052ef2bdd6a364730aa6ad3883b7e7d99ba40b34062cf1701",
      "0x9bd00430e53a5999c7c603cfc04cbdaf68bdbc180f300e4a2067937f57a0534f"],
      [100, 100, 100],
      appConfig.staking.rewardPerEpoch,
      MPONDInstance.address,
      appConfig.staking.payoutDenomination,
      feeder,
      10
    )

    assert(
      (await perfOracle.owner()) == oracleOwner,
      "Owner not correctly set"
    );

    await MPONDInstance.addWhiteListAddress(stakeContract.address, {
      from: admin,
    });
    assert(
      (await MPONDInstance.isWhiteListed(stakeContract.address),
      "StakeManager contract not whitelisted")
    );

    await MPONDInstance.addWhiteListAddress(rewardDelegators.address, {
      from: admin,
    });
    assert(
      (await MPONDInstance.isWhiteListed(rewardDelegators.address),
      "rewardDelegators contract not whitelisted")
    );

    await MPONDInstance.addWhiteListAddress(perfOracle.address, {
      from: admin,
    });
    assert(
      (await MPONDInstance.isWhiteListed(perfOracle.address),
      "StakeManager contract not whitelisted")
    );

    await MPONDInstance.transfer(
      perfOracle.address,
      appConfig.staking.rewardPerEpoch * 100,
      {
        from: MPONDAccount,
      }
    );

    await PONDInstance.mint(
      accounts[0],
      new BigNumber("100000000000000000000")
    );
  });

  it("Register cluster", async () => {});

  it("Register cluster with commission above 100", async () => {});

  it("Register an already registered cluster", async () => {});

  it("Register a deregistered cluster", async () => {});

  it("Update commission", async () => {});

  it("Update commission with value more than 100", async () => {});

  it("Update commission for a cluster that was never registered", async () => {});

  it("Update commission for a cluster that is deregistered", async () => {});

  it("Update reward address", async () => {});

  it("Update reward address for a cluster that was never registered", async () => {});

  it("Update reward address for a cluster that is deregistered", async () => {});

  it("Update client key", async () => {});

  it("Update client key for a cluster that was never registered", async () => {});

  it("Update client key for a cluster that is deregistered", async () => {});

  it("unregister cluster", async () => {});

  it("unregister cluster that was never registered", async () => {});

  it("unregister cluster that was already deregistered", async () => {});

  it("Check if cluster is valid", async () => {});

  it("check if cluster is active", async () => {});

  it("Delegator delegate and get rewards from a cluster", async () => {
    await clusterRegistry.register(
      ethereumNetworkID,
      10,
      registeredClusterRewardAddress,
      clientKey1,
      {
        from: registeredCluster1,
      }
    );
    await clusterRegistry.register(
      ethereumNetworkID,
      5,
      registeredClusterRewardAddress,
      clientKey2,
      {
        from: registeredCluster2,
      }
    );
    // 2 users delegate tokens to a cluster - one twice the other
    await delegate(
      delegator1,
      [registeredCluster1, registeredCluster2],
      [0, 4],
      [2000000, 0]
    );
    await delegate(
      delegator2,
      [registeredCluster1, registeredCluster2],
      [10, 0],
      [0, 2000000]
    );
    // data is fed to the oracle
    await feedData([registeredCluster1, registeredCluster2], 1);

    // do some delegations for both users to the cluster
    // rewards for one user is withdraw - this reward should be as per the time of oracle feed
    let MPondBalance1Before = await MPONDInstance.balanceOf(delegator1);
    await delegate(
      delegator1,
      [registeredCluster1, registeredCluster2],
      [0, 4],
      [2000000, 0]
    );
    let MPondBalance1After = await MPONDInstance.balanceOf(delegator1);
    console.log(
      MPondBalance1After.sub(MPondBalance1Before).toString(),
      appConfig.staking.rewardPerEpoch / 3
    );
    assert.equal(
      MPondBalance1After.sub(MPondBalance1Before).toString(),
        parseInt(
          appConfig.staking.rewardPerEpoch *
            (((((2.0 / 3) * 9) / 10) * 1) / 6 +
              ((((1.0 / 3) * 19) / 20) * 2) / 3)
        )
    );
    // feed data again to the oracle
    await feedData([
      registeredCluster,
      registeredCluster1,
      registeredCluster2,
      registeredCluster3,
      registeredCluster4,
    ], 1);
    // do some delegations for both users to the cluster
    let MPondBalance2Before = await MPONDInstance.balanceOf(delegator2);
    await delegate(
      delegator2,
      [registeredCluster1, registeredCluster2],
      [0, 4],
      [2000000, 0]
    );
    let MPondBalance2After = await MPONDInstance.balanceOf(delegator2);
    console.log(
      MPondBalance2After.sub(MPondBalance2Before).toString(),
      appConfig.staking.rewardPerEpoch *
        (((((2.0 / 3) * 9) / 10) * 5) / 6 +
          ((((1.0 / 3) * 19) / 20) * 1) / 3 +
          (((((7.0 / 12) * 9) / 10) * 5) / 7 +
            ((((5.0 / 12) * 19) / 20) * 1) / 5))
    );
    assert(
      MPondBalance2After.sub(MPondBalance2Before).toString() ==
        parseInt(
          appConfig.staking.rewardPerEpoch *
            (((((2.0 / 3) * 9) / 10) * 5) / 6 +
              ((((1.0 / 3) * 19) / 20) * 1) / 3 +
              (((((7.0 / 12) * 9) / 10) * 5) / 7 +
                ((((5.0 / 12) * 19) / 20) * 1) / 5))
        )
    );
  });

  it("Delegator withdraw rewards from a cluster", async () => {
      await redeploy();
      await clusterRegistry.register(ethereumNetworkID, 10, registeredClusterRewardAddress, clientKey1, {
          from: registeredCluster3
      });
      await clusterRegistry.register(ethereumNetworkID, 5, registeredClusterRewardAddress, clientKey2, {
          from: registeredCluster4
      });
      // 2 users delegate tokens to a cluster - one twice the other
      await delegate(delegator3, [registeredCluster3, registeredCluster4], [0, 4], [2000000, 0]);
      await delegate(delegator4, [registeredCluster3, registeredCluster4], [10, 0], [0, 2000000]);
      // data is fed to the oracle
      await advanceTime(web3, 10);
      await feedData([registeredCluster3, registeredCluster4], 8);
      // do some delegations for both users to the cluster
      // rewards for one user is withdraw - this reward should be as per the time of oracle feed
      let PondBalance3Before = await PONDInstance.balanceOf(delegator3);

      // transfer POND for rewards
      await PONDInstance.transfer(rewardDelegators.address, appConfig.staking.rewardPerEpoch*100);

      await rewardDelegators.withdrawRewards(delegator3, registeredCluster3);
      await rewardDelegators.withdrawRewards(delegator3, registeredCluster4);
      let PondBalance3After = await PONDInstance.balanceOf(delegator3);
      console.log(PondBalance3After.sub(PondBalance3Before).toString(), appConfig.staking.rewardPerEpoch/3);
      // assert(PondBalance3After.sub(PondBalance3Before).toString() == parseInt(appConfig.staking.rewardPerEpoch*(2.0/3*9/10*1/6+1.0/3*19/20*2/3)));
      // substract 1 from the reward calculation?
      assert.equal(PondBalance3After.sub(PondBalance3Before).toString(), parseInt(appConfig.staking.rewardPerEpoch*(2.0/3*9/10*1/2+1.0/3*19/20*1/2))-1);

      // feed data again to the oracle
      await delegate(delegator3, [registeredCluster3, registeredCluster4], [0, 4], [2000000, 0]);
      await advanceTime(web3, 10);
      await feedData([registeredCluster3, registeredCluster4], 3);
      // do some delegations for both users to the cluster
      let PondBalance4Before = await PONDInstance.balanceOf(delegator4);
      await delegate(delegator4, [registeredCluster3, registeredCluster4], [0, 4], [2000000, 0]);
      let PondBalance4After = await PONDInstance.balanceOf(delegator4);
      console.log(PondBalance4After.sub(PondBalance4Before).toString(), appConfig.staking.rewardPerEpoch*((2.0/3*9/10*1/2+1.0/3*19/20*1/2)+(7.0/12*9/10*1/2+5.0/12*19/20*1/2)));
      assert.equal(PondBalance4After.sub(PondBalance4Before).toString(), parseInt(appConfig.staking.rewardPerEpoch*((2.0/3*9/10*1/2+1.0/3*19/20*1/2)+(7.0/12*9/10*1/2+5.0/12*19/20*1/2)))-1);
      // assert(PondBalance4After.sub(PondBalance4Before).toString() == 0);
  });

  it("Delegator undelegate and get rewards from a cluster", async () => {
      await redeploy();
      await clusterRegistry.register(ethereumNetworkID, 10, registeredClusterRewardAddress, clientKey1, {
          from: registeredCluster1
      });
      await clusterRegistry.register(ethereumNetworkID, 5, registeredClusterRewardAddress, clientKey2, {
          from: registeredCluster2
      });

      // activate MPOND and POND tokens
      const stakeContractOwner = await stakeContract.owner();

      // 2 users delegate tokens to a cluster - one twice the other
      const stashes = await delegate(delegator1, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
      await delegate(delegator2, [registeredCluster1, registeredCluster2], [10, 0], [0, 2000000]);
      // data is fed to the oracle
      await advanceTime(web3, 10);
      await feedData([registeredCluster1, registeredCluster2], 4);
      // do some delegations for both users to the cluster
      // rewards for one user is withdraw - this reward should be as per the time of oracle feed
      let PondBalance1Before = await PONDInstance.balanceOf(delegator1);

      // transfer POND for rewards
      await PONDInstance.transfer(rewardDelegators.address,
        appConfig.staking.rewardPerEpoch*100);
      await stakeContract.undelegateStash(stashes[1], {
          from: delegator1
      });
      await stakeContract.undelegateStash(stashes[0], {
          from: delegator1
      });
      let PondBalance1After = await PONDInstance.balanceOf(delegator1);
      console.log(PondBalance1After.sub(PondBalance1Before).toString(), appConfig.staking.rewardPerEpoch/3);
      assert.equal(PondBalance1After.sub(PondBalance1Before).toString(), parseInt(appConfig.staking.rewardPerEpoch*(2.0/3*9/10*1/2+1.0/3*19/20*1/2))-1);

      // feed data again to the oracle
      await delegate(delegator1, [registeredCluster1, registeredCluster2], [0, 8], [4000000, 0]);
      await advanceTime(web3, 10);
      await feedData([registeredCluster, registeredCluster1, registeredCluster2, registeredCluster3, registeredCluster4], 5);
      // do some delegations for both users to the cluster
      let PondBalance2Before = await PONDInstance.balanceOf(delegator2);
      await delegate(delegator2, [registeredCluster1, registeredCluster2], [0, 4], [2000000, 0]);
      let PondBalance2After = await PONDInstance.balanceOf(delegator2);
      console.log("PondBalance2After: ", PondBalance2After);
      console.log(PondBalance2After.sub(PondBalance2Before).toString(), appConfig.staking.rewardPerEpoch*((2.0/3*9/10*1/2+1.0/3*19/20*1/2)+(7.0/12*9/10*1/2+5.0/12*19/20*1/2)));
      assert.equal(PondBalance2After.sub(PondBalance2Before).toString(), parseInt(appConfig.staking.rewardPerEpoch*((2.0/3*9/10*1/2+1.0/3*19/20*1/2)+(7.0/12*9/10*1/2+5.0/12*19/20*1/2)))-1);
      // assert(PondBalance2After.sub(PondBalance2Before).toString() == 0);
  });

  async function delegate(delegator, clusters, mpondAmounts, pondAmounts) {
      let totalPond = 0;
      let totalMPond = 0;
      for(let i=0; i < pondAmounts.length; i++) {
          totalPond += pondAmounts[i];
          totalMPond += mpondAmounts[i];
      }

      if(totalPond > 0) {
          await PONDInstance.transfer(delegator, totalPond);
          await PONDInstance.approve(stakeContract.address, totalPond, {
            from: delegator
          });
      }
      if(totalMPond > 0) {
          await MPONDInstance.transfer(delegator, totalMPond, {
            from: MPONDAccount
          });
          await MPONDInstance.approve(stakeContract.address, totalMPond, {
            from: delegator
          });
      }
      const stashes = [];

      for(let i=0; i < clusters.length; i++) {
        // console.log(tokenType[i], amounts[i], clusters[i]);

        let tokenIDs
        let amounts

        if (mpondAmounts[i] == 0){
            tokenIDs = [web3.utils.keccak256('POND')];
            amounts = [pondAmounts[i]];
        } else if (pondAmounts[i] == 0){
            tokenIDs = [web3.utils.keccak256('MPOND')];
            amounts = [mpondAmounts[i]];
        } else {
            tokenIDs = [web3.utils.keccak256('MPOND'), web3.utils.keccak256('POND')];
            amounts = [mpondAmounts[i], pondAmounts[i]];
        }
      
        // // transfer some rewards to rewardDelegators
        // await PONDInstance.transfer(rewardDelegators.address, 100000000);

        const allowance = await PONDInstance.allowance(delegator, stakeContract.address);
        const receipt = await stakeContract.createStashAndDelegate(
          tokenIDs, amounts, clusters[i], {
            from: delegator
        });
        stashes.push(receipt.logs[0].args.stashId);
      }
      return stashes;
  }

  // async function feedData(epoch, clusters) {
  //     const perf = [];
  //     for(let i=0; i < clusters.length; i++) {
  //         perf.push(100);
  //         // perf.push(parseInt(100*Math.random()));
  //     }

  //     await perfOracle.feed(epoch, clusters, perf, {
  //         from: oracleOwner
  //     });
  //     await perfOracle.closeFeed(epoch, {
  //         from: oracleOwner
  //     });
  //     await perfOracle.distributeRewards(epoch, clusters, {
  //         from: oracleOwner
  //     });
  //     await perfOracle.lockEpoch(epoch, {
  //         from: oracleOwner
  //     });
  // }

  async function feedData(clusters, epoch) {
      const stakes = [];
      let totalStake = new web3.utils.BN(0);
      let pondPerMpond = new web3.utils.BN(1000000);
      let payoutDenomination = new web3.utils.BN(appConfig.staking.payoutDenomination);
      for (let i = 0; i < clusters.length; i++) {
          const mpondClusterStake = await rewardDelegators.getClusterDelegation(clusters[i], MPONDTokenId);
          const pondClusterStake = await rewardDelegators.getClusterDelegation(clusters[i], PONDTokenId);
          const clusterStake = mpondClusterStake.mul(pondPerMpond).add(pondClusterStake);
          stakes.push(clusterStake);
          totalStake = totalStake.add(clusterStake);
      }
      
      const payouts = [];
      for (let i = 0; i < clusters.length; i++) {
          const stake = stakes[i];
          payouts.push(stake.mul(payoutDenomination).div(totalStake).toString())
      }

      console.log("clusters, epoch: ", clusters, epoch);
      console.log(payouts);
      const feeder = await perfOracle.feeder();
      await perfOracle.feed(ethereumNetworkID, clusters, payouts, epoch, {
          from: feeder
      });
  }

  async function redeploy() {
      const PONDDeployment = await PONDToken.new();
      const pondProxyInstance = await PONDProxy.new(PONDDeployment.address, proxyAdmin);
      PONDInstance = await PONDToken.at(pondProxyInstance.address);

      const MPONDDeployment = await MPONDToken.new();
      const MpondProxyInstance = await MPONDProxy.new(MPONDDeployment.address, proxyAdmin);
      MPONDInstance = await MPONDToken.at(MpondProxyInstance.address);

      await PONDInstance.initialize(
          appConfig.PONDData.name,
          appConfig.PONDData.symbol,
          appConfig.PONDData.decimals,
          bridge
      );
      await MPONDInstance.initialize(
          MPONDAccount,
          bridge,
          dropBridgeAddress,
          {
              from: admin
          }
      );

      const stakeDeployment = await Stake.new();
      const stakeProxyInstance = await StakeProxy.new(stakeDeployment.address, proxyAdmin);
      stakeContract = await Stake.at(stakeProxyInstance.address);

      const clusterRegistryDeployment = await ClusterRegistry.new();
      const clusterRegistryProxy = await ClusterRegistryProxy.new(clusterRegistryDeployment.address, proxyAdmin);
      clusterRegistry = await ClusterRegistry.at(clusterRegistryProxy.address);

      const rewardDelegatorsDeployment = await RewardDelegators.new();
      const rewardDelegatorsProxy = await RewardDelegatorsProxy.new(rewardDelegatorsDeployment.address, proxyAdmin);
      rewardDelegators = await RewardDelegators.at(rewardDelegatorsProxy.address);

      const perfOracleDeployment = await PerfOracle.new();
      const perfOracleProxyInstance = await PerfOracleProxy.new(perfOracleDeployment.address, proxyAdmin);
      perfOracle = await PerfOracle.at(perfOracleProxyInstance.address);

      const tokenIDs = [web3.utils.keccak256('MPOND'),
        web3.utils.keccak256('POND')];
      const tokenAddresses = [MPONDInstance.address, PONDInstance.address];

      await stakeContract.initialize(
        [PONDTokenId, MPONDTokenId],
        [PONDInstance.address, MPONDInstance.address],
        MPONDInstance.address,
        clusterRegistry.address,
        rewardDelegators.address,
        stakeManagerOwner,
        appConfig.staking.undelegationWaitTime
      );

      const selectors = [web3.utils.keccak256("COMMISSION_LOCK"),
      web3.utils.keccak256("SWITCH_NETWORK_LOCK"),
      web3.utils.keccak256("UNREGISTER_LOCK")];
      const lockWaitTimes = [1, 1, 1];

      await clusterRegistry.initialize(selectors, lockWaitTimes, proxyAdmin);

      const mpondTokenID = web3.utils.keccak256('MPOND');
      const rewardFactors = [1000000, 1];

      await rewardDelegators.initialize(
        stakeContract.address,
        perfOracle.address,
        clusterRegistry.address,
        rewardDelegatorsOwner,
        appConfig.staking.minMPONDStake,
        web3.utils.keccak256("MPOND"),
        PONDInstance.address,
        [PONDTokenId, MPONDTokenId],
        [appConfig.staking.PondRewardFactor, appConfig.staking.MPondRewardFactor]
      )

      const networkIDs = [ethereumNetworkID];
      const rewardWeight = [1];
      const feeder = oracleOwner;

      await perfOracle.initialize(
          oracleOwner,
          rewardDelegators.address,
          networkIDs,
          rewardWeight,
          appConfig.staking.rewardPerEpoch,
          PONDInstance.address,
          appConfig.staking.payoutDenomination,
          feeder,
          10
      );

      assert((await perfOracle.owner()) == oracleOwner, "Owner not correctly set");

      await MPONDInstance.addWhiteListAddress(stakeContract.address, {
          from: admin
      })
      assert((await MPONDInstance.isWhiteListed(stakeContract.address), "StakeManager contract not whitelisted"));

      // await MPONDInstance.addWhiteListAddress(rewardDelegators.address, {
      //     from: admin
      // })
      // assert((await MPONDInstance.isWhiteListed(rewardDelegators.address), "rewardDelegators contract not whitelisted"));

      // await MPONDInstance.addWhiteListAddress(perfOracle.address, {
      //     from: admin
      // })
      // assert((await MPONDInstance.isWhiteListed(perfOracle.address), "StakeManager contract not whitelisted"));

      await PONDInstance.mint(accounts[0], new BigNumber("100000000000000000000"));

      await PONDInstance.transfer(perfOracle.address, appConfig.staking.rewardPerEpoch*100);
  }
});
