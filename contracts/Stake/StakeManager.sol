pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./ClusterRegistry.sol";
import "../governance/MPondLogic.sol";


contract StakeManager is Initializable {

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
    mapping(bytes32 => Stash) public stashes;
    // address to stashIndex
    mapping(address => uint256) indices;

    enum TokenType {POND, MPOND}
    // TODO: Token addresses should be upgradable by governance ?
    mapping(uint256 => address) tokenAddresses;
    MPondLogic MPOND;
    ClusterRegistry public clusters;

    event StashCreated(address creator, bytes32 stashId, uint256 stashIndex, TokenType tokenType, uint256 amount);
    event StashDelegated(bytes32 stashId, address delegatedCluster);
    event StashUndelegated(bytes32 stashId, address undelegatedCluster, uint256 undelegatesAt);
    event StashWithdrawn(bytes32 stashId, TokenType tokenType, uint256 amount);
    event AddedToStash(address staker, address delegatedCluster, uint256 amount, TokenType tokenType);

    function initialize(
        address _MPONDAddress, 
        address _PONDAddress, 
        address _clusterRegistryAddress,
        uint256 _undelegationWaitTime, 
        address _oracleOwner, 
        address _clusterRegistryAdmin,
        uint256 _rewardPerEpoch, 
        uint256 _minMPONDStake,
        uint256 _payoutDenomination,
        uint256 _PondRewardFactor,
        uint256 _MPondRewardFactor)
        initializer
        public 
    {
        tokenAddresses[0] = _PONDAddress;
        tokenAddresses[1] = _MPONDAddress;
        MPOND = MPondLogic(_MPONDAddress);
        clusters = ClusterRegistry(_clusterRegistryAddress);
        // clusters = new ClusterRegistry(
        //     _undelegationWaitTime, 
        //     address(this), 
        //     _oracleOwner, 
        //     _clusterRegistryAdmin,
        //     _minMPONDStake, 
        //     _rewardPerEpoch, 
        //     _MPONDAddress,
        //     _payoutDenomination,
        //     _PondRewardFactor,
        //     _MPondRewardFactor
        // );
    }

    function createStashAndDelegate(TokenType _tokenType, uint256 _amount, address _delegatedCluster) public {
        bytes32 stashId = createStash(_tokenType, _amount);
        delegateStash(stashId, _delegatedCluster);
    }

    function createStash(TokenType _tokenType, uint256 _amount) public returns(bytes32) {
        require(_amount != 0, "StakeManager:createStash - Amount should be greater than 0 to create stash");
        require(
            _tokenType == TokenType.POND || _tokenType == TokenType.MPOND, 
            "StakeManager:createStash - Token type not valid"
        );
        uint stashIndex = indices[msg.sender];
        bytes32 stashId = keccak256(abi.encodePacked(msg.sender, stashIndex));
        stashes[stashId] = Stash(msg.sender, address(0), _tokenType, _amount, 0);
        // This can never overflow, so change to + for gas savings
        indices[msg.sender] = stashIndex.add(1);
        _lockTokens(_tokenType, _amount, msg.sender);
        emit StashCreated(msg.sender, stashId, stashIndex, _tokenType, _amount);
        return stashId;
    }

    function addToStash(bytes32 _stashId, TokenType _tokenType, uint256 _amount) public {
        Stash memory stash = stashes[_stashId];
        require(
            _tokenType == stash.tokenType, 
            "StakeManager:createStash - Stash token type different from added tokens"
        );
        require(
            stash.staker == msg.sender, 
            "StakeManager:delegateStash - Only staker can delegate stash to a cluster"
        );
        require(
            stash.undelegatesAt <= block.number,
            "StakeManager:delegateStash - Can't add to stash during undelegation"
        );
        stashes[_stashId].amount = stash.amount.add(_amount);
        if(stash.delegatedCluster != address(0)) {
            clusters.delegate(msg.sender, stash.delegatedCluster, _amount, uint256(_tokenType));
        }
        _lockTokens(_tokenType, _amount, msg.sender);
        emit AddedToStash(msg.sender, stash.delegatedCluster, _amount, _tokenType);
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
        clusters.delegate(msg.sender, _delegatedCluster, stash.amount, uint256(stash.tokenType));
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
        // use + for gas savings as overflow can't happen
        uint undelegationBlock = block.number.add(waitTime);
        stashes[_stashId].undelegatesAt = undelegationBlock;
        delete stashes[_stashId].delegatedCluster;
        clusters.undelegate(msg.sender, stash.delegatedCluster, stash.amount, uint256(stash.tokenType));
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
        _unlockTokens(stash.tokenType, stash.amount, stash.staker);
        emit StashWithdrawn(_stashId, stash.tokenType, stash.amount);
    }

    function _lockTokens(TokenType _tokenType, uint256 _amount, address _delegator) internal {
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
