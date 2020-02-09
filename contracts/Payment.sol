pragma solidity ^0.6.1;
pragma experimental ABIEncoderV2;
import "./Token.sol";

contract Payment{
    string public id;
    Token public token;
    
    struct Witness{ 
        address relayer; // peer.publicKey (in DATA.md)
        uint256 relayerFraction; // relayerFraction (in DATA.md)
        bytes signature; // self.privKey (in DATA.md)
    }

    Witness[] public witness;
    
    constructor(address _token) public {
        token = Token(_token);
    }
    
    function isWinning(bytes memory _witness) public pure returns(byte, byte, uint, bool){
        if(byte(_witness[0]) == byte(0)){
            return(_witness[0], byte(0),_witness.length, true);
        }
        return(_witness[0], byte(0), _witness.length, false);
    }

    struct Details{
        address sender;
        uint timestamp;
        uint256 amount;
    }

    event BalanceChanged(
        address sender
    );

    event UnlockRequested(
        address sender,
        uint time,
        uint256 amount
    );

    event UnlockRequestSealed(
        bytes32 id,
        bool changed
    );

    event Withdraw(
        address sender,
        uint256 amount,
        bool withdrawn
    );

    mapping(address => uint) public lockedBalances;
    mapping(bytes32 => Details) public unlockRequests; // string => (sender, timestamp, amount)
    mapping(address => uint) public unlockedBalances;


    function addEscrow(uint256 _amount) public{
        require(token.balanceOf(msg.sender) >= _amount,"Insufficient balance");
        token.approveContract(address(this), msg.sender, _amount);
    	lockedBalances[msg.sender] += _amount;
    	token.transferFrom(msg.sender, address(this), _amount);
    	emit BalanceChanged(msg.sender);
    }

    bytes32[] public allHashes;

    function unlock(uint256 _amount) public returns(bytes32){
        require(lockedBalances[msg.sender] >= _amount, "Amount exceeds lockedBalance");
        
        bytes32 hash = keccak256(abi.encode(msg.sender,block.timestamp, _amount));
    	unlockRequests[hash].sender = msg.sender;
        unlockRequests[hash].timestamp = block.timestamp;
        unlockRequests[hash].amount = _amount;
        allHashes.push(hash);
        emit UnlockRequested(msg.sender, block.timestamp, _amount);
        
    	return hash;
    }

    function sealUnlockRequest(bytes32 _id) public returns(bool){
        require(unlockRequests[_id].sender == msg.sender, "You cannot seal this request");

    	if(unlockRequests[_id].timestamp + 86400 > block.timestamp){
            emit UnlockRequestSealed(_id, false);
            return false;
        }
    	lockedBalances[msg.sender] -= unlockRequests[_id].amount;
    	unlockedBalances[msg.sender] += unlockRequests[_id].amount;
    	delete(unlockRequests[_id]);
        emit UnlockRequestSealed(_id, true);
    	return true;
    }

    function withdraw(uint256 _amount) public{
    	require(_amount <= unlockedBalances[msg.sender], "Amount greater than the unlocked amount");
    	unlockedBalances[msg.sender] -= _amount;
    	token.transfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount, true);
    }

}