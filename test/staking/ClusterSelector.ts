import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber as BN } from "bignumber.js";
import { expect } from "chai";
import dotenv from "dotenv";
import { BigNumber } from "ethers";
import { isAddress, keccak256 } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import { ClusterSelector, Pond } from "../../typechain-types";
import { FuzzedAddress, FuzzedNumber } from "../../utils/fuzzer";
import { takeSnapshotBeforeAndAfterEveryTest } from "../../utils/testSuite";
import { getClusterSelector, getPond } from "../../utils/typechainConvertor";
import { BIG_ZERO, getRandomElementsFromArray, skipBlocks, skipTime } from "../helpers/common";

dotenv.config();

type Balances = {
  user: string;
  balance: string;
};

type Counter = {
  address: string;
  balance: number;
  count: number;
  expected_P_e: string;
};

let totalNumberOfElementsUsedInTest: number; //to be used globally on this test.

describe("Testing Epoch Selector", function () {
  let clusterSelector: ClusterSelector;
  let pondInstance: Pond;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let updater: SignerWithAddress;

  let numberOfClustersToSelect: number = 5;
  let numberOfAddressesWithLargeBalances = 10;
  let numberOfElementsInTree = 12 - numberOfAddressesWithLargeBalances;

  let numberOfSelections: number = 2; // number of trials

  totalNumberOfElementsUsedInTest = numberOfElementsInTree + numberOfAddressesWithLargeBalances;

  if (process.env.TEST_ENV == "prod") {
    numberOfAddressesWithLargeBalances = 10;
    numberOfClustersToSelect = 5;
    numberOfElementsInTree = 20000 - numberOfAddressesWithLargeBalances;
    numberOfSelections = 1000;
  }

  before(async () => {
    [admin, user, updater] = await ethers.getSigners();
    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });
    pondInstance = getPond(pond.address, admin);

    let ClusterSelector = await ethers.getContractFactory("ClusterSelector");
    let clusterSelectorContract = await upgrades.deployProxy(ClusterSelector, [
      admin.address,
      "0x000000000000000000000000000000000000dEaD",
      numberOfClustersToSelect,
      pond.address,
      new BN(10).pow(20).toString()
    ], {
      kind: "uups",
      constructorArgs: [blockData.timestamp, 4*60*60]
    });
    clusterSelector = getClusterSelector(clusterSelectorContract.address, admin);
  });

  takeSnapshotBeforeAndAfterEveryTest(async () => {});

  it("Check deployment", async () => {
    expect(isAddress(clusterSelector.address)).eq(true);
  });

  it("User can't insert", async () => {
    const address = randomAddressGenerator("1");
    let role = await clusterSelector.UPDATER_ROLE();
    await expect(clusterSelector.connect(user).insert_unchecked(address, 1)).to.be.revertedWith(
      `AccessControl: account ${user.address.toLowerCase()} is missing role ${role}`
    );
  });

  it("Check flushing tokens", async () => {
    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin", "POND"], { kind: "uups" });
    await pond.transfer(clusterSelector.address, new BN(10).pow(18).multipliedBy("10000000000").toFixed());

    await clusterSelector.connect(admin).flushTokens(pond.address, await user.getAddress()); // admin is reward controller in this suite
  });

  describe("Test after inserting", function () {
    before(async () => {
      let role = await clusterSelector.UPDATER_ROLE();
      await clusterSelector.connect(admin).grantRole(role, updater.address);
    });

    it("update reward token", async () => {
      const randomTokenAddress = ethers.utils.getAddress(FuzzedAddress.random());
      await expect(clusterSelector.connect(admin).updateRewardToken(randomTokenAddress))
        .to.emit(clusterSelector, "UpdateRewardToken")
        .withArgs(randomTokenAddress);
    });

    it("Add a number", async () => {
      const address = randomAddressGenerator("salt");
      await clusterSelector.connect(updater).insert_unchecked(address, 1);
      const index = await clusterSelector.callStatic.addressToIndexMap(address);
      const node = await clusterSelector.callStatic.nodes(index);
      expect(node.value).eq(1);
    });

    it("should fail: select clusters when not clusters selected in previous epoch", async () => {
      await skipTime(ethers, 5 * 4 * 3600);
      await skipBlocks(ethers, 1);

      const nextEpoch = (await clusterSelector.getCurrentEpoch()).add(1);

      await expect(clusterSelector.getClusters(nextEpoch)).to.be.revertedWith("6"); // 6 = cluster selection not complete.... try removing hardcoding
    });

    it("no cluster should be selected in 0th epoch", async () => {
      expect(await clusterSelector.getClusters(0)).to.be.empty;
    });

    it("update number of clusters to select", async () => {
      await expect(clusterSelector.connect(admin).updateNumberOfClustersToSelect(10))
        .to.emit(clusterSelector, "UpdateNumberOfClustersToSelect")
        .withArgs(10);
    });

    it("update missing clusters", async () => {
      const addresses = [];
      const balances = [];
      for (let index = 0; index < 20; index++) {
        const address = randomAddressGenerator("salt" + index);
        addresses.push(address);
        balances.push(getRandomNumber());
      }
      await clusterSelector.connect(updater).insertMultiple_unchecked(addresses, balances);

      await skipTime(ethers, 1 * 3600);
      await skipBlocks(ethers, 1);

      await clusterSelector.selectClusters();

      await skipTime(ethers, 6 * 3600);
      await skipBlocks(ethers, 1);

      const newEpoch = await clusterSelector.getCurrentEpoch();

      // make some random transaction
      await pondInstance.transfer(clusterSelector.address, 1);

      await clusterSelector.connect(updater).updateMissingClusters(newEpoch.sub(1));
    });

    it("Check token dispensation", async () => {
      const addresses = [];
      const balances = [];
      for (let index = 0; index < 20; index++) {
        const address = randomAddressGenerator("salt" + index);
        addresses.push(address);
        balances.push(getRandomNumber());
      }
      await clusterSelector.connect(updater).insertMultiple_unchecked(addresses, balances);

      await skipTime(ethers, 4 * 3600);
      await skipBlocks(ethers, 1);

      const reward = await clusterSelector.rewardForSelectingClusters();
      await pondInstance.transfer(clusterSelector.address, reward);

      await expect(() => clusterSelector.selectClusters()).to.changeTokenBalances(
        pondInstance,
        [admin, clusterSelector],
        [reward, BIG_ZERO.sub(reward)]
      );
    });

    it("if selection is missed, last selected clusters should ", async () => {
      const addresses = [];
      const balances = [];
      for (let index = 0; index < 20; index++) {
        const address = randomAddressGenerator("salt" + index);
        addresses.push(address);
        balances.push(getRandomNumber());
      }
      await clusterSelector.connect(updater).insertMultiple_unchecked(addresses, balances);

      await skipTime(ethers, 4 * 3600);
      await skipBlocks(ethers, 1);
      const currentEpoch = await clusterSelector.getCurrentEpoch();
      await clusterSelector.selectClusters();

      const selectionEpoch = currentEpoch.add(1);
      const clusters = await clusterSelector.getClusters(selectionEpoch);

      await skipTime(ethers, 4 * 3600);
      await skipBlocks(ethers, 1);

      const newEpoch = await clusterSelector.getCurrentEpoch();
      const newClusters = await clusterSelector.getClusters(newEpoch);

      for (let index = 0; index < newClusters.length; index++) {
        const element = newClusters[index];
        expect(clusters.includes(element)).to.be.true;
      }
    });

    it("Multiple entry call", async function () {
      this.timeout(100000);
      const addresses = [];
      const balances = [];
      for (let index = 0; index < 200; index++) {
        const address = randomAddressGenerator("salt" + index);
        addresses.push(address);
        balances.push(getRandomNumber());
      }

      await clusterSelector.connect(updater).insertMultiple_unchecked(addresses, balances);
    });

    it("Delete all elements from tree", async function () {
      this.timeout(300000);
      const addresses = [];
      const balances = [];
      for (let index = 0; index < 200; index++) {
        const address = randomAddressGenerator("salt" + index);
        addresses.push(address);
        balances.push(getRandomNumber());
      }

      await clusterSelector.connect(updater).insertMultiple_unchecked(addresses, balances);

      for (let index = 0; index < addresses.length; index++) {
        const element = addresses[index];
        await clusterSelector.connect(updater).delete_unchecked(element);
        if (index % 10 == 0) {
          await clusterSelector.connect(updater).deleteIfPresent(element);
        }
      }
    });

    it("check upsert", async function () {
      this.timeout(100000);
      const addresses = [];
      const balances = [];
      for (let index = 0; index < 200; index++) {
        const address = randomAddressGenerator("salt" + index);
        addresses.push(address);
        balances.push(getRandomNumber());
      }

      const sortedAddresses = addresses.filter((val, index) => index % 2 == 0);
      const sortedBalances = balances.filter((val, index) => index % 2 == 0);

      await clusterSelector.connect(updater).insertMultiple_unchecked(sortedAddresses, sortedBalances);
      await clusterSelector.connect(updater).upsertMultiple(
        addresses,
        balances.map((a) => FuzzedNumber.randomInRange(1, BigNumber.from(a).mul(10)))
      );

      await clusterSelector.connect(updater).upsert(getRandomElementsFromArray(addresses, 1)[0], FuzzedNumber.randomInRange(200, 2000));
    });

    it("delete if present", async function() {
      this.timeout(100000);
      const addresses = [];
      const balances = [];
      for (let index = 0; index < 200; index++) {
        const address = randomAddressGenerator("salt" + index);
        addresses.push(address);
        balances.push(getRandomNumber());
      }

      await clusterSelector.connect(updater).insertMultiple_unchecked(addresses, balances);

      const addressNotPresent = FuzzedAddress.random();
      // TODO
      // await expect(clusterSelector.connect(updater).delete_unchecked(addressNotPresent)).to.be.reverted;

      await clusterSelector.connect(updater).deleteIfPresent(addressNotPresent);
      await clusterSelector.connect(updater).deleteIfPresent(getRandomElementsFromArray(addresses, 1)[0]);
    });

    it("Total Clusters less than clusters to select", async () => {
      const MAX_ELEMS_AT_ONCE = 49;
      const allAddresses = [];
      let tempAddress: string[] = [];
      let balance: number[] = [];

      const noOfElements = Math.floor(Math.random() * numberOfClustersToSelect) + 1;
      for (let index = 0; index < noOfElements; index++) {
        const address = randomAddressGenerator("salt" + index);
        // await clusterSelector.connect(updater).insert_unchecked(address, getRandomNumber());
        tempAddress.push(address);
        balance.push(getRandomNumber());

        if (noOfElements > 100 && (index % 100 == 0 || index == noOfElements - 1)) {
          console.log(`Elements in tree ${index}/${noOfElements}`);
        }

        if (tempAddress.length >= MAX_ELEMS_AT_ONCE) {
          await clusterSelector.connect(updater).insertMultiple_unchecked(tempAddress, balance);
          tempAddress = [];
          balance = [];
        }
        allAddresses.push(ethers.utils.getAddress(address));
      }

      for (let index = 0; index < tempAddress.length; index++) {
        await clusterSelector.connect(updater).insert_unchecked(tempAddress[index], balance[index]);
      }

      await clusterSelector.selectClusters();
      const clustersSelected = await clusterSelector.callStatic.selectClusters();
      expect(clustersSelected.length).to.equal(allAddresses.length);
      for (let j = 0; j < clustersSelected.length; j++) {
        expect(allAddresses.includes(clustersSelected[j])).to.be.true;
      }
    });

    it("Multiple entries", async () => {
      const MAX_ELEMS_AT_ONCE = 59;
      const allAddresses = [];
      let tempAddress: string[] = [];
      let balance: number[] = [];

      for (let index = 0; index < numberOfElementsInTree; index++) {
        const address = randomAddressGenerator("salt" + index);
        // await clusterSelector.connect(updater).insert_unchecked(address, getRandomNumber());
        tempAddress.push(address);
        balance.push(getRandomNumber());

        if (numberOfElementsInTree > 200 && (index % 100 == 0 || index == numberOfElementsInTree - 1)) {
          console.log(`Elements in tree ${index}/${numberOfElementsInTree}`);
        }

        if (tempAddress.length >= MAX_ELEMS_AT_ONCE) {
          await clusterSelector.connect(updater).insertMultiple_unchecked(tempAddress, balance);
          tempAddress = [];
          balance = [];
        }

        allAddresses.push(address);
      }

      for (let index = 0; index < tempAddress.length; index++) {
        await clusterSelector.connect(updater).insert_unchecked(tempAddress[index], balance[index]);
      }

      const epochLength = parseInt((await clusterSelector.EPOCH_LENGTH()).toString());

      let largeAddresses = await addAddressWithLargeBalance(numberOfAddressesWithLargeBalances, clusterSelector, updater);

      for (let index = 0; index < largeAddresses.length; index++) {
        const element = largeAddresses[index];
        allAddresses.push(element.toLowerCase());
      }

      // element at index 1 is root
      let data = await clusterSelector.callStatic.nodes(1);
      const totalValueInTree = new BN(data.leftSum.toString()).plus(data.value.toString()).plus(data.rightSum.toString()).toFixed(0);

      let counter: Counter[] = [];

      for (let index = 0; index < numberOfSelections; index++) {
        let selected = await getSelectedClusters(updater, clusterSelector);
        await ethers.provider.send("evm_increaseTime", [epochLength + 1]);
        await ethers.provider.send("evm_mine", []);

        selected.forEach((value) => {
          const addresses = counter.map((a) => a.address);
          if (addresses.includes(value.user)) {
            let indexOfAddress = 0;
            for (let index = 0; index < addresses.length; index++) {
              const element = addresses[index];
              if (element == value.user) {
                indexOfAddress = index;
                break;
              }
            }
            counter[indexOfAddress].count += 1;
          } else {
            counter.push({
              address: value.user,
              count: 1,
              balance: parseInt(value.balance),
              expected_P_e: balToSelectionProbability(value.balance, totalValueInTree, numberOfClustersToSelect),
            });
          }
        });

        if (index % 100 == 0 || index == numberOfSelections - 1) {
          console.log(`Searches Complete ${index}/${numberOfSelections}`);
        }
      }

      counter = counter.sort((a, b) => (b.count == a.count ? b.balance - a.balance : b.count - a.count));
      console.table(
        counter.map((a) => {
          return {
            address: a.address,
            balance: a.balance,
            expected_P_e: a.expected_P_e,
            observed_P_e: a.count / numberOfSelections,
            diff: new BN(a.expected_P_e).minus(new BN(a.count).div(numberOfSelections)).toString(),
          };
        })
      );

      const unselected = await getUnSelectedClustersData(
        updater,
        clusterSelector,
        allAddresses,
        counter.map((a) => a.address)
      );
      let unselectedCounter: Counter[] = [];

      unselected.forEach((value) => {
        unselectedCounter.push({
          address: value.user,
          balance: parseInt(value.balance),
          count: 0,
          expected_P_e: balToSelectionProbability(value.balance, totalValueInTree, numberOfClustersToSelect),
        });
      });

      unselectedCounter = unselectedCounter.sort((a, b) => (b.count == a.count ? b.balance - a.balance : b.count - a.count));
      console.table(
        unselectedCounter.map((a) => {
          return {
            address: a.address,
            balance: a.balance,
            expected_P_e: a.expected_P_e,
            observed_P_e: a.count / numberOfSelections,
            diff: new BN(a.expected_P_e).minus(new BN(a.count).div(numberOfSelections)).toString(),
          };
        })
      );
    }).timeout(1000000);
  });
});

