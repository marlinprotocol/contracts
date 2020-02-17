pragma solidity 0.6.1;

// import "./Network.sol";

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

    /**
    * TODO Capability[] capabilities cannot be passed in as this feature is not yet available
    * TODO Roshan we should add bytes32[] capabilityKey and uint256[] capabilityValue,
    * however this requires looping them inside contract, let me know what do you think about this
    * I would like to know at a particular instance what will be the max value for both
    * capabilityKey and capabilityValue arrays ?
    */
    /**
    @dev Registers a network
    @param protocol Supported protocols
    @param capabilityKey Array of capability keys
    @param capabilityValue Array of capability values
     */
    function registerNetwork(
        bytes32 protocol,
        bytes32[] memory capabilityKey,
        uint256[] memory capabilityValue,
        uint256 timestamp
    ) public {
        /**
         * TODO @Balaji This will be used at a later point when the Network Smart Contract details have been received
         * Then uncomment below 3 lines
         * Network network = new Network(msg.sender);
         * bytes32 networkId = network.getNetworkId();
        */

        /**
         * For now the networkId will be keccak256(msg.sender, timestamp)
         * The timestamp will be passed from the backend, since using now,
         * or block.timestamp can be manipulated by miners.
         * Thus adding a function parameter timestamp
        */
        // This ensures the networkId is unique
        bytes32 networkId = keccak256(abi.encodePacked(msg.sender, timestamp));

        // Traverse the capabilityKey and capabilityValue arrays and return
        // solhint-disable-next-line mark-callable-contracts
        Capability[] memory capabilities = getCapability(
            capabilityKey,
            capabilityValue
        );

        networkMap[networkId].protocol = protocol;
        networkMap[networkId].networkAddress = msg.sender; // THIS WILL BE CHANGED IN THE FUTURE
        // THIS LOOP IS NECESSARY SINCE ALLOCATION FROM MEMORY TO STORAGE IS NOT YET AVAILABLE
        for (uint8 i = 0; i < capabilities.length; i++) {
            networkMap[networkId].capabilities.push(capabilities[i]);
        }
        // solhint-disable-next-line mark-callable-contracts
        emit NetworkAdded(
            networkId,
            protocol,
            capabilityKey,
            capabilityValue,
            msg.sender
        );
    }

    /**
    @dev Gets the NetworkMap details
    @param networkId The network id for which the network has been mapped
    */
    function getNetworkMap(bytes32 networkId)
        public
        view
        returns (
            bytes32 protocol,
            address networkAddress,
            bytes32[] memory capabilityKey,
            uint256[] memory capabilityValue
        )
    {
        for (uint8 i = 0; i < networkMap[networkId].capabilities.length; i++) {
            capabilityKey[i] = networkMap[networkId].capabilities[i].key;
            capabilityValue[i] = networkMap[networkId].capabilities[i].value;
        }

        return (
            networkMap[networkId].protocol,
            networkMap[networkId].networkAddress,
            capabilityKey,
            capabilityValue
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
            // solhint-disable-next-line mark-callable-contracts
            _capabilities[i] = Capability({
                key: capabilityKey[i],
                value: capabilityValue[i]
            });
        }
        return _capabilities;
    }
}
