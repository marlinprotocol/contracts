pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./RewardDelegators.sol";

contract ClusterRewards is Initializable, Ownable {

    using SafeMath for uint256;

    mapping(address => uint256) public clusterRewards;

    uint256 rewardPerEpoch;
    uint256 payoutDenomination;

    address rewardDelegatorsAddress;
    ERC20 POND;

    uint256 public currentEpoch;

    modifier onlyRewardDelegatorsContract() {
        require(msg.sender == rewardDelegatorsAddress);
        _;
    }

    function initialize(
        address _owner, 
        address _rewardDelegatorsAddress, 
        uint256 _rewardPerEpoch, 
        address _PONDAddress,
        uint256 _payoutDenomination) 
        public
        initializer
    {
        initialize(_owner);
        rewardDelegatorsAddress = _rewardDelegatorsAddress;
        rewardPerEpoch = _rewardPerEpoch;
        POND = ERC20(_PONDAddress);
        payoutDenomination = _payoutDenomination;
    }

    function feed(address[] memory _clusters, uint256[] memory _payouts) public onlyOwner {
        for(uint256 i=0; i < _clusters.length; i++) {
            clusterRewards[_clusters[i]] = clusterRewards[_clusters[i]].add(
                                                rewardPerEpoch.mul(_payouts[i]).div(payoutDenomination)
                                            );
        }
    }

    // only cluster registry is necessary because the rewards 
    // should be updated in the cluster registry against the cluster
    function claimReward(address _cluster) public onlyRewardDelegatorsContract returns(uint256) {
        uint256 pendingRewards = clusterRewards[_cluster];
        if(pendingRewards != 0) {
            transferRewards(rewardDelegatorsAddress, pendingRewards);
            delete clusterRewards[_cluster];
        }
        return pendingRewards;
    }

    function transferRewards(address _to, uint256 _amount) internal {
        POND.transfer(_to, _amount);
    }
}