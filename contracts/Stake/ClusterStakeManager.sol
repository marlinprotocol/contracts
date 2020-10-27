pragma solidity >=0.4.21 <0.7.0;

import  "./Stake.sol";
import "../Actors/Cluster.sol";
import "../Fund/Pot.sol";

// TODO: this is per network, a different stakemanager will be present for  a  different network ?
contract ClusterStakeManager {
    struct RelayerData {
        address cluster;
        uint status;
    }
    // TODO: Probably relayer stake is not necessary at all
    struct RelayerStake {
        uint pond;
        uint mpond;
        uint effectiveStake; // in pond
        uint pendingPondDelegation;
        uint pendingMpondDelegation;
        uint pendingPondUndelegation;
        uint pendingMpondUndelegation;
        uint updatedEpoch;
    }

    struct ClusterStake {
        uint pond;
        uint mpond;
        uint effectiveStake;
        uint pendingPondDelegation;
        uint pendingMpondDelegation;
        uint pendingPondUndelegation;
        uint pendingMpondUndelegation;
        uint updatedEpoch;
    }
    // relayer to cluster
    mapping(address => address) public relayerClusterMapping;
    // relayer to stakeData
    mapping(address => RelayerStake) delegatedStake;
    // cluster to stakeData
    mapping(address => ClusterStake) clusterStake;
    
    StakeManager stake;
    Pot pot;

    // TODO: Add events

    modifier onlyStakeMgr() {
        require(msg.sender == address(stake), "Only stake contract can invoke the function");
        _;
    }

    function joinCluster(address _cluster) public {
        address relayerCluster = relayerClusterMapping[msg.sender];
        require(relayerCluster == address(0), "Relayer is already part of another cluster");
        require(Cluster(_cluster).join(msg.sender), "Relayer entry rejected by Cluster");
        uint[2] memory relayerStake = stake.getDelegatedStake(1, msg.sender);
        ClusterStake memory cluster = clusterStake[_cluster];
        uint currentEpoch = pot.getEpoch(block.number);
        RelayerStake memory relayer = RelayerStake(0, 0, 0, relayerStake[0], relayerStake[1], 0, 0, currentEpoch);
        (relayer, cluster) = _updateStakes(currentEpoch, relayer, cluster);
        delegatedStake[msg.sender] = relayerStake;
        clusterStake.pendingPondDelegation += relayerStake[0];
        clusterStake.pendingMpondDelegation += relayerStake[1];
        relayerClusterMapping[msg.sender] = relayerCluster;
    }

    function exitCluster() public {
        address relayerCluster = relayerClusterMapping[msg.sender];
        require(relayerCluster != address(0), "Relayer is not part of any cluster");
        require(Cluster(relayerClusterMapping[msg.sender]).exit(msg.sender), "Relayer exit rejected by Cluster");
        RelayerStake memory relayer = delegatedStake[msg.sender];
        ClusterStake memory cluster = clusterStake[relayerCluster];
        uint currentEpoch = pot.getEpoch(block.number);
        (relayer, cluster) = _updateStakes(currentEpoch, relayer, cluster);
        // assuming no slashing
        cluster.pendingPondUndelegation -= relayer.pond;
        cluster.pendingMpondUndelegation -= relayer.mpond;
        delete relayerClusterMapping[msg.sender];

    }

    function notifyDelegation(address _delegatee, uint _tokenType, uint _amount) public onlyStakeMgr {
        address delegateeCluster = relayerClusterMapping[_delegatee];
        if(delegateeCluster != address(0)) {
            uint currentEpoch = pot.getEpoch(block.number);
            RelayerStake memory relayer = delegatedStake[_delegatee];
            ClusterStake memory cluster = clusterStake[delegateeCluster];
            (relayer, cluster) = _updateStakes(currentEpoch, relayer, cluster);
            if(_tokenType == 0) {
                relayer.pendingPondDelegation += _amount;
                cluster.pendingPondDelegation += _amount;

            } else if (_tokenType == 1) {
                relayer.pendingMpondDelegation += _amount;
                cluster.pendingMpondDelegation += _amount;
            }
            delegatedStake[_delegatee] = relayer;
            clusterStake[delegateeCluster] = cluster;
        }
    }

    function notifyUndelegation(address _undelegatee, uint _tokenType, uint _amount) public onlyStakeMgr {
        address undelegateeCluster = relayerClusterMapping[_undelegatee];
        if(undelegateeCluster != address(0)) {
            uint currentEpoch = pot.getEpoch(block.number);
            RelayerStake memory relayer = delegatedStake[_undelegatee];
            ClusterStake memory cluster = clusterStake[undelegateeCluster];
            (relayer, cluster) = _updateStakes(currentEpoch, relayer, cluster);
            if(_tokenType == 0) {
                relayer.pendingPondUndelegation += _amount;
                cluster.pendingPondUndelegation += _amount;

            } else if (_tokenType == 1) {
                relayer.pendingMpondUndelegation += _amount;
                cluster.pendingMpondUndelegation += _amount;
            }
            delegatedStake[_undelegatee] = relayer;
            clusterStake[undelegateeCluster] = cluster;
        }
    }

    function getDelegatedStake(address _cluster) public view returns(uint) {
        uint currentEpoch = pot.getEpoch(block.number);
        ClusterStake memory cluster = clusterStake[_cluster];
        if(currentEpoch > cluster.updatedEpoch) {
            return cluster.effectiveStake + (cluster.pendingPondDelegation - cluster.pendingMpondUndelegation) + (cluster.pendingMpondDelegation - cluster.pendingMpondUndelegation)*10**6;
        } else if(currentEpoch == cluster.updatedEpoch) {
            return cluster.effectiveStake;
        } else {
            assert(false, "currentEpoch can't be less than updatedEpoch");
        }
    }

    function _updateStakes(uint _currentEpoch, 
        RelayerStake memory _relayer, 
        ClusterStake memory _cluster) 
        internal 
        pure 
        returns(RelayerStake memory,
        ClusterStake memory) {
        if(_currentEpoch > _cluster.updatedEpoch) {
            // update cluster stakes as epoch changed and nnew stakes are applicable
            _cluster.pond += _cluster.pendingPondDelegation - _cluster.pendingPondUndelegation;
            _cluster.mpond += _cluster.pendingMpondDelegation - _cluster.pendingMpondUndelegation;
            _cluster.effectiveStake = _cluster.pond + _cluster.mpond * 10**6;
            _cluster.updatedEpoch = _currentEpoch;
            _cluster.pendingPondDelegation = 0;
            _cluster.pendingPondUndelegation = 0;
            _cluster.pendingMpondDelegation = 0;
            _cluster.pendingMpondUndelegation = 0;
            // update relayer stakes
            _relayer.pond += _relayer.pendingPondDelegation - _relayer.pendingPondUndelegation;
            _relayer.mpond += _relayer.pendingMpondDelegation - _relayer.pendingMpondUndelegation;
            _relayer.effectiveStake = _relayer.pond + _relayer.mpond * 10**6;
            _relayer.updatedEpoch = _currentEpoch;
            _relayer.pendingPondDelegation = 0;
            _relayer.pendingPondUndelegation = 0;
            _relayer.pendingMpondDelegation = 0;
            _relayer.pendingMpondUndelegation = 0;
        }
        return (_relayer, _cluster);
    }

    // TODO: Handle redelegation of stake. Stake contract should send out something when delegation of stake is done for
    // any address to ensure that it is updated for the corresponding relayer
}
