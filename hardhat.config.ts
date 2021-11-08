import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';

export default {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
};

