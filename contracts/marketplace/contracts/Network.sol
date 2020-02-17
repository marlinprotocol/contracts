pragma solidity 0.6.1;

/**
@title Network
@author Balaji Shetty Pachai
@dev Smart contract for the marlyn networks
 */
contract Network {
    /**
    @dev Returns something not yet decided
     */
    // solhint-disable no-empty-blocks
    constructor(address _caller) public {
        // Returns something for now do not know what ?
    }

    /**
    @notice Gets the network id
    @dev
        For now it returns a dummy value however this will be changed in the future
     */
    function getNetworkId() external pure returns (bytes32 networkId) {
        // Do something and return the networkId
        // TODO logic will be added once the requirements are received
        return bytes32("Dummy network id");
    }

}
