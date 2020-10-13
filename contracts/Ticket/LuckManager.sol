// SPDX-License-Identifier: <SPDX-License>

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Fund/Pot.sol";


contract LuckManager is Initializable {
    using SafeMath for uint256;

    Pot pot;
    address GovernanceEnforcerProxy;

    struct LuckPerRole {
        // Note: Linked to the epochs in which receipts have to be submitted, because
        // only then will we know the maxClaims for the epoch
        uint256 luckTrailingEpochs;
        uint256 targetClaims;
        uint256 averagingEpochs;
        uint256 startingEpoch;
        uint256 varianceTolerance;
        uint256 changeSteps;
        mapping(uint256 => uint256) luckLimit;
        mapping(uint256 => uint256) maxClaims;
    }

    mapping(bytes32 => LuckPerRole) public luckByRoles;

    modifier onlyGovernanceEnforcer() {
        require(
            msg.sender == address(GovernanceEnforcerProxy),
            "Pot: Function can only be invoked by Governance Enforcer"
        );
        _;
    }

    function initialize(
        address _governanceEnforcerProxy,
        address _pot,
        bytes32[] memory _roles,
        uint256[][] memory _luckPerRoles
    ) public initializer {
        require(
            _roles.length == _luckPerRoles.length,
            "LuckManager: Invalid Inputs"
        );
        for (uint256 i = 0; i < _luckPerRoles.length; i++) {
            require(_luckPerRoles[i].length == 7, "LuckManager: Invalid Input");
            luckByRoles[_roles[i]] = LuckPerRole(
                _luckPerRoles[i][0],
                _luckPerRoles[i][1],
                _luckPerRoles[i][2],
                _luckPerRoles[i][3],
                _luckPerRoles[i][4],
                _luckPerRoles[i][5]
            );
            luckByRoles[_roles[i]]
                .luckLimit[_luckPerRoles[i][3]] = _luckPerRoles[i][6];
        }
        GovernanceEnforcerProxy = _governanceEnforcerProxy;
        pot = Pot(_pot);
    }

    function initializeLuckForRole(
        bytes32 _role,
        uint256 _luckTrailingEpochs,
        uint256 _targetClaims,
        uint256 _averagingEpochs,
        uint256 _startingEpoch,
        uint256 _varianceTolerance,
        uint256 _changeSteps,
        uint256 _initialLuck
    ) public onlyGovernanceEnforcer returns (bool) {
        luckByRoles[_role] = LuckPerRole(
            _luckTrailingEpochs,
            _targetClaims,
            _averagingEpochs,
            _startingEpoch,
            _varianceTolerance,
            _changeSteps
        );
        luckByRoles[_role].luckLimit[_startingEpoch] = _initialLuck;
        return true;
    }

    function getCurrentLuck(bytes32 _role) public returns (uint256) {
        uint256 currentEpoch = pot.getEpoch(block.number);
        return getLuck(currentEpoch, _role);
    }

    function getLuck(uint256 _epoch, bytes32 _role) public returns (uint256) {
        uint256 currentEpoch = pot.getEpoch(block.number);
        require(
            currentEpoch >= _epoch,
            "LuckManager: can't get luck for future epochs"
        );
        // If luck for the epoch and role wasn't calculated before
        if (luckByRoles[_role].luckLimit[_epoch] == 0) {
            LuckPerRole memory luckForCurrentRole = luckByRoles[_role];
            require(
                _epoch > luckForCurrentRole.startingEpoch,
                "Can't calculate luck for epochs before startingEpoch"
            );
            uint256 epochAfterTrailing = currentEpoch.sub(
                luckForCurrentRole.luckTrailingEpochs
            );
            uint256 totalClaims;
            uint256 epochCounter;
            for (
                epochCounter = epochAfterTrailing;
                (epochAfterTrailing.sub(epochCounter) <
                    luckForCurrentRole.averagingEpochs) &&
                    (epochCounter > luckForCurrentRole.startingEpoch);
                epochCounter--
            ) {
                if (luckByRoles[_role].maxClaims[epochCounter] == 0) {
                    uint256 maxClaimAtEpoch = pot.getMaxClaims(
                        epochCounter,
                        _role
                    );
                    luckByRoles[_role]
                        .maxClaims[epochCounter] = maxClaimAtEpoch;
                }
                totalClaims = totalClaims.add(
                    luckByRoles[_role].maxClaims[epochCounter]
                );
            }
            uint256 averageClaims;
            if (epochAfterTrailing == epochCounter) {
                averageClaims = 0;
            } else {
                averageClaims = totalClaims.div(
                    epochAfterTrailing.sub(epochCounter)
                );
            }
            delete epochCounter;
            if (luckByRoles[_role].luckLimit[_epoch.sub(1)] == 0) {
                luckByRoles[_role].luckLimit[_epoch.sub(1)] = getLuck(
                    _epoch.sub(1),
                    _role
                );
            }
            luckByRoles[_role].luckLimit[_epoch] = getNextLuck(
                luckByRoles[_role].luckLimit[_epoch.sub(1)],
                averageClaims,
                luckForCurrentRole
            );
        }
        return luckByRoles[_role].luckLimit[_epoch];
    }

    function getNextLuck(
        uint256 _previousLuck,
        uint256 _averageClaims,
        LuckPerRole memory luckData
    ) internal pure returns (uint256 luck) {
        if (_averageClaims > luckData.targetClaims) {
            if (
                _averageClaims
                    .mul(uint256(100).sub(luckData.varianceTolerance))
                    .div(100) > luckData.targetClaims
            ) {
                luck = _previousLuck
                    .mul(uint256(100).sub(luckData.changeSteps))
                    .div(100);
            } else {
                luck = _previousLuck;
            }
        } else {
            if (
                _averageClaims.mul(luckData.varianceTolerance.add(100)).div(
                    100
                ) < luckData.targetClaims
            ) {
                luck = _previousLuck.mul(luckData.changeSteps.add(100)).div(
                    100
                );
            } else {
                luck = _previousLuck;
            }
        }
    }

    function changeLuckTrailingEpochs(
        bytes32 _role,
        uint256 _updatedLuckTrailingEpochs
    ) public onlyGovernanceEnforcer returns (bool) {
        luckByRoles[_role].luckTrailingEpochs = _updatedLuckTrailingEpochs;
        return true;
    }

    function changeTargetClaims(bytes32 _role, uint256 _updatedTargetClaims)
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        luckByRoles[_role].targetClaims = _updatedTargetClaims;
        return true;
    }

    function changeAveragingEpochs(
        bytes32 _role,
        uint256 _updatedAveragingEpochs
    ) public onlyGovernanceEnforcer returns (bool) {
        luckByRoles[_role].averagingEpochs = _updatedAveragingEpochs;
        return true;
    }

    function changeVarianceTolerance(
        bytes32 _role,
        uint256 _updatedVarianceTolerance
    ) public onlyGovernanceEnforcer returns (bool) {
        luckByRoles[_role].varianceTolerance = _updatedVarianceTolerance;
        return true;
    }

    function changeChangeSteps(bytes32 _role, uint256 _updatedChangeSteps)
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        luckByRoles[_role].changeSteps = _updatedChangeSteps;
        return true;
    }
}
