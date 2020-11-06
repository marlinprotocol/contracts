pragma solidity 0.5.17;

import "./StandardOracle.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";


contract AddressRegistry is StandardOracle {
    using BytesLib for bytes;

    address public offlineSigner;
    struct AddressPair {
        bytes32 stakingAddressHash;
        address ethereumAddress;
    }

    struct Signature {
        bytes32 hash;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    mapping(bytes32 => address) public addressList;
    mapping(address => bytes32) public reverseMap;

    event AddressRegistered(bytes32 indexed, address indexed);
    event AddressUnregistered(bytes32 indexed, address indexed);

    constructor(address _offlineSigner) public StandardOracle() {
        offlineSigner = _offlineSigner;
    }

    function addAddressBulk(
        bytes32[] memory _stakingAddressHashes,
        address[] memory ethereumAddresses
    ) public onlySource returns (bool) {
        require(
            _stakingAddressHashes.length != 0,
            "Array length should be non-zero"
        );
        require(
            _stakingAddressHashes.length == ethereumAddresses.length,
            "Arity mismatch"
        );
        for (uint256 index = 0; index < _stakingAddressHashes.length; index++) {
            require(
                addAddress(
                    _stakingAddressHashes[index],
                    ethereumAddresses[index]
                ),
                "Failed adding address"
            );
        }
        return true;
    }

    function removeAddress(bytes32 _stakingAddressHash)
        public
        onlySource
        returns (bool)
    {
        require(
            _stakingAddressHash != bytes32(0),
            "Should be a non-zero staking address hash"
        );
        address ethereumAddress = addressList[_stakingAddressHash];
        delete addressList[_stakingAddressHash];
        delete reverseMap[ethereumAddress];
        return true;
    }

    function addAddress(bytes32 _stakingAddressHash, address _ethereumAddress)
        public
        onlySource
        returns (bool)
    {
        require(
            _stakingAddressHash != bytes32(0),
            "Should be a non-zero staking address hash"
        );
        require(_ethereumAddress != address(0), "Should be a non-zero address");
        require(
            reverseMap[_ethereumAddress] == bytes32(0),
            "Cannot change existing address"
        );
        require(
            addressList[_stakingAddressHash] == address(0),
            "Cannot change existing address"
        );

        addressList[_stakingAddressHash] = _ethereumAddress;
        reverseMap[_ethereumAddress] = _stakingAddressHash;
        emit AddressRegistered(_stakingAddressHash, _ethereumAddress);
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
        require(
            a.stakingAddressHash != bytes32(0),
            "Should be a non-zero staking address hash"
        );
        require(
            a.ethereumAddress != address(0),
            "Should be a non-zero address"
        );
        require(
            reverseMap[a.ethereumAddress] == bytes32(0),
            "Cannot change existing address"
        );
        require(
            addressList[a.stakingAddressHash] == address(0),
            "Cannot change existing address"
        );
        addressList[a.stakingAddressHash] = a.ethereumAddress;
        reverseMap[a.ethereumAddress] = a.stakingAddressHash;
        emit AddressRegistered(a.stakingAddressHash, a.ethereumAddress);
        return true;
    }

    function extractBytes(bytes memory _bytes)
        internal
        pure
        returns (AddressPair memory)
    {
        bytes32 stakingAddressHash = _bytes.toBytes32(0);
        address mappedAddress = _bytes.toAddress(32);
        AddressPair memory a = AddressPair(stakingAddressHash, mappedAddress);
        return a;
    }

    function getSignature(bytes memory _data)
        internal
        pure
        returns (Signature memory)
    {
        //Image prefix to be decided by the team
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 messageHash = keccak256(abi.encodePacked(_data.slice(0, 52)));
        bytes32 _hash1 = keccak256(abi.encodePacked(prefix, messageHash));
        uint8 _v1 = _data.slice(52, 1).toUint8(0);
        bytes32 _r1 = _data.slice(53, 32).toBytes32(0);
        bytes32 _s1 = _data.slice(85, 32).toBytes32(0);
        Signature memory sig = Signature(_hash1, _v1, _r1, _s1);
        return sig;
    }
}
