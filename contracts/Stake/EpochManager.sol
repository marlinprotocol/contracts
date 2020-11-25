// pragma solidity >=0.4.21 <0.7.0;

// import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

// contract EpochManager {
    
//     using SafeMath for uint256;

//     uint startBlock;
//     uint epochLength;

//     function getEpoch(uint _block) view public returns(uint) {
//         return (_block.sub(startBlock).div(epochLength));
//     }

//     function blocksLeftInEpoch(uint _block) view public returns(uint256) {
//         uint256 epochStartBlock = getEpoch(_block).mul(epochLength);
//         return epochLength.add(epochStartBlock).sub(_block);
//     }
// }