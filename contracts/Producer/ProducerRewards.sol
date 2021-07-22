pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract ProducerRewards is Initializable, Ownable {
    
    using SafeMath for uint256;

    mapping(uint256 => uint256) public rewardDistributedPerEpoch;
    uint256 public rewardDistributionWaitTime;
    uint256 public latestNewEpochRewardAt;
    uint256 public totalRewardPerEpoch;
    uint256 public maxTotalWeight;
    address public feeder;
    ERC20 POND;
    
    event EmergencyWithdraw(address indexed _token, uint256 _amount, address indexed _to);
    event RewardDistributed(address indexed producerAddress, uint256 reward);
    event TotalRewardsPerEpochUpdated(uint256 totalRewardPerEpoch);
    event MaxTotalWeightUpdated(uint256 maxTotalWeight);
    event PONDAddressUpdated(address indexed newPOND);
    event FeederUpdated(address indexed feeder);

    modifier onlyFeeder() {
        require(msg.sender == feeder, "Sender not feeder");
        _;
    }

    function initialize(
        uint256 _rewardDistributionWaitTime,
        uint256 _totalRewardPerEpoch,
        address _PONDAddress,
        address _owner,
        address _feeder,
        uint256 _maxTotalWeight
    ) public initializer {
        super.initialize(_owner);
        rewardDistributionWaitTime = _rewardDistributionWaitTime;
        totalRewardPerEpoch = _totalRewardPerEpoch;
        POND = ERC20(_PONDAddress);
        feeder = _feeder;
        maxTotalWeight = _maxTotalWeight;
    }

    function distributeRewards (
        address[] calldata _addresses, 
        uint256[] calldata _weights,
        uint256 _epoch
    ) external onlyFeeder {
        require(
            _addresses.length == _weights.length,
            "PR:DR-Length mismatch"
        );
        uint256 rewardDistributed = rewardDistributedPerEpoch[_epoch];
        if(rewardDistributed == 0) {
            require(
                block.timestamp > latestNewEpochRewardAt.add(rewardDistributionWaitTime), 
                "PR:DRW-Cant distribute reward for new epoch within such short interval"
            );
            latestNewEpochRewardAt = block.timestamp;
        }
        uint256 currentTotalRewardsPerEpoch = totalRewardPerEpoch;

        // calculate producer reward and transfer
        for (uint256 i = 0; i < _weights.length; i++) {
            uint256 reward = currentTotalRewardsPerEpoch.mul(_weights[i]).div(maxTotalWeight);
            rewardDistributed = rewardDistributed.add(reward);
            POND.transfer(_addresses[i], reward);
            emit RewardDistributed(_addresses[i], reward);
        }
        require(
            rewardDistributed <= currentTotalRewardsPerEpoch, 
            "PR:DRW-Reward Distributed  cant  be more  than totalRewardPerEpoch"
        );
        rewardDistributedPerEpoch[_epoch] = rewardDistributed;
    }

    function emergencyWithdraw(
        address _token,
        uint256 _amount,
        address _to
    ) external onlyOwner {
        IERC20(_token).transfer(_to, _amount);
        emit EmergencyWithdraw(_token, _amount, _to);
    }

    function updatePONDAddress(address _newPOND) external onlyOwner {
        require(
            _newPOND != address(0),
            "PR:UPA-POND token address cant be 0"
        );
        POND = ERC20(_newPOND);
        emit PONDAddressUpdated(_newPOND);
    }

    function updatemaxTotalWeight(uint256 _maxTotalWeight) external onlyOwner {
        maxTotalWeight = _maxTotalWeight;
        emit MaxTotalWeightUpdated(_maxTotalWeight);
    }

    function updatetotalRewardPerEpoch(uint256 _totalRewardPerEpoch) external onlyOwner {
        totalRewardPerEpoch = _totalRewardPerEpoch;
        emit TotalRewardsPerEpochUpdated(_totalRewardPerEpoch);
    }

    function updateFeeder(address _feeder) external onlyOwner {
        require(
            _feeder != address(0),
            "PR:UF-feeder address address cant be 0"
        );
        feeder = _feeder;
        emit FeederUpdated(_feeder);
    }
}
