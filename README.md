# Contracts

Spin up the instance for running and testing the contracts. Make sure you have docker installed.
```
sh start.sh
```

If you are not using docker, make sure you have **truffle**, **node** 10.x installed on your device.

Once spinned up using any of the above, use the following commands to compile and test the contracts.
```
truffle compile;
truffle test;
```

# MPond Tokens

mPond tokens are Marlin Governance Tokens. They can used to create and vote proposals.

## Specs
1. Total Number of mPond tokens are 10000.
2. mPond tokens can be used to vote and create proposals, where 1 mPond tokens = 1 vote (votes are fungible as tokens).
3. mPond tokens delegated to other users will be locked.
4. mPond transfers will be locked, except for selected addresses (like bridge, stakedrop contracts)
5. mPond can be converted to Pond via bridge.
6. Users will have to unlock the tokens before sending.
7. Till all transfers are enabled only transfers between whitelisted addresses is possible.

## Contract
* ***addWhiteListAddress**(address address)* adds address to whitelist. Can be invoked by admin
* ***enableAllTransfers**()* enables all transfers for mPond token. Can be only invoked by admin
* **balanceOf**, **transfer**, **approve**, **transferFrom** functions, have same signatures as that of standard ERC20 Token contract
* Can delegate tokens to any address using ***delegate**(address delegatee, uint96 amount)*
* To undelegate the tokens from any address use ***undelegate**(address delegatee, uint96 amount)*
* ***getCurrentVotes**(address account)* returns the current votes that have been delegated the address in function parameter.
* ***getPriorVotes**(address account, uint256 blockNumber)* returns the votes the delegated to the address at particular block number.

# Governance
Governance comprises of three contracts
* GovernorAlpha
* mPond token contract
* Timelock

## mPond Token Contracts
Token contract for the Governance. [doc](#mpond-tokens)

## Governor Alpha
* A proposal can be introduced using 1 mPond ( i.e 1 equivalent Votes) by calling method ***function** propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description)* where 
    * **targets** refer the target contracts that need to be updated
    * **values**, **signature**, **calldata** correspond to functions being called
    * **description** is an optional field that can be used to define the proposal
* Proposal when created is in **pending** state by default. The proposal goes to active state after 2 days (or fields defined in the contract).
* When in **Active** state, the proposal can be voted using method ***castVote**(uint256 proposalId, bool support)*
* A proposal that has gathered 4 mPond ( i.e 4 equivalent is passed) changes its state to **Success**.
* A **Succeeded Proposal** can be passed to **Queued** state. When in **Queued** state it can be rejected by admin within 3 days. To queue a proposal call function ***queue**(uint256 proposalId)*
* A **Queued Proposal** can be executed using ***execute**(uint256 proposalId)*

## Timelock
Timelock contract is used for locking the Proposal in various stage of its cycle. It is used internally within GovernorAlpha

# Stake Drop Contracts

The stake-drop happens via set of 3 oracles and a distribution contract. 
#### The oracles part of stake-drop are
* AddressRegistry.sol
* ValidatorRegistry.sol
* StakeRegistry.sol

#### The distribution contract is 
* Distribution.sol

## Oracles
All the oracles are derived from a contract **StandardOracle.sol**. This act as a address based access registry for the child contracts.

### StandardOracle
* Contains the mapping of addresses that have to access to pump the data to the contract. Mapping is defined as ***mapping(address => bool) sources;***
* Only an existing source can add a new source using method ***addSource**(address _newSource)*
* A source can renounce itself using method ***renounceSource**()*

### Validator Registry
ValidatorRegistry is derived from StandardOracle
* Contains the mapping of whitelisted validators for every era in     ***mapping(uint256 => mapping(bytes32 => bool)) validators;***
* Validator Address's hash is used to map.
* Validators can be adding using ***addValidator**(uint256 epoch, bytes32 validatorAddress)* or ***addValidatorsBulk**(uint256 epoch, bytes32[] memory validators)*
* After adding validators, the list has to be frozen with ***freezeEpoch**(uint256 epoch)*
* After successful adding, event ***AddValidator**(uint256 indexed, bytes32 indexed)* is emited

