/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like truffle-hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */
const PrivateKeyProvider = require("truffle-privatekey-provider");
const privateKey =
"4b306d0ee52f310b23aafd093298b896755ac389fa169d99378f9becac5a6e71";
// Address of the above private key: 0x0AE167943B6d5bD1a1763Cb64d014a08c4125FA1

const privKeys = [
  "1b83be2fc81050af5c5ebc714105d87f52636edc01dc2c62257fef7f562fc654",
  "1eae96f17cfe5ca1995530ca9f3b595583d713052a6e3898f1e1c441e89eae51",
  "172d94caea195103ee412de2d0b1a9db3b1e83a027ad15483f3c66223eb3aa31",
];

const addresses = [
  "0xFC57cBd6d372d25678ecFDC50f95cA6759b3162b",
  "0xdeFF2Cd841Bd47592760cE068a113b8E594F8553",
  "0xAF2f0545245C13a4a3a8e4E597a2F4cf65B65088",
];

const HDWalletProvider = require("truffle-hdwallet-provider");
// const infuraKey = "fj4jll3k.....";
//
// const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim();

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
    },
    // mainnet: {
    //   provider: () => new HDWalletProvider("myth like bonus scare over problem client lizard pioneer submit female collect", `https://mainnet.infura.io/v3/f69c3698961e47d7834969e8c4347c1b`),
    //   port: 80,
    //   network_id: "*"
    // },
    // Another network with more advanced options...
    // advanced: {
    // port: 8777,             // Custom port
    // network_id: 1342,       // Custom network
    // gas: 8500000,           // Gas sent with each transaction (default: ~6700000)
    // gasPrice: 20000000000,  // 20 gwei (in wei) (default: 100 gwei)
    // from: <address>,        // Account to send txs from (default: accounts[0])
    // websockets: true        // Enable EventEmitter interface for web3 (default: false)
    // },
    kovan: {
      // provider: () => new PrivateKeyProvider(privateKey, "https://kovan.infura.io/v3/f69c3698961e47d7834969e8c4347c1b"),
      provider: () => new HDWalletProvider("myth like bonus scare over problem client lizard pioneer submit female collect", `https://kovan.infura.io/v3/f69c3698961e47d7834969e8c4347c1b`),
      network_id: 42,
      gas: 8000000,
      // timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
    },

    rinkeby: {
      host: "localhost", // Connect to geth on the specified
      port: 8545,
      from: "0xbb434d361c5ff56876826ac92e9eda834334aef5", // default address to use for any transaction Truffle makes during migrations
      network_id: 4,
      gas: 4612388, // Gas limit used for deploys
    },
    // Useful for deploying to a public network.
    // NB: It's important to wrap the provider as a function.
    // ropsten: {
    // provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/YOUR-PROJECT-ID`),
    // network_id: 3,       // Ropsten's id
    // gas: 5500000,        // Ropsten has a lower block limit than mainnet
    // confirmations: 2,    // # of confs to wait between deployments. (default: 0)
    // timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
    // skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    // },

    // Useful for private networks
    private: {
      host: "68.183.87.16", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gas: 4700000,
      gasPrice: 20000000000,
      confirmations: 6,
      timeoutBlocks: 2000,
      provider: () =>
        new HDWalletProvider(privKeys, "http://68.183.87.16:8545", 0, 3),
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    enableTimeouts: true,
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.17", // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 1000000,
        },
      },
    },
  },
};
