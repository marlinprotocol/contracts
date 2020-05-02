pragma solidity >=0.4.21 <0.7.0;

contract Proxy {
    // Code position in storage is keccak256("PROXIABLE") = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7"
    // constructor(bytes memory constructData, address contractLogic) public {
    //     // save the code address
    //     assembly {
    //         sstore(0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7, contractLogic)
    //     }
    //     (bool success, bytes memory _ ) = contractLogic.delegatecall(constructData); // solium-disable-line
    //     require(success, "Construction failed");
    // }
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

    fallback() external payable {
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