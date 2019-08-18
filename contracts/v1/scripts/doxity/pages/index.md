# Smart Contracts for Marlin Network

### Install Dependencies
```
npm install -g truffle
npm install
```

### Compile
```
truffle compile
```

### Test
Run `testrpc` in a separate terminal (initialize with 20 accounts). Make sure it runs on port 8545
```
ganache-cli -a=20
```
Run test cases. If `testrpc` running on a different port, modify the `truffle.js` file contents for `development` network.
```
truffle test
```

### Documentation
Install dependencies
```
cd scripts/doxity
npm install
```

After editing the contract code, re-compile and publish the documentation (in the `marlin-contracts` directory)
```
npm run docs:compile
npm run docs:publish
```

Now start a local Gatsby server for the documentation at [localhost](http://localhost:8000)
```
npm run docs:develop
```

### Deploy on Local Network
```
truffle migrate --reset --network development
```

### Deploy on Private Network
Edit the `truffle.js` file to add private network details for `ourprivatenetwork`. Then,
```
truffle migrate --reset --network ourprivatenetwork
```
