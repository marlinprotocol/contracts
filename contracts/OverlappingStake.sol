pragma solidity ^0.6.1;
pragma experimental ABIEncoderV2;

import "./Stake.sol";
import "./BytesLib.sol";

contract OverlappingStake is Stake {
    using BytesLib for bytes;
    constructor(address _token) public Stake(_token) {

    }
    uint32 PRODUCER_STAKE_LOCKTIME = 10 minutes;
    uint256 STAKE_PER_BYTE = 10;
    uint256 stakeTransferPercent = 20;
    struct Attestation {
        uint32 messageId;
        uint16 channelId;
        Message message;
        Signature sig;
    }

    struct Signature {
        bytes32 hash;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Message {
        uint32 timestamp;
        uint32 messageSize;
        uint32 stakeOffset;
    }

    function reportOverlappingProducerStakes(bytes memory _attestation1, bytes memory _attestation2) public returns (bool){
        Attestation memory a1 = getAttestation(_attestation1);
        Attestation memory a2 = getAttestation(_attestation2);
        address add1 = ecrecover(a1.sig.hash, a1.sig.v, a1.sig.r, a1.sig.s);
        address add2 = ecrecover(a2.sig.hash, a2.sig.v, a2.sig.r, a2.sig.s);
        // require(add1 != address(0) && add2 != address(0), "Signatures should be valid");
        // require(add1 == add2, "Stakes from same address should be reported");
        return checkOverlappingProducerStakes(a1, a2);
    }

    function checkOverlappingProducerStakes(Attestation memory a1, Attestation memory a2) internal returns (bool){
        uint256 producerTimedifference;
        if(a1.message.timestamp > a2.message.timestamp){
            producerTimedifference = a1.message.timestamp - a2.message.timestamp;
        }else{
            producerTimedifference = a2.message.timestamp - a1.message.timestamp;
        }
		// require(producerTimedifference < PRODUCER_STAKE_LOCKTIME, "Duplicate Stake must be reported within set in time interval");
        
        uint256 attestation1StartStake = uint256(a1.message.stakeOffset);
		uint256 attestation1EndStake = attestation1StartStake + uint256(a1.message.messageSize) * STAKE_PER_BYTE;
        uint256 attestation2StartStake = uint256(a2.message.stakeOffset);
		uint256 attestation2EndStake = attestation2StartStake + uint256(a2.message.messageSize) * STAKE_PER_BYTE;
		if(max(attestation1StartStake, attestation2StartStake) <= min(attestation1EndStake, attestation2EndStake)){
            return true;
        }else{
            return false;
        }
    }

    function max(uint256 a, uint256 b) internal pure returns(uint256){
        if( a > b){
            return a;
        }else{
            return b;
        }
    }

    function min(uint256 a, uint256 b) internal pure returns(uint256){
        if( a < b){
            return a;
        }else{
            return b;
        }
    }
    function getAttestation(bytes memory _attestation1) internal returns (Attestation memory attestation){
        uint32 _messageId1 = _attestation1.slice(0, 4).toUint32(0);
        uint16 _channelId1 = _attestation1.slice(4, 2).toUint16(0);
        Attestation memory attestation = Attestation(_messageId1, _channelId1, getMessage(_attestation1), getSignature(_attestation1));
        return attestation;
    }
    function getMessage(bytes memory _attestation1) internal returns (Message memory){
        uint32 _timestamp1 = _attestation1.slice(6, 4).toUint32(0);
        uint32 _messageSize1 = _attestation1.slice(10, 4).toUint32(0);
        uint32 _stakeOffset1 = _attestation1.slice(14, 4).toUint32(0);
        Message memory m = Message(_timestamp1, _messageSize1, _stakeOffset1);
        return m;
    }
    function getSignature(bytes memory _attestation1) internal returns (Signature memory){
        bytes32 _hash1 = sha256(_attestation1.slice(0, 50));
        uint8 _v1 = _attestation1.slice(50, 1).toUint8(0);
        bytes32 _r1 = _attestation1.slice(51, 32).toBytes32(0);
        bytes32 _s1 = _attestation1.slice(83,32).toBytes32(0);
        Signature memory sig = Signature(_hash1, _v1, _r1, _s1);
        return sig;
    }

    function bytesToBytes32(bytes memory b, uint offset) private pure returns (bytes32) {
        bytes32 out;

        for (uint i = 0; i < 32; i++) {
            out |= bytes32(b[offset + i] & 0xFF) >> (i * 8);
        }
        return out;
    }

}