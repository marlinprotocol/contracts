// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract ClusterDefault is Initializable {
    mapping(address => bool) relayers;
    address admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can invoke the function");
        _;
    }

    function initialize(address _admin) public initializer {
        admin = _admin;
    }

    function addRelayer() public onlyAdmin {
        relayers[msg.sender] = true;
    }

    function removeRelayer() public onlyAdmin {
        relayers[msg.sender] = false;
    }

    function isRelayer(address _receiver) public view returns(bool) {
        return relayers[_receiver];
    }
}