function containsDuplicates(array: string[]) {
  if (array.length !== new Set(array).size) {
    return true;
  }

  return false;
}

async function getUnSelectedClustersData(
  account: SignerWithAddress,
  clusterSelector: ClusterSelector,
  allAddresses: string[],
  selectedAddresses: string[]
): Promise<Balances[]> {
  allAddresses = allAddresses.map((a) => a.toLowerCase());
  selectedAddresses = selectedAddresses.map((a) => a.toLowerCase());

  const unselectedAddresses = [];
  for (let index = 0; index < allAddresses.length; index++) {
    const element = allAddresses[index];
    if (selectedAddresses.includes(element)) {
      continue;
    } else {
      unselectedAddresses.push(element);
    }
  }

  const balances: Balances[] = [];
  for (let index = 0; index < unselectedAddresses.length; index++) {
    const element = unselectedAddresses[index];

    const selectedNodeIndex = (await clusterSelector.callStatic.addressToIndexMap(element)).toString();
    const data = await clusterSelector.connect(account).callStatic.nodes(selectedNodeIndex);

    balances.push({ user: element, balance: data.value.toString() });
  }

  return balances;
}

async function getSelectedClusters(account: SignerWithAddress, clusterSelector: ClusterSelector): Promise<Balances[]> {
  await clusterSelector.connect(account).selectClusters();
  const clustersSelected = await clusterSelector.connect(account).callStatic.selectClusters();

  const balances: Balances[] = [];

  let selectedOnes = (clustersSelected as string[]).map((a) => a.toLowerCase());

  if (containsDuplicates(selectedOnes)) {
    console.log({ selectedOnes });
    throw new Error("Cluster is selected multiple times in same epoch");
  }

  for (let index = 0; index < clustersSelected.length; index++) {
    const element = clustersSelected[index];

    const selectedNodeIndex = (await clusterSelector.callStatic.addressToIndexMap(element)).toString();
    const data = await clusterSelector.callStatic.nodes(selectedNodeIndex);

    balances.push({ user: element, balance: data.value.toString() });
  }

  // console.table(balances);

  return balances;
}

