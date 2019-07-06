pragma solidity ^0.4.24;

contract Upload {

    address CERTIFICATE_CONTRACT_ADDRESS;

    constructor(address _certificateContractAddress) public {
        CERTIFICATE_CONTRACT_ADDRESS = _certificateContractAddress;
    }
}
