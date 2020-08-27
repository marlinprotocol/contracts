// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract Pot is Initializable{
    using SafeMath for uint256;

    uint MAX_INT;

    //TODO: Contract which contains all global variables like proxies
    address GovernanceEnforcerProxy;

    struct EpochPot {
        mapping(bytes32 => uint) value;
        mapping(bytes32 => mapping(bytes32 => uint)) allocation;
        mapping(bytes32 => mapping(address => uint)) claims;
        mapping(bytes32 => uint) claimsRemaining;
        mapping(bytes32 => uint) maxClaims;
        bool isClaimsStarted;
    }

    struct ClaimWait {
        uint epochsToWaitForClaims;
        uint nextEpochsToWaitForClaims;
        uint epochOfepochsToWaitForClaimsUpdate;
    }

    mapping(bytes32 => uint) public potAllocation;
    bytes32[] public ids;
    mapping(bytes32 => address) public tokens;
    bytes32[] tokenList;
    uint public firstEpochStartBlock;
    uint public blocksPerEpoch;
    mapping(bytes32 => ClaimWait) public claimWait;

    mapping(uint => EpochPot) potByEpoch;
    mapping(address => bool) public verifiers;

    event PotAllocated(bytes32[] ids, uint[] fractionPerCent);
    event PotFunded(address invoker, uint epoch, bytes32 token, address funder, uint value, uint updatedPotValue);
    event TicketClaimed(bytes32 role, address claimer, uint epoch);
    event FeeClaimed(bytes32 role, 
        address claimer, 
        uint value, 
        uint epoch, 
        uint noOfClaims, 
        bytes32 token, 
        uint updatedRolePot);

    modifier onlyGovernanceEnforcer() {
        require(msg.sender == address(GovernanceEnforcerProxy), 
                "Pot: Function can only be invoked by Governance Enforcer");
        _;
    }

    modifier onlyValidVerifier() {
        require(verifiers[msg.sender], "Pot: Invalid verifier contract trying to add claim");
        _;
    }

    function initialize(address _governanceEnforcerProxy, 
                uint _firstEpochStartBlock, 
                uint _EthBlocksPerEpoch,
                bytes32[] memory _ids,
                uint[] memory _fractionPerCent,
                bytes32[] memory _tokens,
                address[] memory _tokenContracts,
                uint[] memory _epochsToWaitForClaims) 
                public
                initializer {
        MAX_INT = 2**255-1;
        GovernanceEnforcerProxy = _governanceEnforcerProxy;
        firstEpochStartBlock = _firstEpochStartBlock;
        blocksPerEpoch = _EthBlocksPerEpoch;
        _allocatePot(_ids, _fractionPerCent);
        for(uint i=0; i < _ids.length; i++) {
            claimWait[_ids[i]] = ClaimWait(_epochsToWaitForClaims[i], 0, MAX_INT);
        }
        for(uint i=0; i < _tokens.length; i++) {
            tokens[_tokens[i]] = _tokenContracts[i];
        }
        tokenList = _tokens;
    }

    function addVerifier(address _verifier) 
                        onlyGovernanceEnforcer 
                        public 
                        returns(bool) {
        verifiers[_verifier] = true;
        return true;
    }

    function removeVerifier(address _verifier) 
                            onlyGovernanceEnforcer 
                            public 
                            returns(bool) {
        verifiers[_verifier] = false;
        return true;
    }

    function updateSupportedTokenList(bytes32[] memory _tokens, address[] memory _tokenContracts) 
                        onlyGovernanceEnforcer 
                        public 
                        returns(bool) {
        for(uint i=0; i < _tokens.length; i++) {
            tokens[_tokens[i]] = _tokenContracts[i];
        }
        tokenList = _tokens;
        return true;
    }

    function changeEpochsToWaitForClaims(uint _updatedWaitEpochs, 
                                        uint _epochToUpdate, 
                                        bytes32 _role) 
                                        onlyGovernanceEnforcer 
                                        public 
                                        returns(bool) {
        claimWait[_role].nextEpochsToWaitForClaims = _updatedWaitEpochs;
        claimWait[_role].epochOfepochsToWaitForClaimsUpdate = _epochToUpdate;
        return true;
    }

    // Note: Updating blocksperepoch will lead to too many complications
    // function changeEthBlocksPerEpoch(uint _updatedBlockPerEpoch, 
    //                                 uint _epochToUpdate) 
    //                                 onlyGovernanceEnforcer 
    //                                 public 
    //                                 returns(bool) {
    //     blocksPerEpoch.nextEthBlockPerEpoch = _updatedBlockPerEpoch;
    //     blocksPerEpoch.epochOfEthBlocksPerEpochUpdate = _epochToUpdate;
    //     return true;
    // }

    function allocatePot(bytes32[] memory _ids, 
                        uint[] memory _fractionPerCent) 
                        public 
                        onlyGovernanceEnforcer {
        _allocatePot(_ids, _fractionPerCent);
    }

    function _allocatePot(bytes32[] memory _ids, 
                        uint[] memory _fractionPerCent) 
                        internal {
        require(_ids.length == _fractionPerCent.length);
        uint totalFraction;
        // clean the previous allocations
        bytes32[] memory localIds = ids;
        for(uint i=0; i < localIds.length; i++) {
            delete potAllocation[localIds[i]];
        }
        delete ids;
        // set the new allocations
        for(uint i=0; i < _ids.length; i++) {
            totalFraction = totalFraction.add(_fractionPerCent[i]);
            potAllocation[_ids[i]] = _fractionPerCent[i];
        }
        require(totalFraction == 100, "Pot: Total is not 100%");
        ids = _ids;
        emit PotAllocated(_ids, _fractionPerCent);
    }

    function getEpoch(uint _blockNumber) public view returns(uint) {
        return _blockNumber.sub(firstEpochStartBlock).div(blocksPerEpoch);
    }

    // todo: Is pot exclusively LIN pot and doesn't contain any other tokens
    // Note: These tokens should be approved by governance else can be attacked
    function addToPot(uint[] memory _epochs, 
                        address _source, 
                        bytes32 _token,
                        uint[] memory _values) 
                        public 
                        returns(bool) {
        require(_epochs.length == _values.length, "Pot: Invalid inputs");
        uint totalValue;
        for(uint i=0; i < _epochs.length; i++) {
            uint updatedPotPerEpoch = potByEpoch[_epochs[i]].value[_token].add(_values[i]);
            potByEpoch[_epochs[i]].value[_token] = updatedPotPerEpoch;
            emit PotFunded(msg.sender, _epochs[i], _token, _source, _values[i], updatedPotPerEpoch);
            totalValue = totalValue.add(_values[i]);
        }
        require(IERC20(tokens[_token]).transferFrom(_source, address(this), totalValue), "Pot: Couldn't add to pot");
        return true;
    }

    function claimTicket(bytes32[] memory _roles, 
                        address[] memory _claimers, 
                        uint[] memory _epochs) 
                        public 
                        onlyValidVerifier 
                        returns(bool) {
        require(_roles.length == _claimers.length && _claimers.length == _epochs.length, 
                    "Pot: Invalid inputs to claim ticket");
        for(uint i=0; i < _roles.length; i++) {
            potByEpoch[_epochs[i]].claims[_roles[i]][_claimers[i]] = 
                potByEpoch[_epochs[i]].claims[_roles[i]][_claimers[i]].add(1);
            potByEpoch[_epochs[i]].claimsRemaining[_roles[i]] =  
                potByEpoch[_epochs[i]].claimsRemaining[_roles[i]].add(1);
            potByEpoch[_epochs[i]].maxClaims[_roles[i]] = potByEpoch[_epochs[i]].maxClaims[_roles[i]].add(1);
            emit TicketClaimed(_roles[i], _claimers[i], _epochs[i]);
        }
        return true;
    }

    function claimFeeReward(bytes32 _role, 
                            uint[] memory _epochsToClaim) 
                            public {
        uint[] memory claimedAmount;
        uint currentEpoch = getEpoch(block.number);
        ClaimWait memory claimWaitForRole = claimWait[_role];
        if(claimWaitForRole.epochOfepochsToWaitForClaimsUpdate <= currentEpoch) {
            claimWaitForRole.epochsToWaitForClaims = claimWaitForRole.nextEpochsToWaitForClaims;
            claimWaitForRole.epochOfepochsToWaitForClaimsUpdate = MAX_INT;
            claimWait[_role] = claimWaitForRole;
        }
        for(uint i=0; i < _epochsToClaim.length; i++) {
            EpochPot memory currentPot = potByEpoch[_epochsToClaim[i]];
            if(!currentPot.isClaimsStarted) {
                if(currentEpoch.sub(_epochsToClaim[i]) > claimWaitForRole.epochsToWaitForClaims) {
                    for(uint j=0; j < ids.length; j++) {
                        for(uint k=0; k < tokenList.length; k++) {
                            potByEpoch[_epochsToClaim[i]].allocation[ids[j]][tokenList[k]] = 
                                potAllocation[ids[j]].mul(
                                    potByEpoch[_epochsToClaim[i]].value[tokenList[k]]
                                ).div(100);
                        }
                    }
                    potByEpoch[_epochsToClaim[i]].isClaimsStarted = true;
                } else {
                    //todo: Should we throw error here or continue
                    continue;
                }
            }
            uint noOfClaims = potByEpoch[_epochsToClaim[i]].claims[_role][msg.sender];
            for(uint j=0; j < tokenList.length; j++) {
                uint claimAmount = potByEpoch[_epochsToClaim[i]].allocation[_role][tokenList[j]].mul(noOfClaims).div(
                                    potByEpoch[_epochsToClaim[i]].claimsRemaining[_role]
                                );
                potByEpoch[_epochsToClaim[i]].allocation[_role][tokenList[j]] = 
                    potByEpoch[_epochsToClaim[i]].allocation[_role][tokenList[j]].sub(claimAmount);
                
                claimedAmount[j] = claimedAmount[j].add(claimAmount);
                emit FeeClaimed(_role, msg.sender, claimAmount, _epochsToClaim[i], 
                            noOfClaims, tokenList[j], potByEpoch[_epochsToClaim[i]].allocation[_role][tokenList[j]]);
            }
            potByEpoch[_epochsToClaim[i]].claimsRemaining[_role] = 
                potByEpoch[_epochsToClaim[i]].claimsRemaining[_role].sub(noOfClaims);
            potByEpoch[_epochsToClaim[i]].claims[_role][msg.sender] = 0;
        }
        for(uint i=0; i < tokenList.length; i++) {
            IERC20(tokens[tokenList[i]]).transfer(msg.sender, claimedAmount[i]);
        }
    }

    function getMaxClaims(uint _epoch, 
                        bytes32 _role) 
                        public 
                        view 
                        returns(uint) {
        return potByEpoch[_epoch].maxClaims[_role];
    }

    function getPotValue(uint _epoch, bytes32 _tokenId) public view returns(uint) {
        return potByEpoch[_epoch].value[_tokenId];
    }
}