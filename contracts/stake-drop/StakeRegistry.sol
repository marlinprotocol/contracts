pragma solidity >=0.4.21 <0.7.0;

import "./StandardOracle.sol";
import "./SafeMath.sol";
import "./ValidatorRegistry.sol";


contract StakeRegistry is StandardOracle {
    using SafeMath for uint256;
    struct Epoch {
        mapping(bytes32 => uint256) stakes;
        uint256 totalStake;
    }
    // mapping(uint8 => mapping(bytes32 => uint256)) stakes;
    // mapping(uint8 => uint256) totalStake;
    mapping(uint8 => Epoch) registry;
    ValidatorRegistry validatorRegistry;

    constructor(address _validatorRegistry) public StandardOracle() {
        validatorRegistry = ValidatorRegistry(_validatorRegistry);
    }

    event StakeAdded(uint8 indexed, bytes32 indexed, bytes32 indexed, uint256);
    event StakeSkipped(
        uint8 indexed,
        bytes32 indexed,
        bytes32 indexed,
        uint256
    );
    event StakeChanged(
        uint8 indexed,
        bytes32 indexed,
        uint256 indexed,
        uint256
    );

    function getStakeDetails(uint8 _epoch, bytes32 _stakingAddress)
        public
        view
        returns (uint256, uint256)
    {
        Epoch memory e = registry[_epoch];
        uint256 currentStake = registry[_epoch].stakes[_stakingAddress];
        return (currentStake, e.totalStake);
    }

    function addStake(
        uint8 _epoch,
        bytes32 _stakingAddress,
        bytes32 _validatorAddress,
        uint256 _amount
    ) public onlySource returns (bool) {
        require(
            registry[_epoch].stakes[_stakingAddress] == 0,
            "Existing stake should be 0"
        );
        if (validatorRegistry.isValidator(_epoch, _validatorAddress)) {
            registry[_epoch].stakes[_stakingAddress] = registry[_epoch]
                .stakes[_stakingAddress]
                .add(_amount);
            registry[_epoch].totalStake = registry[_epoch].totalStake.add(
                _amount
            );
            emit StakeAdded(
                _epoch,
                _stakingAddress,
                _validatorAddress,
                _amount
            );
        } else {
            emit StakeSkipped(
                _epoch,
                _stakingAddress,
                _validatorAddress,
                _amount
            );
        }
        return true;
    }

    function addStakeBulk(
        uint8 _epoch,
        bytes32[] memory _stakingAddresses,
        bytes32[] memory _validatorAddresses,
        uint256[] memory _amounts
    ) public onlySource returns (bool) {
        require(_stakingAddresses.length == _amounts.length, "Arity mismatch");
        require(
            _stakingAddresses.length == _validatorAddresses.length,
            "Arity mismatch"
        );
        for (uint256 index = 0; index < _stakingAddresses.length; index++) {
            bool result = addStake(
                _epoch,
                _stakingAddresses[index],
                _validatorAddresses[index],
                _amounts[index]
            );
            require(!result, "Failed bulk adding stake");
        }
        return true;
    }

    function addExtraStake(
        uint8 _epoch,
        bytes32 _stakingAddress,
        uint256 _amount
    ) public onlySource returns (bool) {
        registry[_epoch].stakes[_stakingAddress] = registry[_epoch]
            .stakes[_stakingAddress]
            .add(_amount);
        registry[_epoch].totalStake = registry[_epoch].totalStake.add(_amount);
        emit StakeChanged(
            _epoch,
            _stakingAddress,
            registry[_epoch].stakes[_stakingAddress],
            registry[_epoch].totalStake
        );
        return true;
    }

    function removeExistingStake(
        uint8 _epoch,
        bytes32 _stakingAddress,
        uint256 _amount
    ) public onlySource returns (bool) {
        registry[_epoch].stakes[_stakingAddress] = registry[_epoch]
            .stakes[_stakingAddress]
            .sub(_amount);
        registry[_epoch].totalStake = registry[_epoch].totalStake.sub(_amount);
        emit StakeChanged(
            _epoch,
            _stakingAddress,
            registry[_epoch].stakes[_stakingAddress],
            registry[_epoch].totalStake
        );
        return true;
    }
}
