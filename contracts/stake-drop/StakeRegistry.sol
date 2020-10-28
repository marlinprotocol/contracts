pragma solidity >=0.4.21 <0.7.0;

import "./StandardOracle.sol";
import "./SafeMath.sol";
import "./ValidatorRegistry.sol";


contract StakeRegistry is StandardOracle {
    using SafeMath for uint256;

    mapping(uint256 => uint256) totalStake;
    mapping(bytes32 => uint256) rewardPerAddress;
    ValidatorRegistry validatorRegistry;

    address governanceProxy;
    uint256 rewardPerEpoch = 1e18; // 1 mPond per epoch

    constructor(address _validatorRegistry, address _governanceProxy)
        public
        StandardOracle()
    {
        validatorRegistry = ValidatorRegistry(_validatorRegistry);
        governanceProxy = _governanceProxy;
    }

    event StakeAdded(
        uint256 indexed,
        bytes32 indexed,
        bytes32 indexed,
        uint256
    );
    event StakeSkipped(
        uint256 indexed,
        bytes32 indexed,
        bytes32 indexed,
        uint256
    );

    function getReward(bytes32 _stakingAddressHash)
        public
        view
        returns (uint256)
    {
        return rewardPerAddress[_stakingAddressHash];
    }

    function addTotalStakeForEpoch(uint256 _epoch, uint256 _amount)
        public
        onlySource
        returns (bool)
    {
        require(_epoch != 0, "Epoch should not be equal to zero");
        require(_amount != 0, "Total Stake in the era should be non-zero");
        require(
            validatorRegistry.isFrozen(_epoch),
            "Add TotalStake data only after validator list is frozen"
        );
        totalStake[_epoch] = _amount;
        return true;
    }

    function changeRewardPerEpoch(uint256 _newRewardPerEpoch)
        public
        onlyGovernance
        returns (bool)
    {
        rewardPerEpoch = _newRewardPerEpoch;
        return true;
    }

    function addStake(
        uint256 _epoch,
        bytes32 _stakingAddressHash,
        bytes32 _validatorAddressHash,
        uint256 _amount
    ) public onlySource returns (bool) {
        require(_amount != 0, "Amount should be non-zero");
        require(_epoch > 0, "Epoch should be greater than zero");
        require(
            _stakingAddressHash != bytes32(0),
            "Staking Address Hash should be non-zero"
        );
        require(
            _validatorAddressHash != bytes32(0),
            "Validator Address Hash should be non-zero"
        );
        require(
            validatorRegistry.isFrozen(_epoch),
            "Add Stake data only after validator list is frozen"
        );
        require(
            totalStake[_epoch] != 0,
            "Stake shoud be added only after totalStake is updated"
        );
        if (validatorRegistry.isValidator(_epoch, _validatorAddressHash)) {
            // rewardPerStake = rewardPerEpoch * amount / totalStake
            rewardPerAddress[_stakingAddressHash] = rewardPerAddress[_stakingAddressHash]
                .add(rewardPerEpoch.mul(_amount).div(totalStake[_epoch]));
            emit StakeAdded(
                _epoch,
                _stakingAddressHash,
                _validatorAddressHash,
                _amount
            );
        } else {
            emit StakeSkipped(
                _epoch,
                _stakingAddressHash,
                _validatorAddressHash,
                _amount
            );
        }
        return true;
    }

    function addStakeBulk(
        uint256 _epoch,
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
            require(result, "Failed bulk adding stake");
        }
        return true;
    }

    modifier onlyGovernance() {
        require(msg.sender == governanceProxy, "Only Governance can change");
        _;
    }
}
