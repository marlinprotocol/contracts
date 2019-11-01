pragma solidity ^0.5.0;

library CryptoLib{
    
    function hash(bytes memory message) public pure returns(bytes32){
       string memory header = "\x19Ethereum Signed Message:\n000000";
       uint256 lengthOffset;
       uint256 length;
       assembly {
         length := mload(message)
         lengthOffset := add(header, 57)
       }
       require(length <= 999999);
       uint256 lengthLength = 0;
       uint256 divisor = 100000;
       while (divisor != 0) {
         uint256 digit = length / divisor;
         if (digit == 0) {
           if (lengthLength == 0) {
             divisor /= 10;
             continue;
           }
         }
         lengthLength++;
         length -= digit * divisor;
         divisor /= 10;
         digit += 0x30;
         lengthOffset++;
         assembly {
           mstore8(lengthOffset, digit)
         }
       }
       if (lengthLength == 0) {
         lengthLength = 1 + 0x19 + 1;
       } else {
         lengthLength += 1 + 0x19;
       }
       assembly {
         mstore(header, lengthLength)
       }
       bytes32 check = keccak256(abi.encodePacked(header, message));
       return check;
   }
    
    function recover(bytes32 hash, bytes memory signature) public pure returns (address){
        bytes32 r;
        bytes32 s;
        uint8 v;
    
        if (signature.length != 65) {
          return (address(0));
        }
    
        assembly {
          r := mload(add(signature, 0x20))
          s := mload(add(signature, 0x40))
          v := byte(0, mload(add(signature, 0x60)))
        }
    
        if (v < 27) {
          v += 27;
        }
    
        if (v != 27 && v != 28) {
          return (address(0));
        } else {
          return ecrecover(hash, v, r, s);
        }
    }
}