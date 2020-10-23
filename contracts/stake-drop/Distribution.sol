pragma solidity >=0.4.21 <0.7.0;

import "./AddressRegistry.sol";
import "./StakeRegistry.sol";
import "./ValidatorRegistry.sol";
import "./CompLogic.sol";


contract Distribution {
    using SafeMath for uint256;
    address admin;
    ValidatorRegistry validatorRegistry;
    StakeRegistry stakeRegistry;
    AddressRegistry addressRegistry;
    CompLogic mpond;
    uint256 pondRewardPerEpoch = 1e18; //assuming 1 mPond per epoch

    mapping(uint8 => mapping(bytes32 => uint256)) withdrawnBalance;
    event ClaimMpond(address indexed, uint8 indexed, bytes32, uint256);
    event ClaimBulkMpond(
        address indexed,
        uint8 indexed,
        uint8 indexed,
        bytes32,
        uint256
    );

    constructor(
        address _validatorRegistry,
        address _stakeRegistry,
        address _addressRegistry,
        address _tokenAddress
    ) public {
        admin = msg.sender;
        validatorRegistry = ValidatorRegistry(_validatorRegistry);
        stakeRegistry = StakeRegistry(_stakeRegistry);
        addressRegistry = AddressRegistry(_addressRegistry);
        mpond = CompLogic(_tokenAddress);
    }

    function addTokens(uint256 _amount) public returns (bool) {
        mpond.transferFrom(msg.sender, address(this), _amount);
        return true;
    }

    function removeTokens(uint256 _amount) public returns (bool) {
        require(msg.sender == admin, "Only owner can remove tokens");
        mpond.transfer(msg.sender, _amount);
        return true;
    }

    function claimReward(uint8 _epoch, bytes32 _stakingAddress)
        public
        returns (bool)
    {
        require(
            addressRegistry.getAddress(_stakingAddress) == msg.sender,
            "Should be valid address"
        );
        uint256 balanceToWithdraw = getReward(_epoch, _stakingAddress);
        uint256 claimedBalance = withdrawnBalance[_epoch][_stakingAddress];
        require(
            claimedBalance == 0,
            "User should not have claimed balance for this epoch already"
        );
        withdrawnBalance[_epoch][_stakingAddress] = balanceToWithdraw;
        mpond.transfer(msg.sender, balanceToWithdraw);
        emit ClaimMpond(msg.sender, _epoch, _stakingAddress, balanceToWithdraw);
        return true;
    }

    function claimRewardAccrossEpoch(
        uint8 _startEpoch,
        uint8 _endEpoch,
        bytes32 _stakingAddress
    ) public returns (bool) {
        require(
            addressRegistry.getAddress(_stakingAddress) == msg.sender,
            "Should be valid address"
        );
        uint256 totalWithdrawBalance;
        for (uint8 index = _startEpoch; index <= _endEpoch; index++) {
            uint256 balanceToWithdraw = getReward(index, _stakingAddress);
            uint256 claimedBalance = withdrawnBalance[index][_stakingAddress];
            require(
                claimedBalance == 0,
                "User should not have claimed balance for this epoch already"
            );
            withdrawnBalance[index][_stakingAddress] = balanceToWithdraw;
            totalWithdrawBalance = totalWithdrawBalance.add(balanceToWithdraw);
        }
        mpond.transfer(msg.sender, totalWithdrawBalance);
        emit ClaimBulkMpond(
            msg.sender,
            _startEpoch,
            _endEpoch,
            _stakingAddress,
            totalWithdrawBalance
        );
        return true;
    }

    function getReward(uint8 _epoch, bytes32 _stakingAddress)
        public
        view
        returns (uint256)
    {
        require(_epoch > 1, "Epoch should be greater than 1");
        require(
            validatorRegistry.isFrozen(_epoch),
            "Epoch should not be frozen"
        );
        uint256 amount;
        (uint256 stakingValue, uint256 totalStake) = stakeRegistry
            .getStakeDetails(_epoch, _stakingAddress);
        if (_epoch == addressRegistry.getStartEpoch(_stakingAddress)) {
            // get partial reward
            uint256 startTime = validatorRegistry.getEpochEndTime(_epoch);
            uint256 endTime = validatorRegistry.getEpochEndTime(_epoch + 1);
            uint256 weightTime = addressRegistry.getTimestamp(_stakingAddress);
            amount = (weightTime.sub(startTime))
                .mul(pondRewardPerEpoch)
                .mul(stakingValue)
                .div(totalStake)
                .div(endTime.sub(startTime));
        } else {
            // get full reward
            amount = pondRewardPerEpoch.mul(stakingValue).div(totalStake);
        }
        return amount;
    }
}
