// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "../Token/TokenLogic.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract Pot is Initializable{
    using SafeMath for uint256;

    //TODO: Contract which contains all global variables like proxies
    TokenLogic LINProxy;
    address GovernanceEnforcerProxy;

    struct EpochPot {
        uint value;
        mapping(bytes32 => uint) allocation;
        mapping(bytes32 => mapping(address => uint)) claims;
        mapping(bytes32 => uint) claimsRemaining;
        mapping(bytes32 => uint) maxClaims;
        bool isClaimsStarted;
    }

    mapping(bytes32 => uint) potAllocation;
    bytes32[] ids;
    mapping(uint => EpochPot) potByEpoch;

    uint firstEpochStartBlock;
    uint EthBlocksPerEpoch;
    mapping(bytes32 => uint) epochsToWaitForClaims;

    mapping(address => bool) verifiers;

    event PotAllocated(bytes32[] ids, uint[] fractionPerCent);
    event PotFunded(address invoker, uint epoch, address funder, uint value, uint updatedPotValue);
    event TicketClaimed(bytes32 role, address claimer, uint epoch);
    event FeeClaimed(bytes32 role, address claimer, uint value, uint epoch, uint noOfClaims, uint updatedRolePot);

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
                address _LINToken,
                uint _firstEpochStartBlock, 
                uint _EthBlocksPerEpoch,
                bytes32[] memory _ids,
                uint[] memory _fractionPerCent) 
                public
                initializer {
        GovernanceEnforcerProxy = _governanceEnforcerProxy;
        LINProxy = TokenLogic(_LINToken);
        firstEpochStartBlock = _firstEpochStartBlock;
        EthBlocksPerEpoch = _EthBlocksPerEpoch;
        _allocatePot(_ids, _fractionPerCent);
    }

    function addVerifier(address _verifier) 
                        onlyGovernanceEnforcer 
                        public {
        verifiers[_verifier] = true;
    }

    function removeVerifier(address _verifier) 
                            onlyGovernanceEnforcer 
                            public {
        verifiers[_verifier] = false;
    }

    //todo: Enforce from next epoch boundary
    function changeEpochsToWaitForClaims(uint _updatedWaitEpochs, bytes32 _role) onlyGovernanceEnforcer public {
        epochsToWaitForClaims[_role] = _updatedWaitEpochs;
    }

    // todo: Enforce from next epoch boundary
    function changeEthBlocksPerEpoch(uint _updatedBlockPerEpoch) onlyGovernanceEnforcer public {
        EthBlocksPerEpoch = _updatedBlockPerEpoch;
    }

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

    // TODO: Seperate this into a different contract
    function getEpoch(uint _blockNumber) public view returns(uint) {
        return _blockNumber.sub(firstEpochStartBlock).div(EthBlocksPerEpoch);
    }

    // todo: Is pot exclusively LIN pot and doesn't contain any other tokens
    function addToPot(uint[] memory _epochs, 
                        address _source, 
                        uint[] memory _values) 
                        public 
                        returns(bool) {
        require(_epochs.length == _values.length, "Pot: Invalid inputs");
        uint totalValue;
        for(uint i=0; i < _epochs.length; i++) {
            uint updatedPotPerEpoch = potByEpoch[_epochs[i]].value.add(_values[i]);
            potByEpoch[_epochs[i]].value = updatedPotPerEpoch;
            emit PotFunded(msg.sender, _epochs[i], _source, _values[i], updatedPotPerEpoch);
            totalValue = totalValue.add(_values[i]);
        }
        require(LINProxy.transferFrom(_source, address(this), totalValue), "Pot: Couldn't add to pot");
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
        uint claimedAmount;
        for(uint i=0; i < _epochsToClaim.length; i++) {
            uint currentEpoch = getEpoch(block.number);
            //TODO: read about storage structs
            EpochPot memory currentPot = potByEpoch[_epochsToClaim[i]];
            if(!currentPot.isClaimsStarted) {
                if(currentEpoch.sub(_epochsToClaim[i]) > epochsToWaitForClaims[_role]) {
                    for(uint j=0; j < ids.length; j++) {
                        potByEpoch[_epochsToClaim[i]].allocation[ids[j]] = potAllocation[ids[j]].mul(
                                                                                currentPot.value
                                                                             ).div(100);
                    }
                    currentPot.isClaimsStarted = true;
                    potByEpoch[_epochsToClaim[i]] = currentPot;
                } else {
                    return;
                }
            }
            uint noOfClaims = potByEpoch[_epochsToClaim[i]].claims[_role][msg.sender];
            uint claimAmount = potByEpoch[_epochsToClaim[i]].allocation[_role].mul(noOfClaims).div(
                                    potByEpoch[_epochsToClaim[i]].claimsRemaining[_role]
                                );
            potByEpoch[_epochsToClaim[i]].allocation[_role] = potByEpoch[_epochsToClaim[i]].allocation[_role].sub(
                                                                    claimAmount
                                                                );
            potByEpoch[_epochsToClaim[i]].claimsRemaining[_role] = 
                potByEpoch[_epochsToClaim[i]].claimsRemaining[_role].sub(noOfClaims);
            potByEpoch[_epochsToClaim[i]].claims[_role][msg.sender] = 0;
            emit FeeClaimed(_role, msg.sender, claimAmount, _epochsToClaim[i], 
                            noOfClaims, potByEpoch[_epochsToClaim[i]].allocation[_role]);
            claimedAmount = claimedAmount.add(claimAmount);
        }
        LINProxy.transfer(msg.sender, claimedAmount);
    }

    function getMaxClaims(uint _epoch, 
                        bytes32 _role) 
                        public 
                        view 
                        returns(uint) {
        return potByEpoch[_epoch].maxClaims[_role];
    }

    function getPotValue(uint _epoch) public view returns(uint) {
        return potByEpoch[_epoch].value;
    }

    function getEpochsToWaitForClaims(bytes32 _role) public view returns(uint) {
        return epochsToWaitForClaims[_role];
    }
}