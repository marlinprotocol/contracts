pragma solidity ^0.5.17;
interface IClusterRegistry {
    function locks(bytes32 _lockId) external returns(uint256, uint256);
    function lockWaitTime(bytes32 _selectorId) external returns(uint256);
    function updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) external;
    function register(bytes32 _networkId, uint256 _commission, address _rewardAddress, address _clientKey) external returns(bool);
    function updateCluster(uint256 _commission, bytes32 _networkId, address _rewardAddress, address _clientKey) external;
    function updateCommission(uint256 _commission) external;
    function switchNetwork(bytes32 _networkId) external;
    function updateRewardAddress(address _rewardAddress) external;
    function updateClientKey(address _clientKey) external;
    function unregister() external;
    function isClusterValid(address _cluster) external returns(bool);
    function getCommission(address _cluster) external returns(uint256);
    function getNetwork(address _cluster) external returns(bytes32);
    function getRewardAddress(address _cluster) external view returns(address);
    function getClientKey(address _cluster) external view returns(address);
    function getCluster(address _cluster) external;
}