import { ethers, network, upgrades } from "hardhat";
import { BigNumber as BN } from "bignumber.js";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { isAddress, keccak256 } from "ethers/lib/utils";
import { expect } from "chai";
import { Contract } from "ethers";
import dotenv from "dotenv";

dotenv.config();

type Balances = {
  user: string;
  balance: string;
};

type Counter = {
  address: string;
  balance: number;
  count: number;
  selectionProbability: string;
};

describe("Testing Epoch Selector", function () {
  let epochSelector: Contract;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let updater: SignerWithAddress;

  let numberOfClustersToSelect: number = 5;
  let numberOfAddressesWithLargeBalances = 1;
  let numberOfElementsInTree = 200 - numberOfAddressesWithLargeBalances;
  let numberOfSelections: number = 100;

  if (process.env.TEST_ENV == "prod") {
    numberOfAddressesWithLargeBalances = 10;
    numberOfClustersToSelect = 5;
    numberOfElementsInTree = 20000 - numberOfAddressesWithLargeBalances;
    numberOfSelections = 1000;
  }

  beforeEach(async () => {
    [admin, user, updater] = await ethers.getSigners();
    const blockNum = await ethers.provider.getBlockNumber();
    const blockData = await ethers.provider.getBlock(blockNum);

    const Pond = await ethers.getContractFactory("Pond");
    const pond = await upgrades.deployProxy(Pond, ["Marlin POND", "POND"], {
      kind: "uups",
    });

    let EpochSelector = await ethers.getContractFactory("EpochSelector");
    epochSelector = await EpochSelector.deploy(
      admin.address,
      numberOfClustersToSelect,
      blockData.timestamp,
      pond.address,
      new BN(10).pow(20).toString()
    );
  });

  it("Check deployment", async () => {
    expect(isAddress(epochSelector.address)).eq(true);
  });

  it("User can't insert", async () => {
    const address = randomAddressGenerator("1");
    let role = await epochSelector.UPDATER_ROLE();
    await expect(
      epochSelector.connect(user).insert(address, 1)
    ).to.be.revertedWith(
      `AccessControl: account ${user.address.toLowerCase()} is missing role ${role}`
    );
  });

  describe("Test after inserting", function () {
    beforeEach(async () => {
      let role = await epochSelector.UPDATER_ROLE();
      await epochSelector.connect(admin).grantRole(role, updater.address);
    });

    it("Add a number", async () => {
      const address = randomAddressGenerator("salt");
      await epochSelector.connect(updater).insert(address, 1);
      expect(await epochSelector.search(address)).eq(true);
    });

    it("Multiple entries", async () => {
      for (let index = 0; index < numberOfElementsInTree; index++) {
        const address = randomAddressGenerator("salt" + index);
        await epochSelector.connect(updater).insert(address, getRandomNumber());

        if (index % 100 == 0 || index == numberOfElementsInTree - 1) {
          console.log(`Elements in tree ${index}/${numberOfElementsInTree}`);
        }
      }

      const epochLength = parseInt(
        (await epochSelector.EPOCH_LENGTH()).toString()
      );

      await addAddressWithLargeBalance(
        numberOfAddressesWithLargeBalances,
        epochSelector,
        updater
      );

      let root = await epochSelector.root();
      let data = await epochSelector.callStatic.nodeData(root);
      const totalValueInTree = data.sumOfRightBalances
        .add(data.balance)
        .add(data.sumOfLeftBalances)
        .toString();

      let totalElementsInTree = (
        await epochSelector.callStatic.totalElements()
      ).toNumber();
      let counter: Counter[] = [];
      for (let index = 0; index < numberOfSelections; index++) {
        let selected = await getSelectedClusters(updater, epochSelector);
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
              selectionProbability: balToSelectionProbability(
                value.balance,
                totalValueInTree,
                numberOfClustersToSelect,
                totalElementsInTree
              ),
            });
          }
        });

        if (index % 10 == 0 || index == numberOfSelections - 1) {
          console.log(`Searches Complete ${index}/${numberOfSelections}`);
        }
      }
      counter = counter.sort((a, b) =>
        b.count == a.count ? b.balance - a.balance : b.count - a.count
      );
      console.table(
        counter.map((a) => {
          return {
            ...a,
            count: `${a.count}/${numberOfSelections}`,
          };
        })
      );
    });
  });
});

async function getSelectedClusters(
  account: SignerWithAddress,
  epochSelector: Contract
): Promise<Balances[]> {
  await epochSelector.connect(account).selectClusters();
  const clustersSelected = await epochSelector
    .connect(account)
    .callStatic.selectClusters();

  const balances: Balances[] = [];

  for (let index = 0; index < clustersSelected.length; index++) {
    const element = clustersSelected[index];
    const data = await epochSelector.callStatic.nodeData(element);

    balances.push({ user: element, balance: data.balance.toString() });
  }

  // console.table(balances);

  return balances;
}

function randomAddressGenerator(rand: string): string {
  let address = keccak256(Buffer.from(rand)).toString().slice(0, 42);
  return address;
}

function balToSelectionProbability(
  bal: string | number,
  total: string | number,
  numberOfClustersToSelect: string | number,
  totalElementsInTree: string | number
): string {
  const balance = new BN(bal);
  let totalBalance = new BN(total);
  const avgBalance = new BN(total).div(totalElementsInTree);

  let peNotSelected = new BN(1).minus(balance.dividedBy(totalBalance));

  for (let index = 0; index < numberOfClustersToSelect; index++) {
    totalBalance = totalBalance.minus(avgBalance);
    peNotSelected = peNotSelected.multipliedBy(
      new BN(1).minus(balance.dividedBy(totalBalance))
    );
  }
  return new BN(1).minus(peNotSelected).toPrecision(8);
}

function getRandomNumber(): number {
  return Math.floor(Math.random() * 10000000000000) + 1;
}

async function addAddressWithLargeBalance(
  numberOfAddressesWithLargeBalances: number,
  epochSelector: Contract,
  updater: SignerWithAddress
) {
  for (let index = 0; index < numberOfAddressesWithLargeBalances; index++) {
    const rndInt = Math.floor(Math.random() * 20) + 1;
    let largeBalAddress = randomAddressGenerator("some string" + index);

    let root = await epochSelector.root();
    let data = await epochSelector.callStatic.nodeData(root);
    let largeBalance = data.sumOfRightBalances
      .add(data.balance)
      .add(data.sumOfLeftBalances)
      .div(rndInt)
      .toString();

    await epochSelector.connect(updater).insert(largeBalAddress, "1");
    await epochSelector.connect(updater).update(largeBalAddress, largeBalance);
  }
}
