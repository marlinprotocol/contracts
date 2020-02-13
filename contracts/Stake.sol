// this contract will hold all tokens

pragma solidity >=0.4.21 <0.7.0;
import "./Token.sol";
import "../vendor/openzeppelin/contracts/math/SafeMath.sol";

contract Stake{
    using SafeMath for uint256;

    Token public token;
    address public owner;

    constructor(address _token) public{
        token = Token(_token);
        owner = msg.sender;
        joinedContracts[address(this)] = true;
    }


    event ContractAdded(
        address Contract
    );

    mapping(address => bool) public joinedContracts;

    function addContract(address _add) public {
        require(_add != address(0x0), "Cannot add zero address");
        require(msg.sender == owner, "Only owner can add contracts");
        joinedContracts[_add] = true;
        emit ContractAdded(_add);
    }


    modifier isValidContract(){
        require(joinedContracts[msg.sender], "The contract is not authorized");
        _;
    }

    function checkBalance(address _add) public view returns(uint256){
        return token.balanceOf(_add);
    }

    function transferTokensFrom(uint256 _amount, address _sender) public isValidContract returns(bool){
        token.approveContract(address(this), _sender, _amount);
        token.transferFrom(_sender, address(this), _amount);
        return true;
    }

    function transferTokens(uint256 _amount, address _receiver) public isValidContract returns(bool){
        // token.approveContract(address(this), msg.sender, _amount);
        token.transfer(_receiver, _amount);
        return true;
    }

    struct Details{
        address sender;
        uint timestamp;
        uint256 amount;
    }

    mapping(address => uint256) lockedBalances;
    mapping(bytes32 => Details) unlockRequests; // string => (sender, timestamp, amount)
    mapping(address => uint256) unlockedBalances;


    function getLockedBalance(address _user) public view returns(uint256){
        return lockedBalances[_user];
    }

    function getUnlockedBalance(address _user) public view returns(uint256){
        return unlockedBalances[_user];
    }

    function getUnlockRequests(bytes32 _hash) public view returns(address sender, uint time, uint256 amount){
        return (unlockRequests[_hash].sender, unlockRequests[_hash].timestamp, unlockRequests[_hash].amount);
    }

    function getUnlockRequestsSender(bytes32 _hash) public view returns(address sender){
        return (unlockRequests[_hash].sender);
    }
    function getUnlockRequestsTime(bytes32 _hash) public view returns(uint time){
        return (unlockRequests[_hash].timestamp);
    }
    function getUnlockRequestsAmount(bytes32 _hash) public view returns(uint256 amount){
        return (unlockRequests[_hash].amount);
    }



    event SetLockedBalance(
        string method,
        address user,
        uint256 amount
    );

    event SetUnlockedBalance(
        string method,
        address user,
        uint256 amount
    );

    event UnlockRequest(
        bytes32 hash,
        address sender,
        uint timestamp,
        uint256 amount
    );

    function setLockedBalance(address _user, uint256 _amount, bool _value) public isValidContract{
        if(_value){
            lockedBalances[_user] = lockedBalances[_user].add(_amount);
            emit SetLockedBalance("Addition", _user, _amount);
        }
        else{
            lockedBalances[_user] = lockedBalances[_user].sub(_amount);
            emit SetLockedBalance("Subtraction", _user, _amount);
        }
    }

    function setUnlockedBalance(address _user, uint256 _amount, bool _value) public isValidContract{
        if(_value){
            unlockedBalances[_user] = unlockedBalances[_user].add(_amount);
            emit SetUnlockedBalance("Addition", _user, _amount);
        }
        else{
            unlockedBalances[_user] = unlockedBalances[_user].sub(_amount);
            emit SetUnlockedBalance("Subtraction", _user, _amount);
        }
    }

    function setUnlockRequests(bytes32 _hash, address _sender, uint _timestamp, uint256 _amount) public isValidContract{

        unlockRequests[_hash].sender = _sender;
        unlockRequests[_hash].timestamp = _timestamp;
        unlockRequests[_hash].amount = _amount;
        emit UnlockRequest(_hash, _sender, _timestamp, _amount);
    }

    event RequestDeleted( bytes32 ID );

    function deleteUnlockRequest(bytes32 _id) public isValidContract{
        delete(unlockRequests[_id]);
        emit RequestDeleted(_id);
    }

}