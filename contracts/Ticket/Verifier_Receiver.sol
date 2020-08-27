// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;
pragma experimental ABIEncoderV2;

import "../Actors/Receiver.sol";
import "../Actors/Cluster.sol";
import "../Actors/ClusterRegistry.sol";
import "../Fund/FundManager.sol";
import "../Fund/Pot.sol";
import "./LuckManager.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract VerifierReceiver is Initializable{
    using SafeMath for uint256;

    Receiver receiverManager;
    ClusterRegistry clusterRegistry;
    Pot pot;
    LuckManager luckManager;
    FundManager fundManager;
    bytes32 receiverRole;
    bytes32 tokenId;

    mapping(bytes32 => bool) claimedTickets;

    function initialize(address _receiverRegistry, 
                address _clusterRegistry, 
                address _luckManager, 
                address _pot, 
                address _fundManager, 
                bytes32 _receiverRole,
                bytes32 _tokenId) 
                public
                initializer {
        receiverManager = Receiver(_receiverRegistry);
        clusterRegistry = ClusterRegistry(_clusterRegistry);
        luckManager = LuckManager(_luckManager);
        pot = Pot(_pot);
        fundManager = FundManager(_fundManager);
        receiverRole = _receiverRole;
        tokenId = _tokenId;
    }
    //todo: think about possibility of same ticket being used for producer claim as well as receiver claim
    function verifyClaim(bytes memory _blockHeader, 
                        bytes memory _receiverSig, 
                        bytes memory _relayerSig,
                        address _cluster,
                        bool _isAggregated) 
                        public returns(bytes32, address, uint) {
        bytes32 blockHash = keccak256(_blockHeader);
        address receiver = recoverSigner(blockHash, _receiverSig);
        require(receiverManager.isValidReceiver(receiver), "Verifier_Receiver: Invalid Receiver");
        bytes memory relayerSigPayload = abi.encodePacked(_blockHeader, _receiverSig);
        address relayer = recoverSigner(keccak256(relayerSigPayload), _relayerSig);

        require(uint(clusterRegistry.getClusterStatus(_cluster)) == 2, "Verifier_Receiver: Cluster isn't active");
        require(Cluster(_cluster).isRelayer(relayer), "Verifier_Receiver: Relayer isn't part of cluster");

        bytes32 ticket = keccak256(abi.encodePacked(relayerSigPayload, _relayerSig));
        require(!claimedTickets[ticket], "Verifier_Receiver: Ticket already claimed");
        uint blockNumber = extractBlockNumber(_blockHeader);
        uint epoch = pot.getEpoch(blockNumber);
        uint luckLimit = luckManager.getLuck(epoch, receiverRole);
        require(uint(luckLimit) > uint(ticket), "Verifier_Receiver: Ticket not in winning range");
        if(pot.getPotValue(epoch, tokenId) == 0) {
            uint[] memory epochs;
            uint[] memory values;
            uint[][] memory inflationLog = fundManager.draw(address(pot), block.number);
            for(uint i=0; i < inflationLog[0].length.sub(1); i++) {
                for(uint j=inflationLog[0][i]; j < inflationLog[0][i+1]; j++) {
                    epochs[epochs.length] = j;
                    values[values.length] = inflationLog[1][i];
                }
            }
            require(pot.addToPot(epochs, address(fundManager), tokenId, values), 
                "Verifier_Receiver: Could not add to pot");
        }
        //TODO: If encoderv2 can be used then remove isAggregated
        if(!_isAggregated) {
            //TODO: Find if there is a better way to initialize dynamic arrays
            bytes32[] memory roles;
            address[] memory claimers;
            uint[] memory epochs;
            roles[0] = receiverRole;
            claimers[0] = _cluster;
            epochs[0] = epoch;
            require(pot.claimTicket(roles, claimers, epochs), 
                    "Verifier_Receiver: Ticket claim failed");
        }
        claimedTickets[ticket] = true;
        return (receiverRole, _cluster, epoch);
    }

    function verifyClaims(bytes[] memory _blockHeaders, 
                          bytes[] memory _relayerSigs, 
                          bytes[] memory _producerSigs, 
                          address[] memory _clusters) 
                          public {
        require(_blockHeaders.length == _relayerSigs.length && 
                _relayerSigs.length == _producerSigs.length &&
                _producerSigs.length == _clusters.length
                , "Verifier_Receiver: Invalid Inputs");
        bytes32[] memory roles;
        address[] memory claimers;
        uint[] memory epochs;
        for(uint i=0; i < _blockHeaders.length; i++) {
            (bytes32 role, address claimer, uint epoch) = verifyClaim(_blockHeaders[i], 
                                                                        _relayerSigs[i], 
                                                                        _producerSigs[i],
                                                                        _clusters[i],
                                                                        true);
            epochs[epochs.length] = epoch;
            claimers[claimers.length] = claimer;
            roles[roles.length] = role;
        }
        require(pot.claimTicket(roles, claimers, epochs), "Verifier_Receiver: Aggregate ticket claim failed");
    }

    function extractBlockNumber(bytes memory blockHeader) public returns(uint) {
        // TODO: Implementation specific for blockchain
    }

    //todo: Modify below 2 functions slightly
    function splitSignature(bytes memory sig)
        internal
        pure
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        require(sig.length == 65);

        assembly {
            // first 32 bytes, after the length prefix.
            r := mload(add(sig, 32))
            // second 32 bytes.
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes).
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address)
    {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);

        return ecrecover(message, v, r, s);
    }
}