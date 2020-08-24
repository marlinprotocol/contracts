// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "../Fund/Pot.sol";

contract LuckManager {

    Pot pot;

    struct LuckPerRole {
        uint currentEpochIndex;
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
}
