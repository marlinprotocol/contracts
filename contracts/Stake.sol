// this contract will hold all tokens

pragma solidity ^0.6.1;
import "./Token.sol";
import "../vendor/openzeppelin/contracts/math/SafeMath.sol";

contract Stake{
    using SafeMath for uint256;

    struct Witness{
        address relayer; // peer.publicKey (in DATA.md)
        uint256 relayerFraction; // relayerFraction (in DATA.md)
        bytes relayerSignature; // self.privKey (in DATA.md)
    }

    struct SignedWitness{
        Witness[] witnessList;
        bytes signature;
    }

    struct Details{
        address sender;
        uint timestamp;
        uint256 amount;
    }

    mapping(address => uint256) public lockedBalances;
    mapping(bytes32 => Details) public unlockRequests; // bytes32 => (sender, timestamp, amount)
    mapping(address => uint256) public unlockedBalances;

}