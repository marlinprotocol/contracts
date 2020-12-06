pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

contract ClusterRegistry is Initializable {

    using SafeMath for uint256;

    struct Cluster {
        uint256 commission;
        address rewardAddress;
        address clientKey;
        Status status;
    }

    mapping(address => Cluster) public clusters;

    enum Status{NOT_REGISTERED, REGISTERED}

    event ClusterRegistered(address cluster, uint256 commission, address rewardAddress, address clientKey);
    event CommissionUpdated(address cluster, uint256 updatedCommission);
    event RewardAddressUpdated(address cluster, address updatedRewardAddress);
    event ClusterUnregistered(address cluster);

    function initialize() 
        public 
        initializer
    {

    }

    function register(uint256 _commission, address _rewardAddress, address _clientKey) public returns(bool) {
        require(
            clusters[msg.sender].status == Status.NOT_REGISTERED, 
            "ClusterRegistry:register - Cluster is already registered"
        );
        require(_commission <= 100, "ClusterRegistry:register - Commission can't be more than 100%");
        clusters[msg.sender].commission = _commission;
        clusters[msg.sender].rewardAddress = _rewardAddress;
        clusters[msg.sender].clientKey = _clientKey;
        clusters[msg.sender].status = Status.REGISTERED;
        
        emit ClusterRegistered(msg.sender, _commission, _rewardAddress, _clientKey);
    }

    function updateCommission(uint256 _commission) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateCommission - Cluster not registered"
        );
        require(_commission <= 100, "ClusterRegistry:updateCommission - Commission can't be more than 100%");
        clusters[msg.sender].commission = _commission;
        emit CommissionUpdated(msg.sender, _commission);
    }

    function updateRewardAddress(address _rewardAddress) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateRewardAddress - Cluster not registered"
        );
        clusters[msg.sender].rewardAddress = _rewardAddress;
        emit RewardAddressUpdated(msg.sender, _rewardAddress);
    }

    function updateClientKey(address _clientKey) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateClientKey - Cluster not registered"
        );
        clusters[msg.sender].clientKey = _clientKey;
    }

    function unregister() public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateCommission - Cluster not registered"
        );
        clusters[msg.sender].status = Status.NOT_REGISTERED;
        emit ClusterUnregistered(msg.sender);
    }

    function isClusterValid(address _cluster) public view returns(bool) {
        return (clusters[_cluster].status != Status.NOT_REGISTERED);
    }

    function getCommission(address _cluster) public view returns(uint256) {
        return clusters[_cluster].commission;
    }

    function getRewardAddress(address _cluster) public view returns(address) {
        return clusters[_cluster].rewardAddress;
    }
}