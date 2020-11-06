# Getting started

This repo contains token as well as protocol related smart contracts used in Marlin. 

1. Spin up an instance for running or testing the contracts. 
2. Make sure you have docker installed and execute the following command:
```
sh start.sh
```
3. If you are not using docker, make sure you have **truffle**, **node** 10.x installed on your device.
4. Use the following commands to compile and test the contracts.
```
truffle compile;
truffle test;
```

# MPOND token

MPOND is Marlin's governance and staking token. It can used to create and vote on proposals. It is also required to run a Marlin node.

## Specs
1. Total supply of MPOND is 10,000.
2. MPOND can be used to vote and create proposals, where 1 MPOND tokens = 1 vote (votes are fungible as tokens).
3. MPOND tokens delegated to other users will be locked.
4. Direct MPOND transfers will be locked except for whitelisted addresses (like the bridge and stakedrop contracts). Until universal transfers are enabled, only transfers to/from whitelisted addresses are possible.
5. MPOND can be converted to POND via the bridge.
6. If delegated, users will first have to undelegate the tokens before being able to make a transfer.

## Contract
Notable functions of the contract are described below:
* `addWhiteListAddress**(address _address)` adds a new address that is whitelisted for transfers and can only be invoked by admin.
* `enableAllTransfers()` enables anyone to transfers MPOND and can be only invoked by admin.
* `balanceOf`, `transfer`, `approve`, `transferFrom` functions, have same signatures as that of standard ERC20 Token contract
* Can delegate tokens to any address using `delegate(address delegatee, uint96 amount)` where `delegatee` is the address of the delegatee and `amount` is number of token to be delegated.
* To undelegate the tokens from any address use `undelegate(address delegatee, uint96 amount)`.
* `getCurrentVotes(address account)` returns the current votes that have been delegated to `account`.
* `getPriorVotes(address account, uint256 blockNumber)` returns the votes the delegated to `account` at a given `blockNumber`.

# Governance

## Specs
1. The governance contracts will be able to create any number of proposals.
2. Any users who has 1 or more delegated mPond should be able to successfully create proposal
3. A address can only have **1 Active proposal** at a time.
4. A proposal when created, should be in pending state by default, post 2 days will be in **Active** state.
5. Any address with any mPond self/delegated balance can cast vote on any proposal. Depending upon the transfers, the number of votes are different for different proposals. Only votes past creation of proposal will be considered for voting.
6. Voting will happen for 3 days.
7. Successful voting changes the state of proposal from **Active** to **Succeeded** . i.e if the proposal has gathered 4 mPond votes in 3 days. The state changes to *Succeeded*
8. If the proposal fails to gather sufficient votes, the state changes to **Defeated**
9. **Succeeded** will can be changed to **Queued** state by a contract call.
10. **Queued** proposal will be locked for 2 days. Within this time, the contract admin have right to **Reject** the proposal. If **Unrejected** it can **Executed**

Governance comprises of three contracts
* GovernorAlpha
* MPOND token contract
* Timelock

