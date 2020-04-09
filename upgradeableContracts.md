# Upgradable Contracts

The way upgradable contracts can be written can be classified in 2 different ways

1. Using a proxy contract that delegates the call to implementation contracts
2. Breaking down the contracts functionality into 3 different parts, such as *Data Contract*, *Flow Contract* and *Application Contract* and using a **Controller Contract** to govern the three. 


### *Simplest Way*

The simplest way you can upgrade a **Contract1** to **Contract2** keeping its state data same is by using a proxy contract with a *fallback* function where every method call/transaction is delegatedto the implementation contract. [Solidity/Delegatecall](https://solidity.readthedocs.io/en/v0.6.1/introduction-to-smart-contracts.html#delegatecall-callcode-and-libraries)

### Openzepplin

Openzepplin provides set of contracts. Install them using npm

> npm i -S @openzeppelin/upgrades

*Due to proxy based system, we cannot use constructors in the contracts. Hence, every contract that requires a constructor should implement a regular function (say **initialize**) where all setup logic is run.*

However, this ***initialise*** function should also be called once. Hence, openzeppelin provides ***initializer*** modifier.

``` 
pragma solidity ^0.5.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract MyContract is Initializable {
  uint256 public x;

  function initialize(uint256 _x) initializer public {
    x = _x;
  }
}
```

Since, the use of constructor is not possible, it is also not possible to use standard contracts like **@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol** Instead the modified version, which don't have any constructor and are replaced by initializer modifier, must be used. **@openzeppelin/contracts-ethereum-package/token/ERC20/ERC20Detailed.sol** contain has these contracts. A ERC20Detail.sol looks as looks
```
pragma solidity ^0.5.0;

contract ERC20Detailed is Initializable, IERC20 {
  string private _name;
  string private _symbol;
  uint8 private _decimals;

  function initialize(string name, string symbol, uint8 decimals) public initializer {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
  }

  ...
}
```

*Avoid setting the public variables value directly. It is equivalent of setting them in construtor. Use initializers*

```
pragma solidity ^0.5.0;

contract MyContract is Initializable {
  uint256 public hasInitialValue;
  function initialize() initializer public {
    hasInitialValue = 42;
  }
}
```

Pitfalls/Issues with

1.  It is completely ok if the malicious user calls the logic contracts directly, however, if there is a *selfdestrcut()* declared in the contract, for some reason, the malicious is able to hit the *selfdestruct()* of the logic contract, then all our contracts will be delegating the calls to address which won't have any code, effectively breaking the contracts.
2. The same can happen if there is another *delgatecall* in the logic contract to the malicious contract.
3. We cannot modify/remove the variable type in this case. Reason `eth.storageAt(address, index_of_the_variable_in_contract)` should always remain same. We can only add a new variable
4. If the proxy contract contains a logic contract address as it's first variable, then there will be storage conflict with first variable implemented in the logic contract. To avoid this, store the address in randomized slot. Explained in [EIP 1967](https://eips.ethereum.org/EIPS/eip-1967)
5. Multiple implementations can not have different order of variable declaration. The newly added variable must be added the last. If not taken care, this may lead to the same error as state in **Point 3**
6. Proxy Contract and the Logic Contract can have function conflict. Both can have functions like `changeOwner()` or `getAdmin()`. To avoid this, there can be logic implemented in fallback, or the delegate can happen only in the case of following condition

```
if(msg.sender is proxyAdmin)
    return getAdmin();
else
    delegatecall(logic_contract)
```

[Openzeppelin API docs](https://docs.openzeppelin.com/upgrades/2.8/api)