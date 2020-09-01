// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "../Token/TokenLogic.sol";
import "../Fund/Pot.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";


// import "@openzeppelin/contracts/math/SafeMath.sol";

contract ClusterRegistry is Initializable {
    using SafeMath for uint256;

    TokenLogic LINProxy;
    Pot pot;
    address public GovernanceEnforcerProxy;

    bool isClustersAccepted;

    enum ClusterStatus {DOESNT_EXIST, WAITING_TO_JOIN, ACTIVE, EXITING}

    struct ClusterData {
        ClusterStatus status;
        uint256 stake;
        uint256 startEpoch;
        uint256 exitEpoch;
    }

    mapping(address => ClusterData) public clusters;
    uint256 clusterExitWaitEpochs;
    uint256 minStakeAmount;

    event ClusterJoined(address cluster, uint256 stake);
    event ClusterStakeUpdated(address cluster, uint256 stake);
    event ClusterExitProposed(address cluster, uint256 exitEpoch);
    event ClusterExited(address cluster, uint256 stakeReturned, uint256 epoch);
    event ClusterExitWaitEpochsChanged(uint256 updatedExitWaitEpochs);
    event MinStakeChanged(uint256 updatedMinStake);

    function initialize(
        address _defaultCluster,
        uint256 _clusterExitWaitEpochs,
        uint256 _minStakeAmount,
        address _LINToken,
        address _pot,
        address _govProxy
    ) public initializer {
        clusters[_defaultCluster] = ClusterData(ClusterStatus.ACTIVE, 0, 0, 0);
        clusterExitWaitEpochs = _clusterExitWaitEpochs;
        minStakeAmount = _minStakeAmount;
        LINProxy = TokenLogic(_LINToken);
        pot = Pot(_pot);
        GovernanceEnforcerProxy = _govProxy;
    }

    modifier onlyGovernanceEnforcer() {
        require(
            msg.sender == address(GovernanceEnforcerProxy),
            "ClusterRegistry: Function can only be invoked by Governance Enforcer"
        );
        _;
    }

    function openClusterRegistry()
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        isClustersAccepted = true;
        return true;
    }

    function closeClusterRegistry()
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        isClustersAccepted = false;
        return true;
    }

    function addCluster(uint256 _stakeValue) public returns (bool) {
        ClusterData memory cluster = clusters[msg.sender]; //if this is updated, better to change it to storage
        require(
            isClustersAccepted,
            "ClusterRegistry: Clusters are not accepted"
        );
        require(
            cluster.stake.add(_stakeValue) >= minStakeAmount,
            "ClusterRegistry: Stake less than min reqd stake"
        );
        clusters[msg.sender].stake = cluster.stake.add(_stakeValue);
        if (cluster.status == ClusterStatus.DOESNT_EXIST) {
            clusters[msg.sender].status = ClusterStatus.WAITING_TO_JOIN;
            // cluster.status = ClusterStatus.WAITING_TO_JOIN;
            clusters[msg.sender].startEpoch = pot.getEpoch(block.number).add(1);
            emit ClusterJoined(msg.sender, cluster.stake.add(_stakeValue));
        } else {
            emit ClusterStakeUpdated(
                msg.sender,
                cluster.stake.add(_stakeValue)
            );
        }
        require(
            LINProxy.transferFrom(msg.sender, address(this), _stakeValue),
            "ClusterRegistry: Stake not received"
        );
        return true;
    }

    function proposeExit() public {
        if (clusters[msg.sender].exitEpoch == 0) {
            clusters[msg.sender].status = ClusterStatus.EXITING;
            uint256 exitEpoch = pot.getEpoch(block.number).add(
                clusterExitWaitEpochs
            );
            clusters[msg.sender].exitEpoch = exitEpoch;
            emit ClusterExitProposed(msg.sender, exitEpoch);
        }
    }

    function exit() public {
        ClusterData memory cluster = clusters[msg.sender];
        uint256 currentEpoch = pot.getEpoch(block.number);
        require(
            cluster.status == ClusterStatus.EXITING &&
                currentEpoch > cluster.exitEpoch,
            "ClusterRegistry: Exit conditions not met"
        );
        delete clusters[msg.sender];
        require(
            LINProxy.transfer(msg.sender, cluster.stake),
            "ClusterRegistry: Remaining stake couldn't be returned"
        );
        emit ClusterExited(msg.sender, cluster.stake, currentEpoch);
    }

    function getClusterStatus(address _clusterAddress)
        public
        returns (ClusterStatus)
    {
        ClusterData memory cluster = clusters[_clusterAddress];
        if (cluster.status == ClusterStatus.WAITING_TO_JOIN) {
            if (pot.getEpoch(block.number) >= cluster.startEpoch) {
                clusters[_clusterAddress].status = ClusterStatus.ACTIVE;
                cluster.status = ClusterStatus.ACTIVE;
            }
        }
        return cluster.status;
    }

    function changeClusterExitWaitEpochs(uint256 _updatedClusterExitWaitEpochs)
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        clusterExitWaitEpochs = _updatedClusterExitWaitEpochs;
        emit ClusterExitWaitEpochsChanged(_updatedClusterExitWaitEpochs);
        return true;
    }

    function changeMinStakeAmount(uint256 _updatedMinStakeAmount)
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        minStakeAmount = _updatedMinStakeAmount;
        emit MinStakeChanged(_updatedMinStakeAmount);
        return true;
    }
}
