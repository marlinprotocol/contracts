// SPDX-License-Identifier: <SPDX-License>
pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract Producer is Initializable{

    bytes id;
    bytes byteVersion;
    bytes id_extended;

    mapping(bytes32 => address) producerData;

    function initialize() public initializer {
        id = "\x19";
        byteVersion = "03";
        id_extended = "Ethereum Signed Message:\n";
    }

    function addProducer(address _producer, bytes memory _sig) public {
        bytes32 sigPayload = createPayloadToSig(_producer);
        address baseChainProducer = recoverSigner(sigPayload, _sig);
        bytes memory baseChainProducerAsBytes = abi.encodePacked(baseChainProducer);
        producerData[keccak256(baseChainProducerAsBytes)] = _producer;
    }

    function createPayloadToSig(address _producer) internal view returns(bytes32) {
        bytes memory sigMessage = abi.encodePacked(id, byteVersion, id_extended, int(40), _producer);
        return keccak256(sigMessage);
    }

    function getProducer(bytes memory _producer) public view returns(address) {
        return producerData[keccak256(_producer)];
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65);
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
        return ecrecover(message, v, r, s);
    }
}