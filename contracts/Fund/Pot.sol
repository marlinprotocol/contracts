// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";


contract Pot is Initializable {
    using SafeMath for uint256;

    uint256 MAX_INT;

    address GovernanceEnforcerProxy;

    struct EpochPot {
        // tokenId to tokenValue in pot
        mapping(bytes32 => uint256) value;
        mapping(bytes32 => uint256) currentValue;
        // roleId to address of claim to noOfClaims
        mapping(bytes32 => mapping(address => uint256)) claims;
        mapping(bytes32 => uint256) claimsRemaining;
        mapping(bytes32 => uint256) maxClaims;
    }

    struct ClaimWait {
        uint256 epochsToWaitForClaims;
        uint256 nextEpochsToWaitForClaims;
        uint256 epochOfepochsToWaitForClaimsUpdate;
    }

    mapping(bytes32 => uint256) public potAllocation;
    bytes32[] public ids;
    mapping(bytes32 => address) public tokens;
    bytes32[] tokenList;
    uint256 public firstEpochStartBlock;
    uint256 public blocksPerEpoch;
    mapping(bytes32 => ClaimWait) public claimWait;

    mapping(uint256 => EpochPot) potByEpoch;
    mapping(address => bool) public verifiers;

    event PotAllocated(bytes32[] ids, uint256[] fractionPerCent);
    event PotFunded(
        address invoker,
        uint256 epoch,
        bytes32 token,
        address funder,
        uint256 value,
        uint256 updatedPotValue
    );
    event TicketClaimed(bytes32 role, address claimer, uint256 epoch);
    event FeeClaimed(
        bytes32 role,
        address claimer,
        uint256 value,
        uint256 epoch,
        uint256 noOfClaims,
        bytes32 token
    );

    modifier onlyGovernanceEnforcer() {
        require(
            msg.sender == address(GovernanceEnforcerProxy),
            "Pot: Function can only be invoked by Governance Enforcer"
        );
        _;
    }

    modifier onlyValidVerifier() {
        require(
            verifiers[msg.sender],
            "Pot: Invalid verifier contract trying to add claim"
        );
        _;
    }

    function initialize(
        address _governanceEnforcerProxy,
        uint256 _firstEpochStartBlock,
        uint256 _EthBlocksPerEpoch,
        bytes32[] memory _ids,
        uint256[] memory _fractionPerCent,
        bytes32[] memory _tokens,
        address[] memory _tokenContracts,
        uint256[] memory _epochsToWaitForClaims
    ) public initializer {
        MAX_INT = 2**255 - 1;
        GovernanceEnforcerProxy = _governanceEnforcerProxy;
        firstEpochStartBlock = _firstEpochStartBlock;
        blocksPerEpoch = _EthBlocksPerEpoch;
        _allocatePot(_ids, _fractionPerCent);
        for (uint256 i = 0; i < _ids.length; i++) {
            claimWait[_ids[i]] = ClaimWait(
                _epochsToWaitForClaims[i],
                0,
                MAX_INT
            );
        }
        for (uint256 i = 0; i < _tokens.length; i++) {
            tokens[_tokens[i]] = _tokenContracts[i];
        }
        tokenList = _tokens;
    }

    function addVerifier(address _verifier)
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        verifiers[_verifier] = true;
        return true;
    }

    function removeVerifier(address _verifier)
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        verifiers[_verifier] = false;
        return true;
    }

    function updateSupportedTokenList(
        bytes32[] memory _tokens,
        address[] memory _tokenContracts
    ) public onlyGovernanceEnforcer returns (bool) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            tokens[_tokens[i]] = _tokenContracts[i];
        }
        tokenList = _tokens;
        return true;
    }

    function changeEpochsToWaitForClaims(
        uint256 _updatedWaitEpochs,
        uint256 _epochToUpdate,
        bytes32 _role
    ) public onlyGovernanceEnforcer returns (bool) {
        require(
            _epochToUpdate > Pot.getEpoch(block.number),
            "Pot: can't  change wait time for claims in previous epochs"
        );
        claimWait[_role].nextEpochsToWaitForClaims = _updatedWaitEpochs;
        claimWait[_role].epochOfepochsToWaitForClaimsUpdate = _epochToUpdate;
        return true;
    }

    // Note: Updating blocksperepoch will lead to too many complications
    function changeEthBlocksPerEpoch(uint256 _updatedBlockPerEpoch)
        public
        onlyGovernanceEnforcer
        returns (bool)
    {
        blocksPerEpoch = _updatedBlockPerEpoch;
        return true;
    }

    function allocatePot(
        bytes32[] memory _ids,
        uint256[] memory _fractionPerCent
    ) public onlyGovernanceEnforcer {
        _allocatePot(_ids, _fractionPerCent);
    }

    function _allocatePot(
        bytes32[] memory _ids,
        uint256[] memory _fractionPerCent
    ) internal {
        require(_ids.length == _fractionPerCent.length);
        uint256 totalFraction;
        // clean the previous allocations
        bytes32[] memory localIds = ids;
        for (uint256 i = 0; i < localIds.length; i++) {
            delete potAllocation[localIds[i]];
        }
        delete ids;
        // set the new allocations
        for (uint256 i = 0; i < _ids.length; i++) {
            totalFraction = totalFraction.add(_fractionPerCent[i]);
            potAllocation[_ids[i]] = _fractionPerCent[i];
        }
        require(totalFraction == 100, "Pot: Total is not 100%");
        ids = _ids;
        emit PotAllocated(_ids, _fractionPerCent);
    }

    function getEpoch(uint256 _blockNumber) public view returns (uint256) {
        return _blockNumber.sub(firstEpochStartBlock).div(blocksPerEpoch);
    }

    function getCurrentEpoch() public view returns (uint256) {
        return block.number.sub(firstEpochStartBlock).div(blocksPerEpoch);
    }

    // Note: These tokens should be approved by governance else can be attacked
    function addToPot(
        uint256[] memory _epochs,
        address _source,
        bytes32 _token,
        uint256[] memory _values
    ) public returns (bool) {
        require(_epochs.length == _values.length, "Pot: Invalid inputs");
        uint256 totalValue;
        for (uint256 i = 0; i < _epochs.length; i++) {
            uint256 updatedPotPerEpoch = potByEpoch[_epochs[i]].value[_token]
                .add(_values[i]);
            potByEpoch[_epochs[i]].value[_token] = updatedPotPerEpoch;
            potByEpoch[_epochs[i]].currentValue[_token] = potByEpoch[_epochs[i]]
                .currentValue[_token]
                .add(_values[i]);
            emit PotFunded(
                msg.sender,
                _epochs[i],
                _token,
                _source,
                _values[i],
                updatedPotPerEpoch
            );
            totalValue = totalValue.add(_values[i]);
        }
        require(
            IERC20(tokens[_token]).transferFrom(
                _source,
                address(this),
                totalValue
            ),
            "Pot: Couldn't add to pot"
        );
        return true;
    }

    function claimTicket(
        bytes32[] memory _roles,
        address[] memory _claimers,
        uint256[] memory _epochs
    ) public onlyValidVerifier returns (bool) {
        require(
            _roles.length == _claimers.length &&
                _claimers.length == _epochs.length,
            "Pot: Invalid inputs to claim ticket"
        );
        for (uint256 i = 0; i < _roles.length; i++) {
            potByEpoch[_epochs[i]]
                .claims[_roles[i]][_claimers[i]] = potByEpoch[_epochs[i]]
                .claims[_roles[i]][_claimers[i]]
                .add(1);
            potByEpoch[_epochs[i]]
                .claimsRemaining[_roles[i]] = potByEpoch[_epochs[i]]
                .claimsRemaining[_roles[i]]
                .add(1);
            potByEpoch[_epochs[i]].maxClaims[_roles[i]] = potByEpoch[_epochs[i]]
                .maxClaims[_roles[i]]
                .add(1);
            emit TicketClaimed(_roles[i], _claimers[i], _epochs[i]);
        }
        return true;
    }

    function claimFeeReward(bytes32 _role, uint256[] memory _epochsToClaim)
        public
    {
        uint256 currentEpoch = getEpoch(block.number);
        uint256 currentClaimWait = handleChangeToEpochWait(_role, currentEpoch);
        bytes32[] memory memTokenList = tokenList;
        uint256[] memory claimedAmount = new uint256[](memTokenList.length);
        for (uint256 i = 0; i < _epochsToClaim.length; i++) {
            require(
                currentEpoch.sub(_epochsToClaim[i]) > currentClaimWait,
                "Pot: Fee can't be redeemed before wait time"
            );
            uint256 noOfClaims = potByEpoch[_epochsToClaim[i]].claims[_role][msg
                .sender];
            require(noOfClaims > 0, "Pot: No claims to redeem");
            uint256 rolePotAllocation = potAllocation[_role];
            for (uint256 j = 0; j < memTokenList.length; j++) {
                uint256 allocatedValue = potByEpoch[_epochsToClaim[i]]
                    .value[memTokenList[j]]
                    .mul(rolePotAllocation)
                    .div(100);
                uint256 claimAmount = allocatedValue.mul(noOfClaims).div(
                    potByEpoch[_epochsToClaim[i]].claimsRemaining[_role]
                );
                potByEpoch[_epochsToClaim[i]]
                    .currentValue[memTokenList[j]] = potByEpoch[_epochsToClaim[i]]
                    .currentValue[memTokenList[j]]
                    .sub(claimAmount);

                emit FeeClaimed(
                    _role,
                    msg.sender,
                    claimAmount,
                    _epochsToClaim[i],
                    noOfClaims,
                    tokenList[j]
                );
                claimedAmount[j] = claimedAmount[j].add(claimAmount);
            }
            potByEpoch[_epochsToClaim[i]]
                .claimsRemaining[_role] = potByEpoch[_epochsToClaim[i]]
                .claimsRemaining[_role]
                .sub(noOfClaims);
            potByEpoch[_epochsToClaim[i]].claims[_role][msg.sender] = 0;
        }
        for (uint256 i = 0; i < tokenList.length; i++) {
            IERC20(tokens[tokenList[i]]).transfer(msg.sender, claimedAmount[i]);
        }
    }

    function handleChangeToEpochWait(bytes32 _role, uint256 _currentEpoch)
        internal
        returns (uint256)
    {
        ClaimWait memory claimWaitForRole = claimWait[_role];
        if (
            claimWaitForRole.epochOfepochsToWaitForClaimsUpdate <= _currentEpoch
        ) {
            claimWaitForRole.epochsToWaitForClaims = claimWaitForRole
                .nextEpochsToWaitForClaims;
            claimWaitForRole.epochOfepochsToWaitForClaimsUpdate = MAX_INT;
            claimWait[_role] = claimWaitForRole;
        }
        return claimWaitForRole.epochsToWaitForClaims;
    }

    // function getClaimedAmountByTokens(bytes32[] memory memTokenList,
    //         uint claimEpoch,
    //         bytes32 role,
    //         uint noOfClaims,
    //         uint[] memory claimedAmount
    //     )  internal
    //     returns(uint[] memory) {

    //     return claimedAmount;
    // }

    function getMaxClaims(uint256 _epoch, bytes32 _role)
        public
        view
        returns (uint256)
    {
        return potByEpoch[_epoch].maxClaims[_role];
    }

    function getPotValue(uint256 _epoch, bytes32 _tokenId)
        public
        view
        returns (uint256)
    {
        return potByEpoch[_epoch].value[_tokenId];
    }

    function getClaims(
        uint256 _epoch,
        bytes32 _role,
        address _claimer
    ) public view returns (uint256) {
        return potByEpoch[_epoch].claims[_role][_claimer];
    }

    function getRemainingClaims(uint256 _epoch, bytes32 _role)
        public
        view
        returns (uint256)
    {
        return potByEpoch[_epoch].claimsRemaining[_role];
    }
}
