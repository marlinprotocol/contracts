// SPDX-License-Identifier: <SPDX-License>

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../Token/TokenLogic.sol";
import "../Actors/Producer.sol";
import "../Actors/Cluster.sol";
import "../Actors/ClusterRegistry.sol";
import "../Fund/Pot.sol";
import "../Fund/FundManager.sol";
import "./LuckManager.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";


contract VerifierProducer is Initializable {
    using SafeMath for uint256;

    Producer producerRegistry;
    ClusterRegistryOld clusterRegistry;
    LuckManager luckManager;
    Pot pot;
    FundManager fundManager;
    bytes32 producerRole;
    bytes32 tokenId;
    bytes MarlinPrefix;

    mapping(bytes32 => bool) rewardedBlocks;

    function initialize(
        address _producerRegistry,
        address _clusterRegistry,
        address _luckManager,
        address _pot,
        address _fundManager,
        bytes32 _producerRole,
        bytes32 _tokenId
    ) public initializer {
        producerRegistry = Producer(_producerRegistry);
        clusterRegistry = ClusterRegistryOld(_clusterRegistry);
        luckManager = LuckManager(_luckManager);
        pot = Pot(_pot);
        fundManager = FundManager(_fundManager);
        producerRole = _producerRole;
        tokenId = _tokenId;
        MarlinPrefix = "\x19Marlin Producer Ticket:\n";
    }

    function verifyClaim(
        bytes memory _blockHeader,
        bytes memory _relayerSig,
        bytes memory _producerSig,
        address _cluster,
        bool _isAggregated
    )
        public
        returns (
            bytes32,
            address,
            uint256
        )
    {
        bytes32 messageHash = keccak256(
            abi.encodePacked(MarlinPrefix, uint256(40), _blockHeader)
        );
        require(!rewardedBlocks[messageHash], "Block header already rewarded");
        rewardedBlocks[messageHash] = true;
        bytes memory coinBase = extractCoinBase(_blockHeader);
        uint256 blockNumber = extractBlockNumber(_blockHeader);
        address actualProducer = producerRegistry.getProducer(coinBase);
        address relayer = recoverSigner(messageHash, _relayerSig);

        require(
            uint256(clusterRegistry.getClusterStatus(_cluster)) == 2,
            "Verifier_Producer: Cluster isn't active"
        );
        require(
            Cluster(_cluster).isRelayer(relayer),
            "Verifier_Producer: Relayer isn't part of cluster"
        );

        bytes memory producerSigPayload = abi.encodePacked(
            _blockHeader,
            _relayerSig
        );
        address extractedProducer = recoverSigner(
            keccak256(producerSigPayload),
            _producerSig
        );
        require(
            extractedProducer == actualProducer,
            "Verifier_Producer: Producer sig doesn't match coinbase"
        );
        bytes32 ticket = keccak256(
            abi.encodePacked(producerSigPayload, _producerSig)
        );
        uint256 epoch = pot.getEpoch(blockNumber);
        uint256 luckLimit = luckManager.getLuck(epoch, producerRole);
        require(
            uint256(luckLimit) > uint256(ticket),
            "Verifier_Producer: Ticket not in winning range"
        );
        if (pot.getPotValue(epoch, tokenId) == 0) {
            fundManager.draw(address(pot), block.number);
        }
        //TODO: If encoderv2 can be used then remove isAggregated
        if (!_isAggregated) {
            //TODO: Find if there is a better way to initialize dynamic arrays
            bytes32[] memory roles;
            address[] memory claimers;
            uint256[] memory epochs;
            roles[0] = producerRole;
            claimers[0] = actualProducer;
            epochs[0] = epoch;
            require(
                pot.claimTicket(roles, claimers, epochs),
                "Verifier_Producer: Ticket claim failed"
            );
        }

        return (producerRole, actualProducer, epoch);
    }

    function verifyClaims(
        bytes[] memory _blockHeaders,
        bytes[] memory _relayerSigs,
        bytes[] memory _producerSigs,
        address[] memory _clusters
    ) public {
        require(
            _blockHeaders.length == _relayerSigs.length &&
                _relayerSigs.length == _producerSigs.length &&
                _producerSigs.length == _clusters.length,
            "Verifier_Producer: Invalid Inputs"
        );
        bytes32[] memory roles;
        address[] memory claimers;
        uint256[] memory epochs;
        for (uint256 i = 0; i < _blockHeaders.length; i++) {
            (bytes32 role, address claimer, uint256 epoch) = verifyClaim(
                _blockHeaders[i],
                _relayerSigs[i],
                _producerSigs[i],
                _clusters[i],
                true
            );
            epochs[epochs.length] = epoch;
            claimers[claimers.length] = claimer;
            roles[roles.length] = role;
        }
        require(
            pot.claimTicket(roles, claimers, epochs),
            "Verifier_Producer: Aggregate ticket claim failed"
        );
    }

    function extractCoinBase(bytes memory blockHeader)
        public
        view
        returns (bytes memory)
    {
        // TODO: Implementation specific for blockchain
        return bytes("0x00");
    }

    function extractBlockNumber(bytes memory blockHeader)
        public
        view
        returns (uint256)
    {
        // TODO: Implementation specific for blockchain
        return 0;
    }

    //todo: Modify below 2 functions slightly
    function splitSignature(bytes memory sig)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
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
