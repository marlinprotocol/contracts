pragma solidity ^0.5.0;

import "../contracts/Ops.sol";
import "../contracts/CryptoLib.sol";

contract MarlinPaymentChannel{
    using Ops for Ops;
    using CryptoLib for CryptoLib;
    
    mapping(address => uint) balances;
    
    constructor()public{
        balances[0xd03ea8624C8C5987235048901fB614fDcA89b117] = 500;
    }
    
    function balanceOf(address _addr) public view returns(uint){
        return balances[_addr];
    }
    
    function addBalance(address _addr) public {
        balances[_addr] += 500;
    }

    function getBalance(address _addr) public view returns(uint) {
        return balances[_addr];
    }
    
    function defray(bytes memory _witness, bytes memory _sig) public {
        
        uint totalWitnesses = _witness.length / 75;
        address receiver = CryptoLib.recover(CryptoLib.hash(_witness), _sig);
        
        require(balances[receiver] >= totalWitnesses*(totalWitnesses+1));
        
        address[] memory witnessBox = new address[](totalWitnesses + 1);
        bytes memory tempAddress = Ops.slice(_witness,0,20);
        witnessBox[1] = Ops.bytesToAddress(tempAddress);
        
        bytes32 hash = CryptoLib.hash(tempAddress);
        
        bytes memory sig = Ops.slice(_witness,20,85);
        witnessBox[0] = CryptoLib.recover(hash, sig);
        
        uint bytesCovered = 85;
        
        for(uint i = 1;i<totalWitnesses;i++){
            
            tempAddress = Ops.slice(_witness,bytesCovered, bytesCovered + 20);
            witnessBox[i+1] = Ops.bytesToAddress(tempAddress);
            
            bytesCovered += 20;
            
            hash = CryptoLib.hash(Ops.slice(_witness,0,bytesCovered));
            
            sig = Ops.slice(_witness,bytesCovered,bytesCovered+65);
            
            require(CryptoLib.recover(hash,sig) == witnessBox[i]);
            
            bytesCovered += 65;
        }
        for(uint i=0;i<witnessBox.length;i++){
            balances[receiver] -=  (2*(i+1));
            balances[witnessBox[witnessBox.length - (1+i)]] += (2*(i+1));
        }
    }
}