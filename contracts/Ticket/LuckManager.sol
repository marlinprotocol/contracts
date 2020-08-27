// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Fund/Pot.sol";

contract LuckManager is Initializable{
    using SafeMath for uint256;

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

    function initialize(address _governanceEnforcerProxy, 
                address _pot, 
                bytes32[] memory _roles, 
                uint[][] memory _luckPerRoles ) 
                public 
                initializer {
        for(uint i=0; i < _luckPerRoles.length; i++) {
            require(_luckPerRoles[i].length == 7, "LuckManager: Invalid Input");
            luckByRoles[_roles[i]] = LuckPerRole(_luckPerRoles[i][0],
                                                            _luckPerRoles[i][1], 
                                                            _luckPerRoles[i][2], 
                                                            _luckPerRoles[i][3], 
                                                            _luckPerRoles[i][4],
                                                            _luckPerRoles[i][5]);
            luckByRoles[_roles[i]].luckLimit[_luckPerRoles[i][3]] = _luckPerRoles[i][6];
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
                                   uint _changeSteps,
                                   uint _initialLuck)
                                   public
                                   onlyGovernanceEnforcer 
                                   returns(bool) {
        luckByRoles[_role] = LuckPerRole(_luckTrailingEpochs,
                                          _targetClaims,
                                          _averagingEpochs,
                                          _startingEpoch,
                                          _varianceTolerance,
                                          _changeSteps);
        luckByRoles[_role].luckLimit[_startingEpoch] = _initialLuck;
        return true;
    }

    function getLuck(uint _epoch, bytes32 _role) public returns(uint) {
        uint currentEpoch = pot.getEpoch(block.number);
        require( currentEpoch >= _epoch , "LuckManager: can't get luck for future epochs");
        // If luck for the epoch and role wasn't calculated before
        if(luckByRoles[_role].luckLimit[_epoch] == 0) {
            LuckPerRole memory luckForCurrentRole = luckByRoles[_role];
            uint epochAfterTrailing = currentEpoch.sub(luckForCurrentRole.luckTrailingEpochs);
            uint totalClaims;
            uint epochCounter;
            for(epochCounter=epochAfterTrailing; (epochAfterTrailing.sub(epochCounter)<
                                                luckForCurrentRole.averagingEpochs) 
                                                && (epochCounter > luckForCurrentRole.startingEpoch); 
                                                epochCounter--) {
                if(luckByRoles[_role].maxClaims[epochCounter]!= 0) {
                    uint maxClaimAtEpoch = pot.getMaxClaims(epochCounter, _role);
                    luckByRoles[_role].maxClaims[epochCounter] = maxClaimAtEpoch;
                }
                totalClaims = totalClaims.add(luckByRoles[_role].maxClaims[epochCounter]);
            }
            uint averageClaims = totalClaims.div(epochAfterTrailing.sub(epochCounter));
            if(luckByRoles[_role].luckLimit[_epoch.sub(1)] == 0) {
                luckByRoles[_role].luckLimit[_epoch.sub(1)] = getLuck(_epoch.sub(1), _role);
            }
            if(averageClaims > luckForCurrentRole.targetClaims) {
                if(averageClaims.mul(uint(100).sub(luckForCurrentRole.varianceTolerance)).div(100) > 
                        luckForCurrentRole.targetClaims) {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch.sub(1)].mul(
                                                                    uint(100).sub(luckForCurrentRole.changeSteps)
                                                                ).div(100);
                } else {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch.sub(1)];
                }
            } else {
                if(averageClaims.mul(luckForCurrentRole.varianceTolerance.add(100)).div(100) < 
                        luckForCurrentRole.targetClaims) {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch.sub(1)].mul(
                                                                    luckForCurrentRole.changeSteps.add(100)
                                                                ).div(100);
                } else {
                    luckByRoles[_role].luckLimit[_epoch] = luckByRoles[_role].luckLimit[_epoch.sub(1)];
                }
            }
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
