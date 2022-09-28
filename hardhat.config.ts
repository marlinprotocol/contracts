import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import "@nomiclabs/hardhat-etherscan";
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import dotenv from 'dotenv';


dotenv.config();

export default {
  networks: {
    eth: {
      url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: process.env.ETH_DEPLOYER_KEY !== undefined ? [process.env.ETH_DEPLOYER_KEY] : undefined,
    },
    arb1: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: process.env.ARBITRUM_DEPLOYER_KEY !== undefined ? [process.env.ARBITRUM_DEPLOYER_KEY] : undefined,
    },
    arbitrumRinkeby: {
      url: "https://rinkeby.arbitrum.io/rpc",
      accounts: process.env.ARBITRUM_RINKEBY_DEPLOYER_KEY !== undefined ? [process.env.ARBITRUM_RINKEBY_DEPLOYER_KEY] : undefined,
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: process.env.RINKEBY_DEPLOYER_KEY !== undefined ? [process.env.RINKEBY_DEPLOYER_KEY] : undefined,
    },
    ftm: {
      url: "https://rpc.ftm.tools/",
      accounts: process.env.FANTOM_DEPLOYER_KEY !== undefined ? [process.env.FANTOM_DEPLOYER_KEY] : undefined,
    },
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
    // apiKey: process.env.ETHERSCAN_API_KEY,
    // apiKey: process.env.ARBISCAN_API_KEY,
    apiKey: process.env.FTMSCAN_API_KEY,
  }
};

