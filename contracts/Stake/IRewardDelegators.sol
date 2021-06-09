pragma solidity ^0.5.17;

interface IRewardDelegators {
    // there's no undelegationWaitTime in rewardDelegators contract
    function undelegationWaitTime() external returns(uint256);
    function minMPONDStake() external returns(uint256);
    function MPONDTokenId() external returns(bytes32);
    function updateMPONDTokenId(bytes32 _updatedMPONDTokenId) external;
    function addRewardFactor(bytes32 _tokenId, uint256 _rewardFactor) external;
    function removeRewardFactor(bytes32 _tokenId) external;
    function updateRewardFactor(bytes32 _tokenId, uint256 _updatedRewardFactor) external;
    function _updateRewards(address _cluster) external;
    function delegate(
        address _delegator,
        address _cluster,
        bytes32[] calldata _tokens,
        uint256[] calldata _amounts
    ) external;
    function undelegate(
        address _delegator,
        address _cluster,
        bytes32[] calldata _tokens,
        uint256[] calldata _amounts
    ) external;
    function withdrawRewards(address _delegator, address _cluster) external returns(uint256);
    function isClusterActive(address _cluster) external returns(bool);
    function getClusterDelegation(address _cluster, bytes32 _tokenId) external view returns(uint256);
    function getDelegation(address _cluster, address _delegator, bytes32 _tokenId) external view returns(uint256);
    function updateUndelegationWaitTime(uint256 _undelegationWaitTime) external;
    function updateMinMPONDStake(uint256 _minMPONDStake) external;
    function updateStakeAddress(address _updatedStakeAddress) external;
    function updateClusterRewards(address _updatedClusterRewards) external;
    function updateClusterRegistry(address _updatedClusterRegistry) external;
    function updatePONDAddress(address _updatedPOND) external;
    function getFullTokenList() external view returns (bytes32[] memory);
    function getAccRewardPerShare(address _cluster, bytes32 _tokenId) external view returns(uint256);
}