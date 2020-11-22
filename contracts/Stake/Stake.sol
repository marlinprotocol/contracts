pragma solidity >=0.4.21 <0.7.0;

// import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./ClusterRegistry.sol";


contract StakeManager {

    using SafeMath for uint256;

    struct Stash {
        address staker;
        address delegatedCluster;
        TokenType tokenType;
        uint256 amount;
        uint256 undelegatesAt;
    }
    // stashId to stash
    // stashId = keccak256(address, index)
    mapping(bytes32 => Stash) stashes;
    // address to stashIndex
    mapping(address => uint256) indices;

    enum TokenType {POND, MPOND}
    // TODO: Token addresses should be upgradable by governance ?
    mapping(uint256 => address) tokenAddresses;
    ClusterRegistry clusters;

    event StashCreated(address creator, bytes32 stashId, TokenType tokenType, uint256 amount);
    event StashDelegated(bytes32 stashId, address delegatedCluster);
    event StashUndelegated(bytes32 stashId, address undelegatedCluster, uint256 undelegatesAt);
    event StashWithdrawn(bytes32 stashId, TokenType tokenType, uint256 amount);

    constructor(address _MPONDAddress, address _PONDAddress, address _clusterManagerAddress) public {
        tokenAddresses[0] = _PONDAddress;
        tokenAddresses[1] = _MPONDAddress;
        clusters = ClusterRegistry(_clusterManagerAddress);
    }

    function createStashAndDelegate(TokenType _tokenType, uint256 _amount, address _delegatedCluster) public {
        bytes32 stashId = createStash(_tokenType, _amount);
        delegateStash(stashId, _delegatedCluster);
    }

    function createStash(TokenType _tokenType, uint256 _amount) public returns(bytes32) {
        require(_amount != 0, "StakeManager:createStash - Amount should be greater than 0 to create stash");
        uint stashIndex = indices[msg.sender];
        bytes32 stashId = keccak256(abi.encodePacked(msg.sender, stashIndex));
        stashes[stashId] = Stash(msg.sender, address(0), _tokenType, _amount, 0);
        indices[msg.sender] = stashIndex.add(1);
        lockTokens(_tokenType, _amount);
        emit StashCreated(msg.sender, stashId, _tokenType, _amount);
        return stashId;
    }

    function delegateStash(bytes32 _stashId, address _delegatedCluster) public {
        Stash memory stash = stashes[_stashId];
        require(
            stash.staker == msg.sender, 
            "StakeManager:delegateStash - Only staker can delegate stash to a cluster"
        );
        require(
            clusters.isClusterValid(_delegatedCluster), 
            "StakeManager:delegateStash - delegated cluster address is not valid"
        );
        require(
            stash.delegatedCluster == address(0),
            "StakeManager:delegateStash - stash already delegated to another cluster. Please undelegate from delegating."
        );
        require(
            stash.undelegatesAt <= block.number,
            "StakeManager:delegateStash - stash is not yet undelegated"
        );
        stashes[_stashId].delegatedCluster = _delegatedCluster;
        clusters.delegate(msg.sender, _delegatedCluster, stash.amount, stash.tokenType);
        emit StashDelegated(_stashId, _delegatedCluster);
    }

    function undelegateStash(bytes32 _stashId) public {
        Stash memory stash = stashes[_stashId];
        require(
            stash.staker == msg.sender, 
            "StakeManager:undelegateStash - Only staker can undelegate stash"
        );
        require(
            stash.delegatedCluster != address(0),
            "StakeManager:undelegateStash - stash is not delegated to any cluster"
        );
        require(
            stash.undelegatesAt <= block.number,
            "StakeManager:undelegateStash - stash is already waiting for undelegation"
        );
        uint256 waitTime = clusters.undelegationWaitTime();
        // TODO: probably don't need to use safemath add
        uint undelegationBlock = block.number.add(waitTime);
        stashes[_stashId].undelegatesAt = undelegationBlock;
        delete stashes[_stashId].delegatedCluster;
        clusters.undelegate(msg.sender, stash.delegatedCluster, stash.amount, stash.tokenType);
        emit StashUndelegated(_stashId, stash.delegatedCluster, undelegationBlock);
    }

    function withdrawStash(bytes32 _stashId) public {
        Stash memory stash = stashes[_stashId];
        require(
            stash.staker == msg.sender,
            "StakeManager:withdrawStash - Only staker can withdraw stash"
        );
        require(
            stash.delegatedCluster == address(0),
            "StakeManager:withdrawStash - Stash is delegated. Please undelegate before withdrawal"
        );
        require(
            stash.undelegatesAt <= block.number,
            "StakeManager:withdrawStash - stash is not yet undelegated"
        );
        delete stashes[_stashId];
        unlockTokens(stash.tokenType, stash.amount);
        emit StashWithdrawn(_stashId, stash.tokenType, stash.amount);
    }

    function lockTokens(TokenType _tokenType, uint256 _amount) internal {

    }

    function unlockTokens(TokenType _tokenType, uint256 _amount) internal {
        
    }
}
