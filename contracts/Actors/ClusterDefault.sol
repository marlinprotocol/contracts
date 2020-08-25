// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

contract ClusterDefault {
    mapping(address => bool) relayers;

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