const HDWalletProvider = require("truffle-hdwallet-provider");
const MNEMONIC = 'WALLET MNEMONIC';

module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!
    description: "Test Configuration",
    authors: [
        "Balaji Shetty Pachai <balaji.pachai08@gmail.com>"
    ],
    networks: {
        development: {
            name: "development",
            protocol: "http",
            host: "localhost",
            port: 8545,
            network_id: "7777",
            gas: 8000000,
            gasPrice: 1,
        },
        mainnet: {
            name: "mainnet",
            provider: function () {
                return new HDWalletProvider(MNEMONIC, "INFURA MAINNET ENDPOINT", 0, 10)
            },
            network_id: 1,
            gas: 8000000
        },
        ropsten: {
            name: "ropsten",
            provider: function () {
                return new HDWalletProvider(MNEMONIC, "INFURA ROPSTEN ENDPOINT", 0, 10)
            },
            network_id: 3,
            gas: 8000000
        },
        rinkeby: {
            name: "rinkeby",
            provider: function () {
                return new HDWalletProvider(MNEMONIC, "INFURA RINKEBY ENDPOINT", 0, 10)
            },
            network_id: 4,
            gas: 8000000,
        },
        goerli: {
            name: "goerli",
            provider: function () {
                return new HDWalletProvider(MNEMONIC, "INFURA GOERLI ENDPOINT", 0, 10)
            },
            network_id: 5,
            gas: 8000000
        },
        kovan: {
            name: "kovan",
            provider: function () {
                return new HDWalletProvider(MNEMONIC, "INFURA KOVAN ENDPOINT", 0, 10)
            },
            network_id: 42,
            gas: 8000000
        },
        coverage: {
            name: "coverage",
            host: "localhost",
            network_id: "*",
            port: 8555,    // <-- If you change this, also set the port option in .solcover.js.
            gas: 0xfffffffffff, // <-- Use this high gas value
            gasPrice: 0x01      // <-- Use this low gas price
        },
    },
    mocha: {
        useColors: true
    },
    compilers: {
        solc: {
            version: "0.6.1",
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    test_directory: "test",
    migrations_directory: "migrations",

};
