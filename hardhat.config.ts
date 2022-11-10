import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "hardhat-gas-reporter";

import dotenv from "dotenv";
import { task } from "hardhat/config";

import { BigNumber } from "bignumber.js";
import { privateKeys } from "./wallet";

dotenv.config();

task("balances", "Print the balances of all accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  let balances = [];
  for (const account of accounts) {
    balances.push({
      address: account.address,
      ethBalance: new BigNumber(await (await account.getBalance()).toString())
        .div(new BigNumber(10).pow(18))
        .toString(),
    });
  }
  console.table(balances);
});

function getHardhatPrivateKeys() {
  return privateKeys.map((key) => {
    const ONE_MILLION_ETH = "1000000000000000000000000";
    return {
      privateKey: key,
      balance: ONE_MILLION_ETH,
    };
  });
}

export default {
  networks: {
    hardhat : {
      accounts: {
        count: 100
      }
    },
    eth: {
      url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.ETH_DEPLOYER_KEY],
    },
    ganache: {
      url: "http://127.0.0.1:8545",
    },
    // hardhat: {
    //   forking: {
    //     url: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ARB_RPC_KEY}`,
    //     blockNumber: 32413976,
    //   },
    //   blockGasLimit: 29000000,
    //   accounts: getHardhatPrivateKeys(),
    //   live: true,
    //   tags: ['hardhat'],
    // },
    arb2: {
      url: "http://127.0.0.1:1248/",
      accounts: "remote",
      timeout: 600000,
    },
    arb1: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.ARBITRUM_DEPLOYER_KEY],
    },
    arbRinkeby: {
      url: "https://rinkeby.arbitrum.io/rpc",
      accounts: [process.env.ARBITRUM_RINKEBY_DEPLOYER_KEY],
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.RINKEBY_DEPLOYER_KEY],
    },
    ftm: {
      url: "https://rpc.ftm.tools/",
      accounts: [process.env.FANTOM_DEPLOYER_KEY],
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${process.env.GOERLI_RPC_KEY}`,
      accounts: [process.env.ARBITRUM_DEPLOYER_KEY]
    }
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
      // tried to use SMTChecker, gets killed, investigate later
      // modelChecker: {
      //   engine: "all",
      //   targets: [
      //     "assert",
      //     "overflow",
      //     "underflow",
      //     "divByZero",
      //     "constantCondition",
      //     "popEmptyArray",
      //     "outOfBounds",
      //     "balance",
      //   ],
      // },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    // apiKey: process.env.ARBISCAN_API_KEY,
    // apiKey: process.env.FTMSCAN_API_KEY,
  },
  mocha: {
    timeout: 1000000000,
  },
  gasReporter: {
    enabled: true,
    // outputFile: 'gasReport.md',
    // noColors: true,
    gasPrice: 100,
    currency: "USD",
    coinmarketcap: "c40041ca-81fa-4564-8f95-175e388534c1",
  },
};
