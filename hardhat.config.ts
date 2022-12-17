import '@nomiclabs/hardhat-ethers';
import "@nomiclabs/hardhat-etherscan";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-waffle";
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';
import dotenv from 'dotenv';


dotenv.config();

export default {
  networks: {
    hardhat: {
      accounts: {
        count: 350
      }
    },
    eth: {
      url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: process.env.ETH_DEPLOYER_KEY !== undefined ? [process.env.ETH_DEPLOYER_KEY] : undefined,
    },
    arb2: {
      url: "http://127.0.0.1:1248/",
      accounts: "remote",
      timeout: 600000,
    },
    arb1: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: process.env.ARBITRUM_DEPLOYER_KEY !== undefined ? [process.env.ARBITRUM_DEPLOYER_KEY] : undefined,
    },
    goerli: {
      url: "https://rpc.goerli.dev",
      accounts: process.env.GOERLI_DEPLOYER_KEY !== undefined ? [process.env.GOERLI_DEPLOYER_KEY] : undefined,
    },
    arbg: {
      url: "https://goerli-rollup.arbitrum.io/rpc",
      accounts: process.env.ARBITRUM_GOERLI_DEPLOYER_KEY !== undefined ? [process.env.ARBITRUM_GOERLI_DEPLOYER_KEY] : undefined,
    },
    arbRinkeby: {
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
    ei: {
      url: "https://goerli-rollup.arbitrum.io/rpc",
      accounts: process.env.ARBITRUM_GOERLI_DEPLOYER_KEY !== undefined ? [process.env.ARBITRUM_GOERLI_DEPLOYER_KEY] : undefined,
      tag: 'ei',
    },
  },
  solidity: {
    version: "0.8.17",
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
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      // arb1: process.env.ARBISCAN_API_KEY,
      arbg: process.env.ARBISCAN_API_KEY,
      // ftm: process.env.FTMSCAN_API_KEY,
    },
    customChains: [{
      network: "arbg",
      chainId: 421613,
      urls: {
        apiURL: "https://api-goerli.arbiscan.io/api",
        browserURL: "https://goerli.arbiscan.io",
      },
    }],
  },
};