## MPOND token
Token contract for the Governance. [doc](#mpond-tokens)

## Governor Alpha
* A proposal can be using 1 mPond ( i.e 1 equivalent Votes) using method `function propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description)` where 
    * `targets` refer the target contracts that need to be updated
    * `values`, `signature`, `calldata` correspond to functions being called
    * `description` is an optional field that can be used to define the proposal
* When in **Active** state, the proposal can be voted using method `castVote(uint256 proposalId, bool support)` where
    * `proposalId` is the id of the existing proposal
    * `support` is the boolean parameter where `support=true` indicates that the address has voted **for** the proposal.
* A **Succeeded** Proposal can be passed to **Queued** state. When in **Queued** state it can be rejected by admin within 3 days. To queue a proposal call function `queue(uint256 proposalId)` where `proposalId` is the id of the existing proposal
* A **Queued Proposal** can be executed using `execute(uint256 proposalId)` where `proposalId` is the id of the existing proposal

## Timelock
Timelock contract is used for locking the Proposal in various stage of its cycle. It is used internally within GovernorAlpha.

# Stake Drop Contracts

The stake-drop happens via set of 3 oracles and a distribution contract. The purpose of the whole set of contracts is to distribute the mPond token to all registered-delegators who have been staking with the whitelisted validators.

### The oracles part of stake-drop are
* AddressRegistry.sol
* ValidatorRegistry.sol
* StakeRegistry.sol

### The distribution contract is 
* Distribution.sol

## Oracles
All the oracles are derived from a contract **StandardOracle.sol**. This act as a address based access registry for all the child contracts.

### StandardOracle
* Contains the mapping of addresses that have to access to pump the data to the contract. Mapping is defined as `mapping(address => bool) sources`
* The address that deploys the contract is a `source` by default
* Only an existing source can add a new source using method `addSource(address _newSource)` where `_newSource` is the address of the new source
* A source can renounce itself using method `renounceSource()`

### Validator Registry
ValidatorRegistry is derived from StandardOracle
#### Specs and contract
* Contains the mapping of whitelisted validators for every era in     `mapping(uint256 => mapping(bytes32 => bool)) validators` i.e.
```
isValidator = validators[era][validatorAddressHash]
//isValidator will be true if the particular address hash is validator in that era
```
* Validator Address's hash is used in the mapping, not the address itself. The hash can be computed using 
```
validatorAddressHash = web3.utils.keccak256(stakingAddress)
```

* Validators can be adding using `addValidator(uint256 epoch, bytes32 validatorAddressHash)` where 
    * `epoch` is the epoch/era number of the staking chain
    * `validatorAddressHash` is the hash of the validator's address
* Validator's can also be added in bulk using `addValidatorsBulk(uint256 epoch, bytes32[] memory validators)` where 
    * `epoch` is the epoch/era number of the staking chain
    * `validators` array is the list of validators in the array.
    * Note: *`addValidatorsBulk` will revert if even one of the validatorHash in the array is repeated*
* After adding validators, the list has to be frozen. This is prevent any further adding of validators accidentally. This is done via `freezeEpoch(uint256 epoch)` where
    * `epoch` is the epoch/era number of the staking chain
* Whenever a validator is successfully added `AddValidator**(uint256 indexed, bytes32 indexed)` event is emitted where
    * `uint256`, the first indexed param of event, is `epoch` number of the staking chain
    * `bytes32`, the second indexed param of event, is the `keccak256` hash of the validator address.

### Address Registry
AddressRegistry is derived from StandardOracle

#### Specs and contract
* Contains mapping of delegator's address hash and equivalent ethereum address. `mapping(bytes32 => address) addressList`, 
    * where `bytes32` is the `keccak256` hash of the delegator's `address`
* Also contains ethereum address and it's equivalent delegator's address hash `mapping(address => bytes32) reverseMap`, 
    * where `bytes32` is the `keccak256` hash of the delegator's `address`
* Address can added via one of the `source` address of the oracle using `addAddress(bytes32 stakingAddressHash, address ethereumAddress)` 
    * where `stakingAddressHash` is the `keccak256` hash of the delegator's `ethereumAddress`
* After successfull adding, event `AddressRegistered(bytes32 indexed, address indexed)` is emited where
    * `bytes32`, first param of the event, is the hash of the delegator's `stakingAddress`
    * `address`. second param of the event, is the eth/reward address of the delegator
* Address can be removed using `removeAddress**(bytes32 stakingAddressHash)` 
    * where `stakingAddressHash` is the `keccak256` is the hash of the delegator staking `address`

### Stake Registry
StakeRegistry is derived from StandardOracle

#### Specs and contract
* Stakes can be added only after validators list have been frozen the ValidatorRegistry contract
* Stakes can be added only after total stakes in the era have been updates. Method `addTotalStakeForEpoch(uint256 epoch, uint256 amount)`
    * where `epoch` is the epoch/era number of the respective chain
    * `amount` is the total stake put in that era
* Stakes can be added using method `addStake(uint256 epoch, bytes32 stakingAddressHash, bytes32 validatorAddressHash, uint256 amount)` 
    * where `epoch` is the epoch/era number of the respective chain
    * where `stakingAddressHash` is the `keccak256` hash of the delegator's address
    * `validatorAddressHash` is the `keccak256` hash of validator's address
    * `amount` is the delegator's stake
* Stakes can be added in bulk using `addStakeBulk(uint256 epoch, bytes32[] memory stakingAddresses, bytes32[] memory validatorAddresses, uint256[] memory amounts)`
    * where `epoch` is the epoch/era number of the respective chain
    * where `stakingAddresses` is the array of `keccak256` hashes of stakingAddresses of delegators
    * where `validatorAddresses` is the array of `keccak256` hashes of validators, matched against the arity of the `stakingAddresses` 
    * where `amounts` is the array of delegator's stake 
    * Note: *Only stakes which are delegated to whitelisted validators are rewarded*.
* On successful adding of stake `StakeAdded(uint256, bytes32, bytes32, uint256)` event is emitted where
    * `uint256`, first parameter of the event, is epoch/era number corresponding to the staking chain
    * `bytes32`, the second parameter of the event, is the delegator staking address `keccak256` hash
    * `bytes32`, thrid paramter of the event, is the validator's address hash corresponding w,r,t arity match.
    * `uint256`, the fourth paramter of the event, is the delegators stake in that era/epoch
* If the validatorAddress is not whitelisted, adding the stake is skipped. Event `StakeSkipped(uint256, bytes32, bytes32, uint256)` event is emitted. The event is similar to `StakeAdded`
* `rewardPerEpoch` is the total reward that is distributed to all delegators. This can only be changed by governance. 
* `mapping(bytes32 => uint256) rewardPerAddress` stores the reward that has to dispensed to every user where
    * `bytes32` refers to the `keccak256` hash of the delegators staking address
    * `uint256` is the reward earned that corresponding address hash

### Distribution
The contract depends on the above three oracles.

#### Specs and contract
* `mapping(bytes32 => uint256) claimedBalances` contains the balances withdrawn the delegator's address hash, where
    * `bytes32` refers to the delegator's address hash
    * `uint256` refers to the claimed/withdrawn balance
* `getUnclaimedAmount()` returns the available balance that can be dispensed. The function fetches the address hash from `AddressRegistry.sol` contract, where bidirectional map of `address hash` and `reward address` are stored
* `claimAmount()` transfers the reward tokens to the user.

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
