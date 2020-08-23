pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "./Mintable.sol";


contract LGTToken is Initializable, ERC20, ERC20Detailed, Mintable {
    function initialize(
        string memory _name,
        string memory _symbol,
        uint8 _decimal,
        address tokenToBurn
    ) public initializer {
        ERC20Detailed.initialize(_name, _symbol, _decimal);
        Mintable.initialize(tokenToBurn);
    }
}
