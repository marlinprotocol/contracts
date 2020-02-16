pragma solidity 0.6.1;

import "./Network.sol";

/**
@title NetworkMarketplace
@author Balaji Shetty Pachai
@dev Smart contract that deals with managing the creation of relay networks
 */
contract NetworkMarketplace {
    mapping(bytes32 => NetworkData) public networkMap;

    // NetworkData Structure
    struct NetworkData {
        bytes32 protocol;
        Capability[] capabilities;
        address networkAddress;
    }

    // Capability Structure
    struct Capability {
        bytes32 key;
        uint256 value;
    }

    event NetworkAdded(
        bytes32 networkId,
        bytes32 protocol,
        bytes32[] capabilityKey,
        uint256[] capabilityValue,
        address networkAddress
    );

    // TODO Capability[] capabilities cannot be passed in as this feature is not yet available
    // TODO Roshan we should add bytes32[] capabilityKey and uint256[] capabilityValue, however this requires looping them inside contract, let me know what do you think about this
    // I would like to know at a particular instance what will be the max value for both capabilityKey and capabilityValue arrays ?
    /**
    @dev Registers a network
    @param protocol Supported protocols
    @param capabilityKey Array of capability keys
    @param capabilityValue Array of capability values
     */
    function registerNetwork(
        bytes32 protocol,
        bytes32[] memory capabilityKey,
        uint256[] memory capabilityValue
    ) public {
        Network network = new Network(msg.sender);
        bytes32 networkId = network.getNetworkId();
        // Traverse the capabilityKey and capabilityValue arrays and return
        Capability[] memory capabilities = getCapability(
            capabilityKey,
            capabilityValue
        );

        networkMap[networkId] = NetworkData(protocol, capabilities, msg.sender);
        emit NetworkAdded(
            networkId,
            protocol,
            capabilityKey,
            capabilityValue,
            msg.sender
        );
    }

    /**
    @dev Gets the formatted capabilities array
    @param capabilityKey Array of capability keys
    @param capabilityValue Array of capability values
     */
    function getCapability(
        bytes32[] memory capabilityKey,
        uint256[] memory capabilityValue
    ) internal pure returns (Capability[] memory _capabilities) {
        require(
            capabilityKey.length == capabilityValue.length,
            "Mismatch in passed capability key and value"
        );
        for (uint8 i = 0; i < capabilityKey.length; i++) {
            _capabilities[i] = Capability({
                key: capabilityKey[i],
                value: capabilityValue[i]
            });
        }
        return _capabilities;
    }
}
