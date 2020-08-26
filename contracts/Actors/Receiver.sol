// SPDX-License-Identifier: <SPDX-License>
pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract Receiver is Initializable{

    //TODO: Are we doing the governance thing to get receiver that staked on base chain ?
    
    constructor() public {
        // if nothing to initialize remove this function and Intializable
    }
    
    function isValidReceiver(address _receiver) public returns(bool) {

    }

    function getTotalReceivers() public returns(uint) {
        
    }
}