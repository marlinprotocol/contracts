// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "../Token/TokenLogic.sol";
import "../Fund/Pot.sol";

contract ClusterRegistry {

    TokenLogic LINProxy = TokenLogic(address(0));
    Pot pot = Pot(address(0));

    struct ClusterData {
        uint status;
        uint stake;
        uint startEpoch;
        uint exitEpoch;
    }

    mapping(address => ClusterData) clusters;
    uint clusterExitWaitEpochs;

    uint minStakeAmount;

    //todo: Think about if a contract which does not conform to cluster contract spec joins
    //todo: Think if there will be queuing of clusters
    function addCluster(uint _stakeValue) public {
        ClusterData memory cluster = clusters[msg.sender];
        require(cluster.stake + _stakeValue >= minStakeAmount, "ClusterRegistry: Stake less than min reqd stake");
        clusters[msg.sender].stake = cluster.stake + _stakeValue;
        clusters[msg.sender].startEpoch = pot.getEpoch(block.number) + 1;
        if(cluster.status != 4 && cluster.status != 2) {
            cluster.status = 1;
        }
        require(LINProxy.transferFrom(msg.sender, address(this), _stakeValue), "ClusterRegistry: Stake not received");
    }

    function proposeExit() public {
        if(clusters[msg.sender].exitEpoch == 0) {
            clusters[msg.sender].status = 4;
            clusters[msg.sender].exitEpoch = pot.getEpoch(block.number) + clusterExitWaitEpochs;
        }
    }

    function exit() public {
        ClusterData memory cluster = clusters[msg.sender];
        require(cluster.status == 4 && pot.getEpoch(block.number) > cluster.exitEpoch, 
                "ClusterRegistry: Exit conditions not met");
        require(LINProxy.transfer(msg.sender, cluster.stake), "ClusterRegistry: Remaining stake couldn't be returned");
        delete clusters[msg.sender];
    }

    // 0- doesn't exist, 1 - waitingToJoin 2 - active 3 - stakeBelowRequired 4 - exiting
    function getClusterStatus(address _clusterAddress) public returns(uint) {
        ClusterData memory cluster = clusters[_clusterAddress];
        if(cluster.status == 1) {
            if(pot.getEpoch(block.number) >= cluster.startEpoch) {
                clusters[_clusterAddress].status = 2;
                cluster.status = 2;
            }
        }
        return cluster.status;
    }

    //todo: slashing to be implemented
}