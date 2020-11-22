pragma solidity >=0.4.21 <0.7.0;

contract ClusterRegistry {

    struct Stake {
        uint256 mpond;
        uint256 pond;
    }

    struct Cluster {
        uint256 commission;
        address rewardAddress;
        Stake totalDelegation;
        mapping(address => Stake) delegators;
    }

    mapping(address => Cluster) clusters;

    uint256 public undelegationWaitTime;

    event ClusterRegistered(address cluster, uint256 commission, address rewardAddress);
    event CommissionUpdated(address cluster, uint256 updatedCommission);
    event RewardAddressUpdated(address cluster, address updatedRewardAddress);

    function register(uint256 _commission, address _rewardAddress) public returns(bool) {
        // TODO: Make sure  cluster is  not already registered
        // require(clusters[address]);
        clusters[msg.sender] = Cluster(_commission, _rewardAddress, Stake(0, 0));
        emit ClusterRegistered(msg.sender, _commission, _rewardAddress);
    }

    function updateCommission(uint256 _commission) public {
        // TODO: Make sure  cluster is already registered
        clusters[msg.sender].commission = _commission;
        emit CommissionUpdated(msg.sender, _commission);
    }

    function updateRewardAddress(address _rewardAddress) public {
        // TODO: Make sure  cluster is already registered
        clusters[msg.sender].rewardAddress = _rewardAddress;
        emit RewardAddressUpdated(msg.sender, _rewardAddress);
    }

    function unregister() public {
        // TODO: Make sure  cluster is already registered
        clusters[msg.sender]
    }

    function isValidCluster() public {

    }

    function isClusterValid(address _cluster) public returns(bool) {

    }

    function delegate(address _delegator, address _cluster, uint256 _amount, uint256 _tokenType) public {

    }

    function undelegate(address _delegator, address _cluster, uint256 _amount, uint256 _tokenType) public {

    }
}