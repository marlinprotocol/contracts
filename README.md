All contracts are available in contracts folder. 
Token.sol is the ERC20 token contract. The contract deployer will be able to mint token and will be able to add new minters. Minters can revoke there minting roles.

Migrations folder is used to migrate (deploy) the smart contracts.

To initialize the token name, symbol and number of decimals, change the respecive values in migrations/2_token_migration.js file (initially set to "Merlin", "MER", 18 respectively).

Test folder contains all the test files which will be used to test smart contract functions in the development environment.

Vendor folder contains the third party (openzeppelin) contracts which are used in the contracts

truffle-config.js is the configuration file for the development and deployment environment.

Steps to deploy the contract:
1) Start the local node using Ganache in the system or if the deployment to be done on mainnet or testnet, make sure the node is running.
2) In case of Ganache (development), make sure the `port` in `networks.development` matches with that of the ganache port number. 
3) On terminal (or cmd) goto the project directory and type the following commands:
    > truffle compile // to compile the smart contracts
    
    > truffle migrate // migrate (deploy) the smart contract on development network

    In case, the network is different from development (ganache), then use the truffle migrate command with `--network` flag followed by the name of the network.


To test smart contracts before deployment, use command `truffle test` to perform the tests available in the test folder. 

