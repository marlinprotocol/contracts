pragma solidity ^0.6.1;
pragma experimental ABIEncoderV2;
import "./Stake.sol";

contract Payment is Stake {

    constructor(address _token) public Stake(_token) {

    }

    struct Witness {
        address relayer; // peer.publicKey (in DATA.md)
        uint256 relayerFraction; // relayerFraction (in DATA.md)
        bytes relayerSignature; // self.privKey (in DATA.md)
    }

    struct SignedWitness {
        Witness[] witnessList;
        bytes signature;
    }

    struct Details {
        address sender;
        uint256 timestamp;
        uint256 amount;
    }

    mapping(bytes32 => Details) public unlockRequests; // bytes32 => (sender, timestamp, amount)

    event UnlockRequested(
        bytes32 id,
        address sender,
        uint256 time,
        uint256 amount
    );

    event UnlockRequestSealed(bytes32 id, bool changed);

    function unlock(uint256 _amount) public returns (bytes32) {
        require(
            lockedBalances[msg.sender] >= _amount,
            "Amount exceeds lockedBalance"
        );
        bytes32 hash = keccak256(
            abi.encode(msg.sender, block.timestamp, _amount)
        );
        unlockRequests[hash].sender = msg.sender;
        unlockRequests[hash].timestamp = block.timestamp;
        unlockRequests[hash].amount = unlockRequests[hash].amount.add(_amount);
        emit UnlockRequested(hash, msg.sender, block.timestamp, _amount);
        return hash;
    }

    function sealUnlockRequest(bytes32 _id) public returns (bool) {
        require(
            unlockRequests[_id].sender == msg.sender,
            "You cannot seal this request"
        );

        if (unlockRequests[_id].timestamp + 86400 > block.timestamp) {
            emit UnlockRequestSealed(_id, false);
            return false;
        }

        lockedBalances[msg.sender] = lockedBalances[msg.sender].sub(
            unlockRequests[_id].amount
        );
        unlockedBalances[msg.sender] = unlockedBalances[msg.sender].add(
            unlockRequests[_id].amount
        );
        delete (unlockRequests[_id]);
        emit UnlockRequestSealed(_id, true);
        return true;
    }

    event PayWitness(address sender, uint256 amount, bool paid);

    function isWinning(bytes memory _witnessSignature)
        public
        pure
        returns (bool)
    {
        if (bytes1(_witnessSignature[0]) == bytes1(0)) {
            return (true);
        }
        return (false);
    }

    function payForWitness(SignedWitness memory _signedWitness, uint256 _amount)
        public
        returns (bool)
    {
        require(
            lockedBalances[msg.sender] >= _amount,
            "User doesn't have enough locked balance"
        );

        if (isWinning(_signedWitness.signature) == false) {
            emit PayWitness(msg.sender, _amount, false);
            return false;
        }

        for (uint256 i = 0; i < _signedWitness.witnessList.length; i++) {
            lockedBalances[msg.sender] = lockedBalances[msg.sender].sub(
                _signedWitness.witnessList[i].relayerFraction * _amount
            );

            unlockedBalances[_signedWitness.witnessList[i]
                .relayer] = unlockedBalances[_signedWitness.witnessList[i]
                .relayer]
                .add(_signedWitness.witnessList[i].relayerFraction * _amount);
        }

        emit PayWitness(msg.sender, _amount, true);
        return true;

    }

}
