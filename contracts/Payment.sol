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
        address
    );

    mapping(address => uint) public lockedBalances;
    mapping(string => Details) public unlockRequests; // string => (sender, timestamp, amount)
    mapping(address => uint) public unlockedBalances;


    function addEscrow(uint256 _amount) public{
        require(token.balanceOf(msg.sender) >= _amount,"Insufficient balance");
        token.approveContract(address(this), msg.sender, _amount);
    	lockedBalances[msg.sender] += _amount;
    	token.transferFrom(msg.sender, address(this), _amount);
    	emit BalanceChanged(msg.sender);
    }

}