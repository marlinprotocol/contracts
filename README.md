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

### Deploy on Local Network
```
truffle migrate --reset --network development
```

### Deploy on Private Network
Edit the `truffle.js` file to add private network details for `ourprivatenetwork`. Then,
```
truffle migrate --reset --network ourprivatenetwork
```
