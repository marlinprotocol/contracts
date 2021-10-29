pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/StorageSlot.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";
/// @title Contract to reward overlapping stakes
/// @author Marlin
/// @notice Use this contract only for testing
/// @dev Contract may or may not change in future (depending upon the new slots in proxy-store)
contract ClusterRewardsProxy is Proxy{
    bytes32 internal constant IMPLEMENTATION_SLOT = bytes32(
        uint256(keccak256("eip1967.proxy.implementation")) - 1
    );

    constructor(address contractLogic) {
        // save the code address
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, contractLogic)
        }
    }
    
    function _implementation() internal view virtual override returns (address){
        return StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value;
        
    }
}