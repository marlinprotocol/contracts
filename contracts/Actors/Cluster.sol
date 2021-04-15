// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Token/TokenLogic.sol";
import "./ClusterRegistry.sol";


interface ICluster {
    function isRelayer(address _receiver) external view returns (bool);

    function getTotalRelayers() external view returns (uint256);
}


contract Cluster is Initializable, ICluster {
    mapping(address => bool) relayers;
    uint256 totalRelayers;
    TokenLogic LINToken;
    ClusterRegistryOld clusterRegistry;

    function initialize(address _LINToken, address _clusterRegistry)
        public
        initializer
    {
        LINToken = TokenLogic(_LINToken);
        clusterRegistry = ClusterRegistryOld(_clusterRegistry);
    }

    function joinCluster() public {
        require(!relayers[msg.sender], "Cluster already exist");
        relayers[msg.sender] = true;
        totalRelayers++;
    }

    function exitCluster() public {
        require(relayers[msg.sender], "Cluster doesn't exist");
        relayers[msg.sender] = false;
        totalRelayers--;
    }

    function register(uint256 _amountToStake) public {
        require(
            LINToken.approve(address(clusterRegistry), _amountToStake),
            "Stake could not be allocated"
        );
        require(
            clusterRegistry.addCluster(_amountToStake),
            "couldn't register cluster with registry"
        );
    }

    function isRelayer(address _receiver) public view returns (bool) {
        return relayers[_receiver];
    }

    function getTotalRelayers() public view returns (uint256) {
        return totalRelayers;
    }
}
