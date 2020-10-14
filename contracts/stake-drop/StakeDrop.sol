pragma solidity >=0.4.21 <0.7.0;

import "./SafeMath.sol";
import "../governance/Comp.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";


contract StakeDrop {
    using SafeMath for uint256;
    using BytesLib for bytes;

    struct Signature {
        bytes32 hash;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct WithdrawlParams {
        uint32 chainType;
        bytes32 stakingAddressHash;
        uint32 currentWithdrawlId;
        address mappedAddress;
        uint256 withdrawlAmount;
    }

    address admin;
    address signer;
    Comp comp;
    mapping(address => uint256) etherDeposits;
    mapping(address => uint256) withdrawnBalances;
    //chainNumber -> address -> externalNonce
    mapping(uint32 => mapping(bytes32 => uint32)) withdrawlCounts;

    event Withdraw(
        uint32 indexed chainType,
        bytes32 indexed stakingAddressHash,
        uint32 indexed withdrawlId,
        uint256 value
    );

    constructor(address _signer, address _tokenAddress) public {
        admin = msg.sender;
        signer = _signer;
        comp = Comp(_tokenAddress);
    }

    function deposit() public payable {
        etherDeposits[msg.sender].add(msg.value);
    }

    function depositTokens(uint256 amount) public {
        comp.transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address _address, uint256 _amount) public {
        require(msg.sender == signer, "Should be only called by signer");
        comp.transfer(_address, _amount);
    }

    function withdrawUsingSig(bytes calldata _bytes) external returns (bool) {
        WithdrawlParams memory w = extractBytes(_bytes);
        Signature memory sig = getSignature(_bytes);
        address _recovered = ecrecover(sig.hash, sig.v, sig.r, sig.s);

        uint32 lastWithdrawlId = withdrawlCounts[w.chainType][w
            .stakingAddressHash];

        require(_recovered == signer, "msg should be generated from signer");
        require(
            w.currentWithdrawlId == lastWithdrawlId + 1,
            "withdrawls must be sequential"
        );
        require(
            w.mappedAddress == msg.sender,
            "Only sender can claim his rewards"
        );
        withdrawlCounts[w.chainType][w.stakingAddressHash] = w
            .currentWithdrawlId;
        comp.transfer(msg.sender, w.withdrawlAmount);
        withdrawnBalances[msg.sender] = withdrawnBalances[msg.sender].add(
            w.withdrawlAmount
        );
        emit Withdraw(
            w.chainType,
            w.stakingAddressHash,
            w.currentWithdrawlId,
            withdrawnBalances[msg.sender]
        );
        return true;
    }

    function getWithdrawnBalance(address _address)
        public
        view
        returns (uint256)
    {
        return withdrawnBalances[_address];
    }

    function extractBytes(bytes memory _bytes)
        internal
        pure
        returns (WithdrawlParams memory)
    {
        uint32 chainType = _bytes.slice(0, 4).toUint32(0);
        bytes32 stakingAddressHash = _bytes.toBytes32(4);
        uint32 currentWithdrawlId = _bytes.toUint32(36);
        address mappedAddress = _bytes.toAddress(40);
        uint256 withdrawlAmount = _bytes.toUint(60);
        WithdrawlParams memory w = WithdrawlParams(
            chainType,
            stakingAddressHash,
            currentWithdrawlId,
            mappedAddress,
            withdrawlAmount
        );
        return w;
    }

    // function withdrawUsingSig(bytes calldata _bytes)
    //     external
    //     returns (
    //         uint32,
    //         bytes32,
    //         uint32,
    //         uint32,
    //         address,
    //         uint256
    //     )
    // {
    //     uint32 chainType = _bytes.slice(0, 4).toUint32(0);
    //     bytes32 stakingAddressHash = _bytes.toBytes32(4);
    //     uint32 currentWithdrawlId = _bytes.toUint32(36);
    //     uint32 lastWithdrawlId = withdrawlCounts[chainType][stakingAddressHash];
    //     address mappedAddress = _bytes.toAddress(40);
    //     uint256 withdrawlAmount = _bytes.toUint(60);
    //     Signature memory sig = getSignature(_bytes);
    //     require(
    //         currentWithdrawlId == lastWithdrawlId + 1,
    //         "withdrawls must be sequential"
    //     );
    //     require(
    //         mappedAddress == msg.sender,
    //         "Only sender can claim his rewards"
    //     );
    //     emit Withdraw(chainType, stakingAddressHash, currentWithdrawlId);
    //     return (
    //         chainType,
    //         stakingAddressHash,
    //         currentWithdrawlId,
    //         lastWithdrawlId,
    //         mappedAddress,
    //         withdrawlAmount
    //     );
    // }
    // function withdrawUsingSig(bytes calldata _bytes)
    //     external
    //     returns (
    //         bytes32,
    //         uint8,
    //         bytes32,
    //         bytes32,
    //         address
    //     )
    // {
    //     uint32 chainType = _bytes.slice(0, 4).toUint32(0);
    //     bytes32 stakingAddressHash = _bytes.toBytes32(4);
    //     uint32 currentWithdrawlId = _bytes.toUint32(36);
    //     uint32 lastWithdrawlId = withdrawlCounts[chainType][stakingAddressHash];
    //     address mappedAddress = _bytes.toAddress(40);
    //     uint256 withdrawlAmount = _bytes.toUint(60);

    //     Signature memory sig = getSignature(_bytes);
    //     address _recoverd = ecrecover(sig.hash, sig.v, sig.r, sig.s);

    //     // require(
    //     //     signer == _recoverd,
    //     //     "Message should be signed only by authorized signer outside the chain"
    //     // );

    //     require(
    //         currentWithdrawlId == lastWithdrawlId + 1,
    //         "withdrawls must be sequential"
    //     );
    //     require(
    //         mappedAddress == msg.sender,
    //         "Only sender can claim his rewards"
    //     );
    //     emit Withdraw(chainType, stakingAddressHash, currentWithdrawlId);
    //     return (sig.hash, sig.v, sig.r, sig.s, _recoverd);
    // }

    function getSignature(bytes memory _data)
        internal
        pure
        returns (Signature memory)
    {
        //Image prefix to be decided by the team
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 messageHash = keccak256(abi.encodePacked(_data.slice(0, 92)));
        bytes32 _hash1 = keccak256(abi.encodePacked(prefix, messageHash));
        uint8 _v1 = _data.slice(92, 1).toUint8(0);
        bytes32 _r1 = _data.slice(93, 32).toBytes32(0);
        bytes32 _s1 = _data.slice(125, 32).toBytes32(0);
        Signature memory sig = Signature(_hash1, _v1, _r1, _s1);
        return sig;
    }
}
