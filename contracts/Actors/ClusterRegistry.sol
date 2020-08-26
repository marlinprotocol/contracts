// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "../Token/TokenLogic.sol";
import "../Fund/Pot.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
// import "@openzeppelin/contracts/math/SafeMath.sol";

contract ClusterRegistry is Initializable{
    using SafeMath for uint256;

    //todo: Should these addresses be editable by governance
    TokenLogic LINProxy;
    Pot pot;
    address GovernanceEnforcerProxy;

    enum ClusterStatus { DOESNT_EXIST, WAITING_TO_JOIN, ACTIVE, LOW_STAKE, EXITING}

    struct ClusterData {
        ClusterStatus status;
        uint stake;
        uint startEpoch;
        uint exitEpoch;
    }

    mapping(address => ClusterData) clusters;
    uint clusterExitWaitEpochs;
    uint minStakeAmount;

    //todo: add events 

    function initialize(address _defaultCluster, 
                uint _clusterExitWaitEpochs, 
                uint _minStakeAmount, 
                address _LINToken, 
                address _pot) 
                public
                initializer {
        clusters[_defaultCluster] = ClusterData(ClusterStatus.ACTIVE, 0, 0, 0);
        clusterExitWaitEpochs = _clusterExitWaitEpochs;
        minStakeAmount = _minStakeAmount;
        LINProxy = TokenLogic(_LINToken);
        pot = Pot(_pot);
    }

    modifier onlyGovernanceEnforcer() {
        require(msg.sender == address(GovernanceEnforcerProxy), 
                "Pot: Function can only be invoked by Governance Enforcer");
        _;
    }

    //todo: Think if there will be queuing of clusters
    function addCluster(uint _stakeValue) public returns(bool) {
        ClusterData memory cluster = clusters[msg.sender];
        require(cluster.stake.add(_stakeValue) >= minStakeAmount, "ClusterRegistry: Stake less than min reqd stake");
        clusters[msg.sender].stake = cluster.stake.add(_stakeValue);
        clusters[msg.sender].startEpoch = pot.getEpoch(block.number).add(1);
        if(cluster.status != ClusterStatus.EXITING && cluster.status != ClusterStatus.ACTIVE) {
            cluster.status = ClusterStatus.WAITING_TO_JOIN;
        }
        require(LINProxy.transferFrom(msg.sender, address(this), _stakeValue), "ClusterRegistry: Stake not received");
        return true;
    }

    function proposeExit() public {
        if(clusters[msg.sender].exitEpoch == 0) {
            clusters[msg.sender].status = ClusterStatus.EXITING;
            clusters[msg.sender].exitEpoch = pot.getEpoch(block.number).add(clusterExitWaitEpochs);
        }
    }

    function exit() public {
        ClusterData memory cluster = clusters[msg.sender];
        require(cluster.status == ClusterStatus.EXITING && pot.getEpoch(block.number) > cluster.exitEpoch, 
                "ClusterRegistry: Exit conditions not met");
        require(LINProxy.transfer(msg.sender, cluster.stake), "ClusterRegistry: Remaining stake couldn't be returned");
        delete clusters[msg.sender];
    }

    function getClusterStatus(address _clusterAddress) public returns(ClusterStatus) {
        ClusterData memory cluster = clusters[_clusterAddress];
        if(cluster.status == ClusterStatus.WAITING_TO_JOIN) {
            if(pot.getEpoch(block.number) >= cluster.startEpoch) {
                clusters[_clusterAddress].status = ClusterStatus.ACTIVE;
                cluster.status = ClusterStatus.ACTIVE;
            }
        }
        return cluster.status;
    }

    function changeClusterExitWaitEpochs(uint _updatedClusterExitWaitEpochs) 
                                        public 
                                        onlyGovernanceEnforcer 
                                        returns(bool) {
        clusterExitWaitEpochs = _updatedClusterExitWaitEpochs;
        return true;
    }

    function changeMinStakeAmount(uint _updatedMinStakeAmount) 
                                  public 
                                  onlyGovernanceEnforcer 
                                  returns(bool) {
        minStakeAmount = _updatedMinStakeAmount;
        return true;
    }

    //todo: slashing to be implemented in future versions
}