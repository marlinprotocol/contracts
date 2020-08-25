// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Fund/Pot.sol";

contract LuckManager is Initializable{

    Pot pot;
    address GovernanceEnforcerProxy;

    struct LuckPerRole {
        // Note: Linked to the epochs in which receipts have to be submitted, because
        // only then will we know the maxClaims for the epoch
        uint luckTrailingEpochs;
        uint targetClaims;
        uint averagingEpochs;
        uint startingEpoch;
        uint varianceTolerance;
        uint changeSteps;

        mapping(uint => uint) luckLimit;
        mapping(uint => uint) maxClaims;
    }

    mapping(bytes32 => LuckPerRole) luckByRoles;

    modifier onlyGovernanceEnforcer() {
        require(msg.sender == address(GovernanceEnforcerProxy), 
                "Pot: Function can only be invoked by Governance Enforcer");
        _;
    }

    constructor(address _governanceEnforcerProxy, 
                address _pot, 
                bytes32[] memory _roles, 
                uint[][] memory _luckPerRoles ) 
                public {
        for(uint i=0; i < _luckPerRoles.length; i++) {
            luckByRoles[_roles[i]] = LuckPerRole(_luckPerRoles[i][0],
                                                            _luckPerRoles[i][1], 
                                                            _luckPerRoles[i][2], 
                                                            _luckPerRoles[i][3], 
                                                            _luckPerRoles[i][4],
                                                            _luckPerRoles[i][5]);
        }
        GovernanceEnforcerProxy = _governanceEnforcerProxy;
        pot = Pot(_pot);
    }

    function initializeLuckForRole(bytes32 _role, 
                                   uint _luckTrailingEpochs, 
                                   uint _targetClaims,
                                   uint _averagingEpochs,
                                   uint _startingEpoch,
                                   uint _varianceTolerance,
                                   uint _changeSteps)
                                   public
                                   onlyGovernanceEnforcer 
                                   returns(bool) {
        luckByRoles[_role] = LuckPerRole(_luckTrailingEpochs,
                                          _targetClaims,
                                          _averagingEpochs,
                                          _startingEpoch,
                                          _varianceTolerance,
                                          _changeSteps);
        return true;
    }
    
    function initialize() public {
        // if nothing to initialize then skip, then remove this
    }

    function getLuck(uint _epoch, bytes32 _role) public returns(uint) {
        uint currentEpoch = pot.getEpoch(block.number);
        require( currentEpoch >= _epoch , "LuckManager: can't get luck for future epochs");
        if(luckByRoles[_role].luckLimit[_epoch] == 0) {
            LuckPerRole memory luckForCurrentRole = luckByRoles[_role];
            uint epochAfterTrailing = currentEpoch-luckForCurrentRole.luckTrailingEpochs;
            uint totalClaims;
            for(uint epoch=epochAfterTrailing; (epochAfterTrailing-epoch>luckForCurrentRole.averagingEpochs) 
                                                && (epoch > luckForCurrentRole.startingEpoch); epoch--) {
                
                if(luckByRoles[_role].maxClaims[epoch]!= 0) {
                    uint maxClaimAtEpoch = pot.getMaxClaims(epoch, _role);
                    luckByRoles[_role].maxClaims[epoch] = maxClaimAtEpoch;
                }
                totalClaims += luckByRoles[_role].maxClaims[epoch];
            }
            //todo: averaging epochs is not right it shoudl be 
            // epochAfterTrailing-epoch, so see how to fix it
            uint averageClaims = totalClaims/luckForCurrentRole.averagingEpochs;
            if(luckByRoles[_role].luckLimit[_epoch-1] == 0) {
                luckByRoles[_role].luckLimit[_epoch-1] = getLuck(_epoch-1, _role);
            }
            if(averageClaims > luckForCurrentRole.targetClaims) {
                if(averageClaims*(100-luckForCurrentRole.varianceTolerance)/100 > luckForCurrentRole.targetClaims) {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch-1]
                                                            *(100+luckForCurrentRole.changeSteps)/100;
                } else {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch - 1];
                }
            } else {
                if(averageClaims*(100+luckForCurrentRole.varianceTolerance)/100 < luckForCurrentRole.targetClaims) {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch-1]
                                                            *(100-luckForCurrentRole.changeSteps)/100;
                } else {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch - 1];
                }
            }
            // todo: delete unused maxClaim entries
        }
        return luckByRoles[_role].luckLimit[_epoch];
    }

    function changeLuckTrailingEpochs(bytes32 _role, 
                                      uint _updatedLuckTrailingEpochs) 
                                      public 
                                      onlyGovernanceEnforcer
                                      returns(bool) {
        luckByRoles[_role].luckTrailingEpochs = _updatedLuckTrailingEpochs;
        return true;
    }

    function changeTargetClaims(bytes32 _role, 
                                uint _updatedTargetClaims) 
                                public 
                                onlyGovernanceEnforcer
                                returns(bool) {
        luckByRoles[_role].targetClaims = _updatedTargetClaims;
        return true;
    }

    function changeAveragingEpochs(bytes32 _role, 
                                uint _updatedAveragingEpochs) 
                                public 
                                onlyGovernanceEnforcer
                                returns(bool) {
        luckByRoles[_role].averagingEpochs = _updatedAveragingEpochs;
        return true;
    }

    function changeVarianceTolerance(bytes32 _role, 
                                uint _updatedVarianceTolerance) 
                                public 
                                onlyGovernanceEnforcer
                                returns(bool) {
        luckByRoles[_role].varianceTolerance = _updatedVarianceTolerance;
        return true;
    }

    function changeChangeSteps(bytes32 _role, 
                                uint _updatedChangeSteps) 
                                public 
                                onlyGovernanceEnforcer
                                returns(bool) {
        luckByRoles[_role].changeSteps = _updatedChangeSteps;
        return true;
    }
}
