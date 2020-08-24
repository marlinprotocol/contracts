// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

uint endBlock;

// Note: This contract is chain specific as signature has to be verified
contract Producer {

    mapping(address => bool) producers;

    function join(address _producer) public {
        producers[_producer] = true;
    }

    function isProducer(address _producer) public returns(bool) {
        return producers[_producer];
    }
}