### Address Registry
AddressRegistry is derived from StandardOracle
* Contains mapping of delegator's address hash and equivalent ethereum address. ***mapping(bytes32 => address) addressList;***
* Also contains ethereum address and it's equivalent delegator's address hash ***mapping(address => bytes32) reverseMap;***
* Address can added via oracle source using ***addAddress**(bytes32 stakingAddressHash, address ethereumAddress)* or ***addAddressBulk**(bytes32[] memory stakingAddressHashes, address[] memory ethereumAddresses)*
* After successfull adding, event ***AddressRegistered**(bytes32 indexed, address indexed);* is emited
* Address can be removed using ***removeAddress**(bytes32 stakingAddressHash)*
* Addresses can be registered/un-registered via offline signer (ecrecover)

### Stake Registry
StakeRegistry is derived from StandardOracle
* Stakes can be added only after validators list have been frozen the ValidatorRegistry contract
* Stakes can be added only after total stakes in the era have been updates. Method ***addTotalStakeForEpoch**(uint256 epoch, uint256 amount)*
* Stakes can be added using method ***addStake**(uint256 epoch, bytes32 stakingAddressHash, bytes32 validatorAddressHash, uint256 amount)* or ***addStakeBulk**(uint256 epoch, bytes32[] memory stakingAddresses, bytes32[] memory validatorAddresses, uint256[] memory amounts)*
* **rewardPerEpoch** is the total reward that is distributed to all delegators. This can only be changed by governance. 
* Only stakes which are delegated to whitelisted validators are rewarded.
* If stake is added, **StakeAdded** event is emitted else **StakeSkipped** event is emitted
* **mapping(bytes32 => uint256) rewardPerAddress;** stores the reward that has to dispensed to every user

### Distribution
The contract depends on the above three oracles.
* The already dispensed tokens are stored in the contract and only remaining balance is dispensed. 
* *getUnclaimedAmount()* returns the available balance that can be dispensed.
* *claimAmount()* transfers the tokens.

# Bridge

Marlin protocol has Pond and mPond tokens as part of the token economics. 

Pond token is a simple ERC20 token which is transferable and can be used in staking. Rewards for work done is received as Pond Tokens.

1 mPond token is equivalent to 1 million Pond tokens. mPond tokens are non transferable between users. They are used in governance and when staked mPond users get higher rewards compared to equivalent amount of Pond staked.

A bridge contract is used to convert mPond to Pond and vice versa. 
## Pond to mPond conversion

Pond can be converted to mPond by sending Pond tokens to the bridge and an equivalent amount of mPond is received to the same address while burning the pond tokens.

## mPond to Pond conversion

Anyone at any time can lock MPOND and receive equivalent POND, however the bridge enforces a lockup when converting from MPOND to POND to ensure serious participation in important staking and governance functions.

mPond can be converted to Pond by requesting transfer on the bridge. After transfer request, there is a wait time of X blocks (aroud 6 months as of now) for the request to be accepted and mPond to be converted to Pond. During the wait time, the mPond cannot be used for staking but can be used for governance.

Only a portion of the mPond that is requested for transfer can be converted to Pond. This parameter is controlled by governance. This parameter known as "liquidity param($L$)" makes sure that there are always enough mPond to ensure that the security of the governance is not compromised. After every X blocks, a portion of mPond equivalent to $L$% of mPond requested for transfer is released. So if X and $L$ doesn't change, then user can transfer all the requested mPond to Pond in $\lceil{\frac{100}{L}}\rceil*X$ blocks.

A series of scenarios and the results of calls to requesting transfer and calls to convert is detailed [here](https://docs.google.com/spreadsheets/d/1AanmwfO9a7Dozo_ZA-Dec310d3kSJhYB-EslAnTIdyY/edit?usp=sharing).

## Bridge contract requirements

* Pond can be instantly converted into mPond(minted)(1MPOND = 10^6 POND)
* To convert mPond to Pond, there is a delay of atleast X blocks
* At any point, $min(100, liquidityRatio*floor[(time since request)/X])$ % of the total requested amount including all previous conversions for the request can be transferred to Pond.
* If POND/mPOND are staked, then they can’t be converted to each other.
* During wait period, MPOND can be used for governance
* User can partially/fully cancel conversion requests from MPOND to POND at any time, even after wait time is over as long as conversion is not completed.
* Current conversion requests and their details should be efficiently retrievable
* Bridge contract should be upgradable
