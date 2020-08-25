// SPDX-License-Identifier: <SPDX-License>
import "@openzeppelin/upgrades/contracts/Initializable.sol";

pragma solidity >=0.4.21 <0.7.0;

contract ClusterDefault is Initializable {
    mapping(address => bool) relayers;

    function initialize() public {
        // if nothing to initialize remove this function and Intializable
    }

    function joinCluster() public {
        relayers[msg.sender] = true;
    }

    function exitCluster() public {
        relayers[msg.sender] = false;
    }

    function isRelayer(address _receiver) public view returns(bool) {
        return relayers[_receiver];
    }
}