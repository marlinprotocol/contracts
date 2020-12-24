pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

contract ClusterRegistry is Initializable {

    using SafeMath for uint256;

    uint256 constant UINT256_MAX = ~uint256(0);

    struct Cluster {
        uint256 commission;
        address rewardAddress;
        address clientKey;
        bytes32 networkId; // keccak256("ETH") // token ticker for anyother chain in place of ETH
        Status status;
    }

    mapping(address => Cluster) public clusters;

    enum Status{NOT_REGISTERED, REGISTERED}

    event ClusterRegistered(
        address cluster, 
        bytes32 networkId, 
        uint256 commission, 
        address rewardAddress, 
        address clientKey
    );
    event CommissionUpdated(address cluster, uint256 updatedCommission);
    event RewardAddressUpdated(address cluster, address updatedRewardAddress);
    event NetworkSwitched(address cluster, bytes32 networkId);
    event ClientKeyUpdated(address cluster, address clientKey);
    event ClusterUnregistered(address cluster);

    function initialize() 
        public 
        initializer
    {

    }

    function register(
        bytes32 _networkId, 
        uint256 _commission, 
        address _rewardAddress, 
        address _clientKey
    ) public returns(bool) {
        // This happens only when the data of the cluster is registered or it wasn't registered before
        require(
            clusters[msg.sender].status == Status.NOT_REGISTERED, 
            "ClusterRegistry:register - Cluster is already registered"
        );
        require(_commission <= 100, "ClusterRegistry:register - Commission can't be more than 100%");
        clusters[msg.sender].commission = _commission;
        clusters[msg.sender].rewardAddress = _rewardAddress;
        clusters[msg.sender].clientKey = _clientKey;
        clusters[msg.sender].networkId = _networkId;
        clusters[msg.sender].status = Status.REGISTERED;
        
        emit ClusterRegistered(msg.sender, _networkId, _commission, _rewardAddress, _clientKey);
    }

    function updateCluster(uint256 _commission, bytes32 _networkId, address _rewardAddress, address _clientKey) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateCluster - Cluster not registered"
        );
        if(_networkId != bytes32(0)) {
            clusters[msg.sender].networkId = _networkId;
            emit NetworkSwitched(msg.sender, _networkId);
        }
        if(_rewardAddress != address(0)) {
            clusters[msg.sender].rewardAddress = _rewardAddress;
            emit RewardAddressUpdated(msg.sender, _rewardAddress);
        }
        if(_clientKey != address(0)) {
            clusters[msg.sender].clientKey = _clientKey;
            emit ClientKeyUpdated(msg.sender, _clientKey);
        }
        if(_commission != UINT256_MAX) {
            require(_commission <= 100, "ClusterRegistry:updateCluster - Commission can't be more than 100%");
            clusters[msg.sender].commission = _commission;
            emit CommissionUpdated(msg.sender, _commission);
        }
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

    function switchNetwork(bytes32 _networkId) public {
        require(
            clusters[msg.sender].status != Status.NOT_REGISTERED,
            "ClusterRegistry:updateCommission - Cluster not registered"
        );
        clusters[msg.sender].networkId = _networkId;
        emit NetworkSwitched(msg.sender, _networkId);
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
        emit ClientKeyUpdated(msg.sender, _clientKey);
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