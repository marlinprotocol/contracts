// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;
pragma experimental ABIEncoderV2;

import "../Token/TokenLogic.sol";
import "./CoinBaseLinker.sol";
import "../Actors/Cluster.sol";
import "../Actors/ClusterRegistry.sol";
import "../Fund/Pot.sol";
import "../Fund/FundManager.sol";
import "./LuckManager.sol";

contract VerifierProducer {

    CoinBaseLinker coinbaseLinker = CoinBaseLinker(address(0));
    ClusterRegistry clusterRegistry = ClusterRegistry(address(0));
    LuckManager luckManager = LuckManager(address(0));
    Pot pot = Pot(address(0));
    FundManager fundManager = FundManager(address(0));
    bytes32 producerRole = 0;

    mapping(bytes32 => bool) rewardedBlocks;

    function verifyClaim(bytes memory _blockHeader, 
                        bytes memory _relayerSig, 
                        bytes memory _producerSig,
                        address _cluster,
                        bool _isAggregated) 
                        public 
                        returns(bytes32, address, uint) {
        bytes32 blockHash = keccak256(_blockHeader);
        require(!rewardedBlocks[blockHash], "Block header already rewarded");
        bytes memory coinBase = extractCoinBase(_blockHeader);
        uint blockNumber = extractBlockNumber(_blockHeader);
        address actualProducer = coinbaseLinker.getProducer(coinBase);
        address relayer = recoverSigner(blockHash, _relayerSig);

        require(clusterRegistry.getClusterStatus(_cluster) == 2, "Verifier_Producer: Cluster isn't active");
        require(Cluster(_cluster).isRelayer(relayer), "Verifier_Producer: Relayer isn't part of cluster");

        bytes memory producerSigPayload = abi.encodePacked(_blockHeader, _relayerSig);
        address extractedProducer = recoverSigner(keccak256(producerSigPayload), _producerSig);
        require(extractedProducer == actualProducer, "Verifier_Producer: Producer sig doesn't match coinbase");
        bytes32 ticket = keccak256(abi.encodePacked(producerSigPayload, _producerSig));
        uint epoch = pot.getEpoch(blockNumber);
        uint luckLimit = luckManager.getLuck(epoch, producerRole);
        require(uint(luckLimit) > uint(ticket), "Verifier_Producer: Ticket not in winning range");
        if(pot.getPotValue(epoch) == 0) {
            uint[] memory epochs;
            uint[] memory values;
            uint[][] memory inflationLog = fundManager.draw(address(pot));
            for(uint i=0; i < inflationLog[0].length-1; i++) {
                for(uint j=inflationLog[0][i]; j < inflationLog[0][i+1]; j++) {
                    epochs[epochs.length] = j;
                    values[values.length] = inflationLog[1][i];
                }
            }
            require(pot.addToPot(epochs, address(fundManager), values), "Verifier_Producer: Could not add to pot");
        }
        //TODO: If encoderv2 can be used then remove isAggregated
        if(!_isAggregated) {
            //TODO: Find if there is a better way to initialize dynamic arrays
            bytes32[] memory roles;
            address[] memory claimers;
            uint[] memory epochs;
            roles[0] = producerRole;
            claimers[0] = actualProducer;
            epochs[0] = epoch;
            require(pot.claimTicket(roles, claimers, epochs), 
                    "Verifier_Producer: Ticket claim failed");
        }
        rewardedBlocks[blockHash] = true;
        return (producerRole, actualProducer, epoch);
    }

    function verifyClaims(bytes[] memory _blockHeaders, 
                          bytes[] memory _relayerSigs, 
                          bytes[] memory _producerSigs, 
                          address[] memory _clusters) 
                          public {
        require(_blockHeaders.length == _relayerSigs.length && 
                _relayerSigs.length == _producerSigs.length &&
                _producerSigs.length == _clusters.length
                , "Verifier_Producer: Invalid Inputs");
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
        require(pot.claimTicket(roles, claimers, epochs), "Verifier_Producer: Aggregate ticket claim failed");
    }

    function extractCoinBase(bytes memory blockHeader) public view returns(bytes memory) {
        // TODO: Implementation specific for blockchain
    }

    function extractBlockNumber(bytes memory blockHeader) public view returns(uint) {
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