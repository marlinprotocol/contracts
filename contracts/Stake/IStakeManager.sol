pragma solidity ^0.5.17;

interface IStakeManager {
    function stashes(bytes32 _stashId) external returns(address, address, uint256);
    function stashIndex() external returns(uint256);
    function rewardDelegators() external returns(address);
    function locks(bytes32 _lockId) external returns(address, bool);
    function lockWaitTime(bytes32 _selectorId) external returns(uint256);
    function updateLockWaitTime(bytes32 _selector, uint256 _updatedWaitTime) external;
    function changeMPONDTokenAddress(address _MPONDTokenAddress) external;
    function updateRewardDelegators(address _updatedRewardDelegator) external;
    function updateClusterRegistry(address _updatedClusterRegistry) external;
    function enableToken(bytes32 _tokenId,address _address) external;
    function disableToken(bytes32 _tokenId) external;
    function createStashAndDelegate(
        bytes32[] calldata _tokens,
        uint256[] calldata _amounts,
        address _delegatedCluster
    ) external;
    function createStash(bytes32[] calldata _tokens, uint256[] calldata _amounts) external returns(bytes32);
    function delegateStash(bytes32 _stashId, address _delegatedCluster) external;
    function requestStashRedelegation(bytes32 _stashId, address _newCluster) external;
    function redelegateStash(bytes32 _stashId) external;
    function undelegateStash(bytes32 _stashId) external;
    function withdrawStash(bytes32 _stashId) external;
    function withdrawStash(bytes32 _stashId, bytes32[] calldata _tokens, uint256[] calldata _amounts) external;
    function getTokenAmountInStash(bytes32 _stashId, bytes32 _tokenId) external view returns(uint256);
}