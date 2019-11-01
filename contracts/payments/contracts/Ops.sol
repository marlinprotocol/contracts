pragma solidity ^0.5.0;

library Ops{
    
    function slice(bytes memory str, uint startIndex, uint endIndex) public pure returns (bytes memory) {
        bytes memory strBytes = str;
        bytes memory result = new bytes(endIndex-startIndex);
        for(uint i = startIndex; i < endIndex; i++) {
            result[i-startIndex] = strBytes[i];
        }
        return result;
    }
    
    function bytesToAddress(bytes memory _address) public pure returns (address) {
        uint160 m = 0;
        uint160 b = 0;
    
        for (uint8 i = 0; i < 20; i++) {
          m *= 256;
          b = uint160(uint8(_address[i]));
          m += (b);
        }
    
        return address(m);
    }
    
}