pragma solidity >=0.4.21 <0.7.0;

import "./StandardOracle.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";


contract AddressRegistry is StandardOracle {
    using BytesLib for bytes;

    address offlineSigner;
    struct AddressPair {
        bytes32 stakingAddressHash;
        address ethereumAddress;
        uint8 epoch;
    }
    struct Address {
        address ethereumAddress;
        uint8 epoch;
        uint256 timeStamp;
    }

    struct Signature {
        bytes32 hash;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    mapping(bytes32 => Address) addressList;

    event AddressRegistered(bytes32 indexed, address indexed, uint8 indexed);

    function getAddress(bytes32 _stakingAddress) public view returns (address) {
        return addressList[_stakingAddress].ethereumAddress;
    }

    function getStartEpoch(bytes32 _stakingAddress)
        public
        view
        returns (uint8)
    {
        return addressList[_stakingAddress].epoch;
    }

    function getTimestamp(bytes32 _stakingAddress)
        public
        view
        returns (uint256)
    {
        return addressList[_stakingAddress].timeStamp;
    }

    function addAddress(
        bytes32 _stakingAddress,
        address _ethereumAddress,
        uint8 _epoch
    ) public onlySource returns (bool) {
        Address memory a = Address(_ethereumAddress, _epoch, block.timestamp);
        addressList[_stakingAddress] = a;
        emit AddressRegistered(_stakingAddress, _ethereumAddress, _epoch);
        return true;
    }

    function registerAddress(bytes calldata _data) external returns (bool) {
        AddressPair memory a = extractBytes(_data);
        Signature memory sig = getSignature(_data);
        address _recovered = ecrecover(sig.hash, sig.v, sig.r, sig.s);
        require(
            _recovered == offlineSigner,
            "msg should be generated from signer"
        );
        Address memory _a = Address(
            a.ethereumAddress,
            a.epoch,
            block.timestamp
        );
        addressList[a.stakingAddressHash] = _a;
        emit AddressRegistered(
            a.stakingAddressHash,
            a.ethereumAddress,
            a.epoch
        );
        return true;
    }

    function extractBytes(bytes memory _bytes)
        internal
        pure
        returns (AddressPair memory)
    {
        bytes32 stakingAddressHash = _bytes.toBytes32(0);
        address mappedAddress = _bytes.toAddress(32);
        uint8 epoch = _bytes.toUint8(32);
        AddressPair memory a = AddressPair(
            stakingAddressHash,
            mappedAddress,
            epoch
        );
        return a;
    }

    function getSignature(bytes memory _data)
        internal
        pure
        returns (Signature memory)
    {
        //Image prefix to be decided by the team
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 messageHash = keccak256(abi.encodePacked(_data.slice(0, 54)));
        bytes32 _hash1 = keccak256(abi.encodePacked(prefix, messageHash));
        uint8 _v1 = _data.slice(54, 1).toUint8(0);
        bytes32 _r1 = _data.slice(55, 32).toBytes32(0);
        bytes32 _s1 = _data.slice(87, 32).toBytes32(0);
        Signature memory sig = Signature(_hash1, _v1, _r1, _s1);
        return sig;
    }
}
