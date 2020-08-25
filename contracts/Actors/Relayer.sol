// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

//TODO: Think if this is necessary, one argument can be we need registry of all relayers to choose from
contract Relayer is Initializable{

    function initialize() public {
        // if nothing to initialize remove this function and Intializable
    }

    function isValidRelayer(address _relayer) public returns(bool) {
        
    }
}