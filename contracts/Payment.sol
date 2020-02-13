pragma solidity ^0.6.1;
pragma experimental ABIEncoderV2;
import "./Token.sol";
import "./Stake.sol";

contract Payment{
    string public id;
    Stake public stake;

    struct Witness{
        address relayer; // peer.publicKey (in DATA.md)
        uint256 relayerFraction; // relayerFraction (in DATA.md)
        bytes relayerSignature; // self.privKey (in DATA.md)
    }

    struct SignedWitness{
        Witness[] witnessList;
        bytes signature;
    }

    Witness[] public witness;

    constructor(address _stake) public {
        stake = Stake(_stake);
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
        require(stake.checkBalance(msg.sender) >= _amount,"Insufficient balance");
        // token.approveContract(address(this), msg.sender, _amount);
    	stake.setLockedBalance(msg.sender, _amount, true);
    	// token.transferFrom(msg.sender, address(this), _amount);
        stake.transferTokensFrom(_amount, msg.sender);
    	emit BalanceChanged(msg.sender);
    }

    bytes32[] public allHashes;

    function unlock(uint256 _amount) public returns(bytes32){
        require(stake.getLockedBalance(msg.sender) >= _amount, "Amount exceeds lockedBalance");
        bytes32 hash = keccak256(abi.encode(msg.sender,block.timestamp, _amount));
        stake.setUnlockRequests(hash, msg.sender, block.timestamp, _amount);
        allHashes.push(hash);
        emit UnlockRequested(msg.sender, block.timestamp, _amount);
    	return hash;
    }

    function sealUnlockRequest(bytes32 _id) public returns(bool){
        require(stake.getUnlockRequestsSender(_id) == msg.sender, "You cannot seal this request");

    	if(stake.getUnlockRequestsTime(_id) + 86400 > block.timestamp){
            emit UnlockRequestSealed(_id, false);
            return false;
        }

        uint256 _amount = stake.getUnlockRequestsAmount(_id);

    	stake.setLockedBalance(msg.sender, _amount, false);

    	stake.setUnlockedBalance(msg.sender, _amount, true);

    	stake.deleteUnlockRequest(_id);

        emit UnlockRequestSealed(_id, true);
    	return true;
    }

    function withdraw(uint256 _amount) public{
    	require(_amount <= stake.getUnlockedBalance(msg.sender), "Amount greater than the unlocked amount");
    	stake.setUnlockedBalance(msg.sender, _amount, false);
    	stake.transferTokens(_amount, msg.sender);
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

        require(stake.getLockedBalance(msg.sender) >= _amount, "User doesn't have enough locked balance");

    	if(isWinning(_signedWitness.signature) == false) {
            emit PayWitness(msg.sender, _amount, false);
            return false;
        }

        for(uint i = 0; i < _signedWitness.witnessList.length; i++){
    		stake.setLockedBalance(msg.sender, _signedWitness.witnessList[i].relayerFraction*_amount, false);

    		stake.setUnlockedBalance(_signedWitness.witnessList[i].relayer, _signedWitness.witnessList[i].relayerFraction*_amount, true);
        }

        emit PayWitness(msg.sender, _amount, true);
        return true;

    }

}