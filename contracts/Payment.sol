pragma solidity ^0.6.1;
pragma experimental ABIEncoderV2;
import "./Token.sol";
import "./Stake.sol";

contract Payment is Stake{
    Token public token;

    constructor(address _token) public {
        token = Token(_token);
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

    function addEscrow(uint256 _amount) public{
        require(token.balanceOf(msg.sender) >= _amount,"Insufficient balance");
        require(uint256(token.allowance(msg.sender, address(this))) >= _amount, "The contract is not allowed to spend on the user's behalf");
    	lockedBalances[msg.sender] = lockedBalances[msg.sender].add(_amount);
    	token.transferFrom(msg.sender, address(this), _amount);
    	emit BalanceChanged(msg.sender);
    }

    bytes32[] public allHashes;

    function unlock(uint256 _amount) public returns(bytes32){
        require(lockedBalances[msg.sender] >= _amount, "Amount exceeds lockedBalance");
        bytes32 hash = keccak256(abi.encode(msg.sender,block.timestamp, _amount));
    	unlockRequests[hash].sender = msg.sender;
        unlockRequests[hash].timestamp = block.timestamp;
        unlockRequests[hash].amount = unlockRequests[hash].amount.add(_amount);
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

    	lockedBalances[msg.sender] = lockedBalances[msg.sender].sub(unlockRequests[_id].amount);
    	unlockedBalances[msg.sender] = unlockedBalances[msg.sender].add(unlockRequests[_id].amount);
    	delete(unlockRequests[_id]);
        emit UnlockRequestSealed(_id, true);
    	return true;
    }

    function withdraw(uint256 _amount) public{
    	require(_amount <= unlockedBalances[msg.sender], "Amount greater than the unlocked amount");
    	unlockedBalances[msg.sender] = unlockedBalances[msg.sender].sub(_amount);
    	token.transfer(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount, true);
    }

    event PayWitness(
        address sender,
        uint256 amount,
        bool paid
    );

    function isWinning(bytes memory _witnessSignature) public pure returns(bool){
        if(byte(_witnessSignature[0]) == byte(0)){
            return(true);
        }
        return(false);
    }

    function payForWitness(SignedWitness memory _signedWitness, uint256 _amount) public returns(bool){

        require(lockedBalances[msg.sender] >= _amount, "User doesn't have enough locked balance");

    	if(isWinning(_signedWitness.signature) == false) {
            emit PayWitness(msg.sender, _amount, false);
            return false;
        }

        for(uint i = 0; i < _signedWitness.witnessList.length; i++){
    		lockedBalances[msg.sender] = lockedBalances[msg.sender].sub(_signedWitness.witnessList[i].relayerFraction*_amount);

    		unlockedBalances[_signedWitness.witnessList[i].relayer] = unlockedBalances[_signedWitness.witnessList[i].relayer].add(_signedWitness.witnessList[i].relayerFraction*_amount);
        }

        emit PayWitness(msg.sender, _amount, true);
        return true;

    }

}
