// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;
// pragma experimental ABIEncoderV2;

import "../Token/TokenLogic.sol";
import "./Pot.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";


contract FundManager is Initializable {
    using SafeMath for uint256;

    uint256 MAX_INT;
    //TODO: Contract which contains all global variables like proxies
    TokenLogic LINProxy;
    address GovernanceEnforcerProxy;
    bytes32 tokenId;

    struct Fund {
        // Amount to be rewarded per epoch
        uint256 inflationPerEpoch;
        // Epoch before which pot can pull funds
        uint256 endEpoch;
        // Last epoch for which money was drawn
        uint256 lastDrawnEpoch;
        // Id of the network
        address pot;
        uint256 nextInflation;
        uint256 nextInflationUpdateEpoch;
        // Amount that is withdrawn when the inflation rate changed before the fund can be claimed
        uint256 unclaimedInflationChangewithdrawal;
        // contains 2 arrays, First array represents the start and end values, corresponding second element
        // represents inflation between them.
        uint256[6] inflationEpochLog;
        uint256[6] inflationLog;
        uint256 inflationEpochLogIndex;
    }

    uint256 public fundBalance;
    uint256 public unallocatedBalance;
    mapping(address => Fund) public funds;

    event FundBalanceUpdated(uint256 prevBalance, uint256 currentBalance);
    event FundCreated(
        address pot,
        uint256 inflationPerEpoch,
        uint256 endBlock,
        uint256 lastDrawnEpoch
    );
    event FundInflationUpdated(
        address pot,
        uint256 currentInflation,
        uint256 updatedInflation,
        uint256 epochOfUpdate
    );
    event FundEndEpochUpdated(
        address pot,
        uint256 currentEndEpoch,
        uint256 updatedEndEpoch
    );
    event FundPotAddressUpdated(address previousPot, address updatedPot);
    event FundDrawn(address pot, uint256 amountDrawn, uint256 fundBalance);

    function initialize(
        address _LINProxy,
        address _governanceEnforcerProxy,
        bytes32 _tokenId
    ) public initializer {
        MAX_INT = 2**255 - 1;
        LINProxy = TokenLogic(_LINProxy);
        GovernanceEnforcerProxy = _governanceEnforcerProxy;
        tokenId = _tokenId;
    }

    modifier onlyGovernanceEnforcer() {
        require(
            msg.sender == address(GovernanceEnforcerProxy),
            "Function can only be invoked by Governance Enforcer"
        );
        _;
    }

    // Note: If this function execute successfully when new fund
    // wasn't allocated to rewards, then something is not right
    // The update should never result in lower Balance than the fund balance
    //todo: Is it a security risk to keep this open, just in case, there is a
    // leak in the way fundbalance or unallocated balance is calculated.
    function updateLINAllocation() public {
        uint256 _fundBalance = LINProxy.balanceOf(address(this));
        require(
            _fundBalance != fundBalance,
            "Fund Balance is as per the current balance"
        );
        emit FundBalanceUpdated(fundBalance, _fundBalance);
        unallocatedBalance = unallocatedBalance.add(_fundBalance).sub(
            fundBalance
        );
        fundBalance = _fundBalance;
    }

    // This function is used by governance contract to create fund for a network that can be paid for rewards by the pot
    function createFund(
        address _pot,
        uint256 _inflationPerEpoch,
        uint256 _endEpoch,
        uint256 _lastDrawnEpoch
    ) external onlyGovernanceEnforcer {
        require(funds[_pot].endEpoch == 0, "Fund already exists");
        require(
            _endEpoch > _lastDrawnEpoch,
            "Fund should start before endEpoch"
        );
        uint256 potForFund = _inflationPerEpoch.mul(
            _endEpoch.sub(_lastDrawnEpoch)
        );
        require(
            unallocatedBalance >= potForFund,
            "Fund not sufficient to allocate"
        );
        unallocatedBalance = unallocatedBalance.sub(potForFund);
        uint256[6] memory inflationLogInit = [uint256(0), 0, 0, 0, 0, 0];
        uint256[6] memory inflationEpochLogInit = [
            _lastDrawnEpoch,
            0,
            0,
            0,
            0,
            0
        ];
        Fund memory fund = Fund(
            _inflationPerEpoch,
            _endEpoch,
            _lastDrawnEpoch,
            _pot,
            0,
            MAX_INT,
            0,
            inflationEpochLogInit,
            inflationLogInit,
            1
        );
        funds[_pot] = fund;
        emit FundCreated(_pot, _inflationPerEpoch, _endEpoch, _lastDrawnEpoch);
    }

    function updateFundInflation(
        uint256 _updatedInflation,
        uint256 _epochOfUpdate,
        address _pot
    ) external onlyGovernanceEnforcer returns (bool) {
        uint256 currentEpoch = Pot(_pot).getEpoch(block.number);
        require(
            currentEpoch < _epochOfUpdate,
            "Can't update inflation of previous epochs"
        );
        Fund memory fund = funds[_pot];
        // Note: Haven't used > currentepoch because it  is possible to allocate
        // more funds to a pot after it has expired
        require(fund.endEpoch != 0, "Pot doesn't exist");
        if (currentEpoch > fund.nextInflationUpdateEpoch) {
            fund.unclaimedInflationChangewithdrawal = fund
                .unclaimedInflationChangewithdrawal
                .add(
                fund.inflationPerEpoch.mul(
                    fund.nextInflationUpdateEpoch.sub(fund.lastDrawnEpoch)
                )
            );
            //  Draw can need 2 indexes
            require(
                fund.inflationEpochLogIndex < 4,
                "Draw  before performing more operations"
            );
            fund.inflationEpochLog[fund.inflationEpochLogIndex] = fund
                .nextInflationUpdateEpoch;
            fund.inflationLog[fund.inflationEpochLogIndex - 1] = fund
                .inflationPerEpoch;
            fund.inflationEpochLogIndex++;
            fund.inflationPerEpoch = fund.nextInflation;
            fund.lastDrawnEpoch = fund.nextInflationUpdateEpoch;
        } else if (fund.nextInflationUpdateEpoch != MAX_INT) {
            if (fund.endEpoch >= fund.nextInflationUpdateEpoch) {
                if (fund.nextInflation >= fund.inflationPerEpoch) {
                    unallocatedBalance = unallocatedBalance.add(
                        fund.nextInflation.sub(fund.inflationPerEpoch).mul(
                            fund.endEpoch.sub(fund.nextInflationUpdateEpoch)
                        )
                    );
                } else {
                    unallocatedBalance = unallocatedBalance.sub(
                        fund.inflationPerEpoch.sub(fund.nextInflation).mul(
                            fund.endEpoch.sub(fund.nextInflationUpdateEpoch)
                        )
                    );
                }
            }
        }
        // TODO: Can signed math be used here, makes things easier
        if (fund.endEpoch >= _epochOfUpdate) {
            if (_updatedInflation >= fund.inflationPerEpoch) {
                unallocatedBalance = unallocatedBalance.sub(
                    _updatedInflation.sub(fund.inflationPerEpoch).mul(
                        fund.endEpoch.sub(_epochOfUpdate)
                    )
                );
            } else {
                unallocatedBalance = unallocatedBalance.add(
                    fund.inflationPerEpoch.sub(_updatedInflation).mul(
                        fund.endEpoch.sub(_epochOfUpdate)
                    )
                );
            }
        }
        fund.nextInflation = _updatedInflation;
        fund.nextInflationUpdateEpoch = _epochOfUpdate;
        funds[_pot] = fund;
        emit FundInflationUpdated(
            _pot,
            fund.inflationPerEpoch,
            _updatedInflation,
            _epochOfUpdate
        );
        return true;
    }

    function updateEndEpoch(uint256 _updatedEndEpoch, address _pot)
        external
        onlyGovernanceEnforcer
        returns (bool)
    {
        uint256 currentEpoch = Pot(_pot).getEpoch(block.number);
        Fund memory fund = funds[_pot];
        require(fund.endEpoch != 0, "Pot doesn't exist");
        // TODO: Should there be more time
        require(
            _updatedEndEpoch > currentEpoch,
            "Can't change endEpoch to previous or ongoing epochs"
        );
        if (_updatedEndEpoch >= fund.endEpoch) {
            uint256 finalInflation;
            if (fund.nextInflationUpdateEpoch == MAX_INT) {
                finalInflation = fund.inflationPerEpoch;
            } else {
                finalInflation = fund.nextInflation;
            }
            uint256 requiredBalance = finalInflation.mul(
                _updatedEndEpoch.sub(fund.endEpoch)
            );
            unallocatedBalance = unallocatedBalance.sub(requiredBalance);
        } else {
            if (_updatedEndEpoch >= fund.nextInflationUpdateEpoch) {
                unallocatedBalance = unallocatedBalance.add(
                    fund.nextInflation.mul(fund.endEpoch.sub(_updatedEndEpoch))
                );
            } else {
                unallocatedBalance = unallocatedBalance
                    .add(
                    fund.nextInflation.mul(
                        fund.endEpoch.sub(fund.nextInflationUpdateEpoch)
                    )
                )
                    .add(
                    fund.inflationPerEpoch.mul(
                        fund.nextInflationUpdateEpoch.sub(_updatedEndEpoch)
                    )
                );
            }
        }
        funds[_pot].endEpoch = _updatedEndEpoch;
        emit FundEndEpochUpdated(_pot, fund.endEpoch, _updatedEndEpoch);
        return true;
    }

    function updateFundPot(
        address _currentPotAddress,
        address _updatedPotAddress
    ) external onlyGovernanceEnforcer returns (bool) {
        // Ensure that the  updated pot does not override current pots
        require(funds[_updatedPotAddress].endEpoch == 0);
        funds[_updatedPotAddress] = funds[_currentPotAddress];
        delete funds[_currentPotAddress];
        emit FundPotAddressUpdated(_currentPotAddress, _updatedPotAddress);
        return true;
    }

    // This function is used by Pot contract to draw money till the epoch of specified block
    function draw(address _pot, uint256 _epoch)
        external
    // returns (uint256[6] memory, uint256[6] memory)
    {
        Fund memory fund = funds[_pot];
        require(fund.endEpoch > 0, "Fund doesn't exist");
        require(
            _epoch <= Pot(_pot).getEpoch(block.number),
            "Can't draw from future epochs"
        );
        uint256 currentEpoch = _epoch;
        require(
            currentEpoch > fund.lastDrawnEpoch,
            "Can't draw from already drawn epoch"
        );
        uint256 lastEpochToDrawFrom;
        uint256 withdrawalAmount;

        if (fund.nextInflationUpdateEpoch <= currentEpoch) {
            withdrawalAmount = withdrawalAmount.add(
                handleInflationChange(_pot, fund)
            );
            fund = funds[_pot];
        }

        if (currentEpoch > fund.endEpoch) {
            lastEpochToDrawFrom = fund.endEpoch;
        } else {
            lastEpochToDrawFrom = currentEpoch;
        }

        withdrawalAmount = withdrawalAmount
            .add(fund.unclaimedInflationChangewithdrawal)
            .add(
            fund.inflationPerEpoch.mul(
                lastEpochToDrawFrom.sub(fund.lastDrawnEpoch)
            )
        );
        require(
            fund.inflationEpochLogIndex <= 5,
            "Draw  before performing more operations"
        );
        fund.inflationEpochLog[fund
            .inflationEpochLogIndex] = lastEpochToDrawFrom;
        fund.inflationLog[fund.inflationEpochLogIndex - 1] = fund
            .inflationPerEpoch;
        fund.inflationEpochLogIndex++;
        uint256[6] memory localInflationLog = fund.inflationLog;
        uint256[6] memory localInflationEpochLog = fund.inflationEpochLog;
        uint256 localInflationEpochLogIndex = fund.inflationEpochLogIndex;
        // RESET Inflation log for next draw
        delete fund.inflationEpochLog;
        fund.inflationEpochLog[0] = lastEpochToDrawFrom;
        delete fund.inflationLog;
        fund.inflationEpochLogIndex = 1;
        fund.unclaimedInflationChangewithdrawal = 0;
        fund.lastDrawnEpoch = lastEpochToDrawFrom;
        funds[_pot] = fund;
        require(
            fundBalance >= withdrawalAmount,
            "Balance with fund not sufficient"
        );
        fundBalance = fundBalance.sub(withdrawalAmount);
        uint256 approvedTokens = LINProxy.allowance(address(this), _pot);
        withdrawalAmount = withdrawalAmount.add(approvedTokens);
        require(
            LINProxy.approve(_pot, withdrawalAmount),
            "Fund not allocated to pot"
        );
        uint256[] memory epochs = new uint256[](
            localInflationEpochLog[localInflationEpochLogIndex.sub(1)].sub(
                localInflationEpochLog[0]
            )
        );
        uint256[] memory values = epochs;
        uint256 index = 0;
        for (uint256 i = 0; i < localInflationEpochLogIndex - 1; i++) {
            for (
                uint256 j = localInflationEpochLog[i];
                j < localInflationEpochLog[i + 1];
                j++
            ) {
                epochs[index] = j;
                values[index] = localInflationLog[i];
                index++;
            }
        }
        require(
            Pot(_pot).addToPot(epochs, address(this), tokenId, values),
            "Verifier_Producer: Could not add to pot"
        );
        emit FundDrawn(_pot, withdrawalAmount, fundBalance);
        // return (localInflationEpochLog, localInflationLog);
    }

    function handleInflationChange(address _pot, Fund memory fund)
        private
        returns (uint256 fundToWithdrawBeforeInflationChange)
    {
        uint256 fundToWithdraw = fund.inflationPerEpoch.mul(
            fund.nextInflationUpdateEpoch.sub(fund.lastDrawnEpoch)
        );
        require(
            fund.inflationEpochLogIndex < 5,
            "Draw  before performing more operations"
        );
        fund.inflationEpochLog[fund.inflationEpochLogIndex] = fund
            .nextInflationUpdateEpoch;
        fund.inflationLog[fund.inflationEpochLogIndex - 1] = fund
            .inflationPerEpoch;
        fund.inflationEpochLogIndex++;
        fund.inflationPerEpoch = fund.nextInflation;
        fund.lastDrawnEpoch = fund.nextInflationUpdateEpoch;
        fund.nextInflation = 0;
        fund.nextInflationUpdateEpoch = MAX_INT;
        funds[_pot] = fund;
        return fundToWithdraw;
    }
}
