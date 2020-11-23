pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";

contract PerfOracle is Ownable {
    constructor(address _owner) public Ownable() {
        transferOwnership(_owner);
    }

    function feed(uint _epoch, address[] memory _clusters, uint256[] memory _perf) public onlyOwner {
        for(uint256 i=0; i < _clusters.length; i++) {
            _perf[i] = getEffectiveStake(_clusters[i])*_perf[i];
        }
        
    }

    function lockEpoch(uint _epoch) public onlyOwner {

    }

    function getEffectiveStake(address _cluster) public returns(uint256) {

    }
}