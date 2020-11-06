pragma solidity 0.5.17;

import "./StandardOracle.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";


contract ValidatorRegistry is StandardOracle {
    mapping(uint256 => mapping(bytes32 => bool)) public validators;
    mapping(uint256 => bool) public freezeValidators;
    mapping(uint256 => uint256) public freezeTime;

    event AddValidator(uint256 indexed, bytes32 indexed);
    event RemoveValidator(uint256 indexed, bytes32 indexed);
    event FreezeValidatorEpoch(uint256 indexed);

    function addValidator(uint256 _epoch, bytes32 _validatorAddress)
        public
        onlySource
        isEpochNotFrozen(_epoch)
    {
        require(
            _validatorAddress != bytes32(0),
            "Should be non-zero address hash"
        );
        require(
            !validators[_epoch][_validatorAddress],
            "Cannot add validator in that epoch, if it is already added in the registry"
        );
        validators[_epoch][_validatorAddress] = true;
        emit AddValidator(_epoch, _validatorAddress);
    }

    function addValidatorsBulk(uint256 _epoch, bytes32[] memory _validators)
        public
        onlySource
    {
        for (uint256 index = 0; index < _validators.length; index++) {
            addValidator(_epoch, _validators[index]);
        }
    }

    function removeValidator(uint256 _epoch, bytes32 _validatorAddress)
        public
        onlySource
        isEpochNotFrozen(_epoch)
    {
        require(
            _validatorAddress != bytes32(0),
            "Should be non-zero address hash"
        );
        validators[_epoch][_validatorAddress] = false;
        emit RemoveValidator(_epoch, _validatorAddress);
    }

    function freezeEpoch(uint256 _epoch)
        public
        onlySource
        isEpochNotFrozen(_epoch)
    {
        freezeValidators[_epoch] = true;
        freezeTime[_epoch] = block.timestamp;
        emit FreezeValidatorEpoch(_epoch);
    }

    modifier isEpochNotFrozen(uint256 _epoch) {
        require(_epoch != 0, "Epoch should be non-zero");
        require(
            freezeValidators[_epoch] == false,
            "Epoch should not be frozen for adding validators"
        );
        _;
    }
}
