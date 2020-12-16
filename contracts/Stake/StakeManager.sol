pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./RewardDelegators.sol";
import "../governance/MPondLogic.sol";
import "./ClusterRegistry.sol";


contract StakeManager is Initializable, Ownable {

    using SafeMath for uint256;

    struct TokenData {
        uint256 amount;
        uint256 index; // index in tokensDelegated array
    }

    struct Stash {
        address staker;
        address delegatedCluster;
        mapping(bytes32 => TokenData) amount;
        uint256 undelegatesAt;
        bytes32[] tokensDelegated;
    }
    // stashId to stash
    // stashId = keccak256(address, index)
    mapping(bytes32 => Stash) public stashes;
    // address to stashIndex
    mapping(address => uint256) indices;
    // tokenId to token address - tokenId = keccak256(tokenTicker)
    mapping(bytes32 => address) tokenAddresses;
    MPondLogic MPOND;
    ClusterRegistry clusterRegistry;
    RewardDelegators public rewardDelegators;

    event StashCreated(
        address indexed creator, 
        bytes32 stashId, 
        uint256 stashIndex, 
        bytes32[] tokens, 
        uint256[] amounts
    );
    event StashDelegated(bytes32 stashId, address delegatedCluster);
    event StashUndelegated(bytes32 stashId, address undelegatedCluster, uint256 undelegatesAt);
    event StashWithdrawn(bytes32 stashId, bytes32[] tokens, uint256[] amounts);
    event StashClosed(bytes32 stashId, address indexed staker);
    event AddedToStash(bytes32 stashId, address delegatedCluster, bytes32[] tokens, uint256[] amounts);
    event TokenAdded(bytes32 tokenId, address tokenAddress);
    event TokenRemoved(bytes32 tokenId);
    event TokenUpdated(bytes32 tokenId, address tokenAddress);

    function initialize(
        bytes32[] memory _tokenIds, 
        address[] memory _tokenAddresses,
        address _MPONDTokenAddress,
        address _clusterRegistryAddress,
        address _rewardDelegatorsAddress,
        address _owner)
        initializer
        public 
    {
        require(
            _tokenIds.length == _tokenAddresses.length, 
            "StakeManager:initialize - each tokenId should have a corresponding tokenAddress and vice versa"
        );
        for(uint256 i=0; i < _tokenIds.length; i++) {
            tokenAddresses[_tokenIds[i]] = _tokenAddresses[i];
            emit TokenAdded(_tokenIds[i], _tokenAddresses[i]);
        }
        MPOND = MPondLogic(_MPONDTokenAddress);
        clusterRegistry = ClusterRegistry(_clusterRegistryAddress);
        rewardDelegators = RewardDelegators(_rewardDelegatorsAddress);
        super.initialize(_owner);
    }

    function changeMPONDTokenAddress(
        address _MPONDTokenAddress
    ) public onlyOwner {
        MPOND = MPondLogic(_MPONDTokenAddress);
        emit TokenUpdated(keccak256("MPOND"), _MPONDTokenAddress);
    }

    function enableToken(
        bytes32 _tokenId, 
        address _address
    ) public onlyOwner {
        require(
            tokenAddresses[_tokenId] == address(0), 
            "StakeManager:enableToken - Token already enabled"
        );
        require(_address != address(0), "StakeManager:enableToken - Zero address not allowed");
        tokenAddresses[_tokenId] = _address;
        emit TokenAdded(_tokenId, _address);
    }

    function disableToken(
        bytes32 _tokenId
    ) public onlyOwner {
        require(
            tokenAddresses[_tokenId] != address(0), 
            "StakeManager:enableToken - Token already enabled"
        );
        delete tokenAddresses[_tokenId];
        emit TokenRemoved(_tokenId);
    }

    function createStashAndDelegate(
        bytes32[] memory _tokens, 
        uint256[] memory _amounts, 
        address _delegatedCluster
    ) public {
        bytes32 stashId = createStash(_tokens, _amounts);
        delegateStash(stashId, _delegatedCluster);
    }

    function createStash(
        bytes32[] memory _tokens, 
        uint256[] memory _amounts
    ) public returns(bytes32) {
        require(
            _tokens.length == _amounts.length, 
            "StakeManager:createStash - each tokenId should have a corresponding amount and vice versa"
        );
        uint stashIndex = indices[msg.sender];
        bytes32 stashId = keccak256(abi.encodePacked(msg.sender, stashIndex));
        // TODO: This can never overflow, so change to + for gas savings
        indices[msg.sender] = stashIndex.add(1);
        uint256 index = 0;
        bytes32[] memory uniqueTokens = new bytes32[](_tokens.length);
        for(uint256 i=0; i < _tokens.length; i++) {
            require(
                tokenAddresses[_tokens[i]] != address(0), 
                "StakeManager:createStash - Invalid tokenId"
            );
            if(_amounts[i] != 0) {
                TokenData memory tokenData = stashes[stashId].amount[_tokens[i]];
                // if someone sends same token 2 times while creating stash
                if(tokenData.amount == 0) {
                    uniqueTokens[index] = _tokens[i];
                    stashes[stashId].amount[_tokens[i]] = TokenData(_amounts[i], index);
                    index++;
                } else {
                    stashes[stashId].amount[_tokens[i]].amount = tokenData.amount.add(_amounts[i]);
                }
                _lockTokens(_tokens[i], _amounts[i], msg.sender);
            }
        }
        stashes[stashId] = Stash(msg.sender, address(0), 0, uniqueTokens);
        emit StashCreated(msg.sender, stashId, stashIndex, _tokens, _amounts);
        return stashId;
    }

    function addToStash(
        bytes32 _stashId, 
        bytes32[] memory _tokens, 
        uint256[] memory _amounts
    ) public {
        Stash memory stash = stashes[_stashId];
        require(
            stash.staker == msg.sender, 
            "StakeManager:addToStash - Only staker can delegate stash to a cluster"
        );
        require(
            stash.undelegatesAt <= block.number,
            "StakeManager:addToStash - Can't add to stash during undelegation"
        );
        require(
            _tokens.length == _amounts.length, 
            "StakeManager:addToStash - Each tokenId should have a corresponding amount and vice versa"
        );
        if(stash.delegatedCluster != address(0)) {
            rewardDelegators.delegate(msg.sender, stash.delegatedCluster, _tokens, _amounts);
        }
        uint256 index = stashes[_stashId].tokensDelegated.length;
        for(uint256 i=0; i < _tokens.length; i++) {
            require(
                tokenAddresses[_tokens[i]] != address(0), 
                "StakeManager:addToStash - Invalid tokenId"
            );
            if(_amounts[i] != 0) {
                TokenData memory tokenData = stashes[_stashId].amount[_tokens[i]];
                if(tokenData.amount == 0) {
                    stashes[_stashId].tokensDelegated.push(_tokens[i]);
                    stashes[_stashId].amount[_tokens[i]] = TokenData(_amounts[i], index);
                    index++;
                } else {
                    stashes[_stashId].amount[_tokens[i]].amount = tokenData.amount.add(_amounts[i]);
                }
                _lockTokens(_tokens[i], _amounts[i], msg.sender);
            }
        }
        // TODO: If gas usage for emitting tokens and amount is high, then query using txHash and remove them from event
        emit AddedToStash(_stashId, stash.delegatedCluster, _tokens, _amounts);
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
        bytes32[] memory tokens = stashes[_stashId].tokensDelegated;
        uint256[] memory amounts = new uint256[](tokens.length);
        for(uint256 i=0; i < tokens.length; i++) {
            amounts[i] = stashes[_stashId].amount[tokens[i]].amount;
        }
        rewardDelegators.delegate(msg.sender, _delegatedCluster, tokens, amounts);
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
        bytes32[] memory tokens = stashes[_stashId].tokensDelegated;
        uint256[] memory amounts = new uint256[](tokens.length);
        for(uint256 i=0; i < tokens.length; i++) {
            amounts[i] = stashes[_stashId].amount[tokens[i]].amount;
        }
        rewardDelegators.undelegate(msg.sender, stash.delegatedCluster, tokens, amounts);
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
        bytes32[] memory tokens = stashes[_stashId].tokensDelegated;
        uint256[] memory amounts = new uint256[](tokens.length);
        for(uint256 i=0; i < tokens.length; i++) {
            amounts[i] = stashes[_stashId].amount[tokens[i]].amount;
            delete stashes[_stashId].amount[tokens[i]];
            _unlockTokens(tokens[i], amounts[i], stash.staker);
        }
        // TODO-deleting the tokens array might be costly, so optimize
        delete stashes[_stashId];
        emit StashWithdrawn(_stashId, tokens, amounts);
        emit StashClosed(_stashId, stash.staker);
    }

    function withdrawStash(
        bytes32 _stashId, 
        bytes32[] memory _tokens, 
        uint256[] memory _amounts
    ) public {
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
        require(
            _tokens.length == _amounts.length,
            "StakeManager:withdrawStash - Each tokenId should have a corresponding amount and vice versa"
        );
        for(uint256 i=0; i < _tokens.length; i++) {
            uint256 balance = stashes[_stashId].amount[_tokens[i]].amount;
            require(
                balance >= _amounts[i],
                "StakeManager:withdrawStash - balance not sufficient"
            );
            if(balance == _amounts[i]) {
                // delete element from array
                uint256 tokenIndex = stashes[_stashId].amount[_tokens[i]].index;
                bytes32 tokenToReplace = stashes[_stashId].tokensDelegated[stashes[_stashId].tokensDelegated.length-1];
                stashes[_stashId].tokensDelegated[tokenIndex] = tokenToReplace;
                stashes[_stashId].tokensDelegated.pop();
                stashes[_stashId].amount[tokenToReplace].index = tokenIndex;
                delete stashes[_stashId].amount[_tokens[i]];
            } else {
                stashes[_stashId].amount[_tokens[i]].amount = balance.sub(_amounts[i]);
            }
            _unlockTokens(_tokens[i], _amounts[i], stash.staker);
        }
        if(stashes[_stashId].tokensDelegated.length == 0) {
            // TODO-deleting the tokens array might be costly, so optimize
            delete stashes[_stashId];
        }
        emit StashWithdrawn(_stashId, _tokens, _amounts);
    }

    function _lockTokens(bytes32 _tokenId, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        address tokenAddress = tokenAddresses[_tokenId];
        // pull tokens from mpond/pond contract
        // if mpond transfer the governance rights back
        require(
            ERC20(tokenAddress).transferFrom(
                _delegator,
                address(this),
                _amount
            )
        );
        if (tokenAddress == address(MPOND)) {
            // send a request to delegate governance rights for the amount to delegator
            MPOND.delegate(
                _delegator,
                uint96(_amount)
            );
        }
    }

    function _unlockTokens(bytes32 _tokenId, uint256 _amount, address _delegator) internal {
        if(_amount == 0) {
            return;
        }
        address tokenAddress = tokenAddresses[_tokenId];
        if(tokenAddress == address(MPOND)) {
            // send a request to undelegate governacne rights for the amount to previous delegator
            MPOND.undelegate(
                _delegator,
                uint96(_amount)
            );
        }
        require(
            ERC20(tokenAddress).transfer(
                _delegator,
                _amount
            )
        );
    }
}