function randomAddressGenerator(rand: string): string {
  let address = keccak256(Buffer.from(rand + new Date().valueOf().toString()))
    .toString()
    .slice(0, 42);
  return address;
}

function balToSelectionProbability(bal: string | number, total: string | number, numberOfClustersToSelect: string | number): string {
  const balance = new BN(bal);
  let totalBalance = new BN(total);
  const avgBalance = new BN(total).div(totalNumberOfElementsUsedInTest);

  let peNotSelected = new BN(1).minus(balance.dividedBy(totalBalance));

  for (let index = 0; index < numberOfClustersToSelect; index++) {
    totalBalance = totalBalance.minus(avgBalance);
    peNotSelected = peNotSelected.multipliedBy(new BN(1).minus(balance.dividedBy(totalBalance)));
  }
  return new BN(1).minus(peNotSelected).toPrecision(8);
}

function getRandomNumber(): number {
  const uint32max: number = 4294967295;

  return Math.floor((Math.random() * uint32max) / totalNumberOfElementsUsedInTest / 100) + 1; // divide by another 100 for safe side to avoid overflow.
}

async function addAddressWithLargeBalance(
  numberOfAddressesWithLargeBalances: number,
  clusterSelector: ClusterSelector,
  updater: SignerWithAddress
): Promise<string[]> {
  const addressesToNote: string[] = [];
  for (let index = 0; index < numberOfAddressesWithLargeBalances; index++) {
    const rndInt = Math.floor(Math.random() * ((numberOfAddressesWithLargeBalances * totalNumberOfElementsUsedInTest) / 100)) + 1;
    let largeBalAddress = randomAddressGenerator("some string" + index);

    // element at index 1 is root
    let data = await clusterSelector.callStatic.nodes(1);

    let largeBalance = new BN(data.leftSum.toString()).plus(data.value.toString()).plus(data.rightSum.toString()).div(rndInt).toFixed(0);

    await clusterSelector.connect(updater).insert_unchecked(largeBalAddress, "1");
    await clusterSelector.connect(updater).update_unchecked(largeBalAddress, largeBalance);

    addressesToNote.push(largeBalAddress);
  }

  return addressesToNote;
}
