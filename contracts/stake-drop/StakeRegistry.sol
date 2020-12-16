pragma solidity 0.5.17;

import "./StandardOracle.sol";
import "./SafeMath.sol";
import "./ValidatorRegistry.sol";


contract StakeRegistry is StandardOracle {
    using SafeMath for uint256;

    mapping(uint256 => uint256) public totalStake;
    mapping(uint256 => uint256) public rewardedStake;
    mapping(bytes32 => uint256) public rewardPerAddress;
    ValidatorRegistry public validatorRegistry;

    address public governanceProxy;
    uint256 public rewardPerEpoch = 0; // 1 mPond per epoch

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

    function addTotalStakeForEpoch(uint256 _epoch, uint256 _amount)
        public
        onlySource
    {
        require(_epoch != 0, "Epoch should not be equal to zero");
        require(_amount != 0, "Total Stake in the era should be non-zero");
        require(
            validatorRegistry.freezeTime(_epoch) != 0,
            "Add TotalStake data only after validator list is frozen"
        );
        totalStake[_epoch] = _amount;
    }

    function changeRewardPerEpoch(uint256 _newRewardPerEpoch)
        public
        onlyGovernance
    {
        rewardPerEpoch = _newRewardPerEpoch;
    }

    function addStake(
        uint256 _epoch,
        bytes32 _stakingAddressHash,
        bytes32 _validatorAddressHash,
        uint256 _amount
    ) public onlySource {
        require(_amount != 0, "Amount should be non-zero");
        require(_epoch != 0, "Epoch should be greater than zero");
        require(
            _stakingAddressHash != bytes32(0),
            "Staking Address Hash should be non-zero"
        );
        require(
            _validatorAddressHash != bytes32(0),
            "Validator Address Hash should be non-zero"
        );
        require(
            validatorRegistry.freezeTime(_epoch) != 0,
            "Add Stake data only after validator list is frozen"
        );
        require(
            totalStake[_epoch] != 0,
            "Stake shoud be added only after totalStake is updated"
        );
        require(
            validatorRegistry.validators(_epoch, _validatorAddressHash),
            "Stake delegated to only whitelisted validator can be added"
        );
        uint256 _newTotal = rewardedStake[_epoch].add(_amount);
        rewardedStake[_epoch] = _newTotal;

        require(
            _newTotal <= totalStake[_epoch],
            "Stake should be rewarded for tokens less than or equal to the total"
        );
        rewardPerAddress[_stakingAddressHash] = rewardPerAddress[_stakingAddressHash]
            .add(rewardPerEpoch.mul(_amount).div(totalStake[_epoch]));
        emit StakeAdded(
            _epoch,
            _stakingAddressHash,
            _validatorAddressHash,
            _amount
        );
    }

    function addStakeBulk(
        uint256 _epoch,
        bytes32[] memory _stakingAddresses,
        bytes32[] memory _validatorAddresses,
        uint256[] memory _amounts
    ) public onlySource {
        require(_stakingAddresses.length == _amounts.length, "Arity mismatch");
        require(
            _stakingAddresses.length == _validatorAddresses.length,
            "Arity mismatch"
        );
        for (uint256 index = 0; index < _stakingAddresses.length; index++) {
            addStake(
                _epoch,
                _stakingAddresses[index],
                _validatorAddresses[index],
                _amounts[index]
            );
        }
    }

    modifier onlyGovernance() {
        require(msg.sender == governanceProxy, "Only Governance can change");
        _;
    }
}
