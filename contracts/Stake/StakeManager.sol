pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./RewardDelegators.sol";
import "../governance/MPondLogic.sol";


contract StakeManager is Initializable {

    using SafeMath for uint256;

    struct Stash {
        address staker;
        address delegatedCluster;
        uint256 MPONDAmount;
        uint256 PONDAmount;
        uint256 undelegatesAt;
    }
    // stashId to stash
    // stashId = keccak256(address, index)
    mapping(bytes32 => Stash) public stashes;
    // address to stashIndex
    mapping(address => uint256) indices;

    enum TokenType {POND, MPOND}
    // TODO: Token addresses should be upgradable by governance ?
    mapping(uint256 => address) tokenAddresses;
    MPondLogic MPOND;
    ClusterRegistry clusterRegistry;
    RewardDelegators public rewardDelegators;

    event StashCreated(address indexed creator, bytes32 stashId, uint256 stashIndex, uint256 MPONDAmount, uint256 PONDAmount);
    event StashDelegated(bytes32 stashId, address delegatedCluster);
    event StashUndelegated(bytes32 stashId, address undelegatedCluster, uint256 undelegatesAt);
    event StashWithdrawn(bytes32 stashId, uint256 MPONDAmount, uint256 PONDAmount);
    event StashClosed(bytes32 stashId);
    event AddedToStash(bytes32 stashId, address delegatedCluster, uint256 MPONDAmount, uint256 PONDAmount);

    function initialize(
        address _MPONDAddress, 
        address _PONDAddress, 
        address _clusterRegistryAddress,
        address _rewardDelegatorsAddress)
        initializer
        public 
    {
        tokenAddresses[0] = _PONDAddress;
        tokenAddresses[1] = _MPONDAddress;
        MPOND = MPondLogic(_MPONDAddress);
        clusterRegistry = ClusterRegistry(_clusterRegistryAddress);
        rewardDelegators = RewardDelegators(_rewardDelegatorsAddress);

    }

    function createStashAndDelegate(uint256 _MPONDAmount, uint256 _PONDAmount, address _delegatedCluster) public {
        bytes32 stashId = createStash(_MPONDAmount, _PONDAmount);
        delegateStash(stashId, _delegatedCluster);
    }

    function createStash(uint256 _MPONDAmount, uint256 _PONDAmount) public returns(bytes32) {
        require(
            _PONDAmount != 0 || _MPONDAmount != 0, 
            "StakeManager:createStash - Amount should be greater than 0 to create stash"
        );
        uint stashIndex = indices[msg.sender];
        bytes32 stashId = keccak256(abi.encodePacked(msg.sender, stashIndex));
        stashes[stashId] = Stash(msg.sender, address(0), _MPONDAmount, _PONDAmount, 0);
        // This can never overflow, so change to + for gas savings
        indices[msg.sender] = stashIndex.add(1);
        _lockTokens(TokenType.MPOND, _MPONDAmount, msg.sender);
        _lockTokens(TokenType.POND, _PONDAmount, msg.sender);
        emit StashCreated(msg.sender, stashId, stashIndex, _MPONDAmount, _PONDAmount);
        return stashId;
    }

    function addToStash(bytes32 _stashId, uint256 _MPONDAmount, uint256 _PONDAmount) public {
        Stash memory stash = stashes[_stashId];
        require(
            stash.staker == msg.sender, 
            "StakeManager:delegateStash - Only staker can delegate stash to a cluster"
        );
        require(
            stash.undelegatesAt <= block.number,
            "StakeManager:delegateStash - Can't add to stash during undelegation"
        );
        stashes[_stashId].MPONDAmount = stash.MPONDAmount.add(_MPONDAmount);
        stashes[_stashId].PONDAmount = stash.PONDAmount.add(_PONDAmount);
        if(stash.delegatedCluster != address(0)) {
            rewardDelegators.delegate(msg.sender, stash.delegatedCluster, _MPONDAmount, _PONDAmount);
        }
        _lockTokens(TokenType.MPOND, _MPONDAmount, msg.sender);
        _lockTokens(TokenType.POND, _PONDAmount, msg.sender);
        emit AddedToStash(_stashId, stash.delegatedCluster, _MPONDAmount, _PONDAmount);
    }

    function delegateStash(bytes32 _stashId, address _delegatedCluster) public {
        Stash memory stash = stashes[_stashId];
        require(
            stash.staker == msg.sender, 
            "StakeManager:delegateStash - Only staker can delegate stash to a cluster"
        );
        require(
            clusterRegistry.isClusterValid(_delegatedCluster), 
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
        rewardDelegators.delegate(msg.sender, _delegatedCluster, stash.MPONDAmount, stash.PONDAmount);
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
        uint256 waitTime = rewardDelegators.undelegationWaitTime();
        // use + for gas savings as overflow can't happen
        uint undelegationBlock = block.number.add(waitTime);
        stashes[_stashId].undelegatesAt = undelegationBlock;
        delete stashes[_stashId].delegatedCluster;
        rewardDelegators.undelegate(msg.sender, stash.delegatedCluster, stash.MPONDAmount, stash.PONDAmount);
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
        _unlockTokens(TokenType.MPOND, stash.MPONDAmount, stash.staker);
        _unlockTokens(TokenType.POND, stash.PONDAmount, stash.staker);
        emit StashWithdrawn(_stashId, stash.MPONDAmount, stash.PONDAmount);
        emit StashClosed(_stashId);
    }

    function withdrawStash(bytes32 _stashId, uint256 _MPONDAmount, uint256 _PONDAmount) public {
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
        if(stash.PONDAmount == _PONDAmount && stash.MPONDAmount == _MPONDAmount) {
            delete stashes[_stashId];
            emit StashClosed(_stashId);
        } else {
            require(
                stash.MPONDAmount >= _MPONDAmount && stash.PONDAmount >= _PONDAmount,
                "StakeManager:withdrawStash - balance not sufficient"
            );
            stashes[_stashId].PONDAmount = stash.PONDAmount.sub(_PONDAmount);
            stashes[_stashId].MPONDAmount = stash.MPONDAmount.sub(_MPONDAmount);
        }
        _unlockTokens(TokenType.MPOND, _MPONDAmount, stash.staker);
        _unlockTokens(TokenType.POND, _PONDAmount, stash.staker);
        emit StashWithdrawn(_stashId, _MPONDAmount, _PONDAmount);
    }

    function _lockTokens(TokenType _tokenType, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        // pull tokens from mpond/pond contract
        // if mpond transfer the governance rights back
        require(
            ERC20(tokenAddresses[uint256(_tokenType)]).transferFrom(
                _delegator,
                address(this),
                _amount
            )
        );
        if (_tokenType == TokenType.MPOND) {
            // send a request to delegate governance rights for the amount to delegator
            MPOND.delegate(
                _delegator,
                uint96(_amount)
            );
        }
    }

    function _unlockTokens(TokenType _tokenType, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        if(_tokenType == TokenType.MPOND) {
            // send a request to undelegate governacne rights for the amount to previous delegator
            MPOND.undelegate(
                _delegator,
                uint96(_amount)
            );
        }
        require(
            ERC20(tokenAddresses[uint256(_tokenType)]).transfer(
                _delegator,
                _amount
            )
        );
    }
}
