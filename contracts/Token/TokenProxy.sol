pragma solidity >=0.4.21 <0.7.0;

contract TokenProxy {
    bytes32 internal constant IMPLEMENTATION_SLOT = bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1);
    bytes32 internal constant PROXY_ADMIN_SLOT = bytes32(uint256(keccak256('eip1967.proxy.admin')) - 1);

    constructor(address contractLogic) public {
        // save the code address
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, contractLogic)
        }
        // save the proxy admin
        slot = PROXY_ADMIN_SLOT;
        address sender = msg.sender;
        assembly {
            sstore(slot, sender)
        }
    }

    function() external payable {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            let contractLogic := sload(slot)
            calldatacopy(0x0, 0x0, calldatasize())
            let success := delegatecall(sub(gas(), 10000), contractLogic, 0x0, calldatasize(), 0, 0)
            let retSz := returndatasize()
            returndatacopy(0, 0, retSz)
            switch success
            case 0 {
                revert(0, retSz)
            }
            default {
                return(0, retSz)
            }
        }
    }
}