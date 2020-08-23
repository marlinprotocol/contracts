// SPDX-License-Identifier: <SPDX-License>

pragma solidity >=0.4.21 <0.7.0;

import "../Token/TokenLogic.sol";
import "./Pot.sol";

// TODO:: Use safemath

contract FundManager {
    uint constant MAX_INT = 2**255-1;
    //TODO: Contract which contains all global variables like proxies
    TokenLogic LINProxy = TokenLogic(address(0));
    // TODO: Update the governanceEnforcerProxyAddress
    address constant GovernanceEnforcerProxy = address(0);

    struct Fund {
        // Amount to be rewarded per epoch
        uint inflationPerEpoch;
        // // epoch length in number of Eth blocks
        // uint epochLength; get this from the pot itself. Pot will have a getEpoch method
        // TODO: Check if pot can be a source of truth for the epochlength or should it be 
        // indepedently mauintained in the epoch as well. for security
        // // fund start time stamp. This should be start block of an epoch.
        // uint startBlock; Calculate the current epoch from the pot
        // Epoch before which pot can pull funds
        uint endEpoch;
        // Last epoch for which money was drawn
        uint lastDrawnEpoch;
        // Id of the network
        address pot;

        uint nextInflation;
        uint nextInflationUpdateEpoch;
        // Amount that is withdrawn when the inflation rate changed before the fund can be claimed
        uint unclaimedInflationChangewithdrawal;
        // contains 2 arrays, First array represents the start and end values, corresponding second element
        // represents inflation between them.
        uint[][] inflationLog;
    }
    
    uint fundBalance;
    uint unallocatedBalance;
    mapping(address => Fund) funds;

    event FundBalanceUpdated(uint prevBalance, uint currentBalance);
    event FundCreated(address pot, uint inflationPerEpoch, uint endBlock, uint lastDrawnEpoch);
    event FundInflationUpdated(address pot, uint currentInflation, uint updatedInflation, uint epochOfUpdate);
    event FundEndEpochUpdated(address pot, uint currentEndEpoch, uint updatedEndEpoch);
    event FundPotAddressUpdated(address previousPot, address  updatedPot);
    event FundDrawn(address pot, uint amountDrawn, uint fundBalance);

    modifier onlyGovernanceEnforcer() {
        require(msg.sender == address(GovernanceEnforcerProxy), "Function can only be invoked by Governance Enforcer");
        _;
    }
    
    // Note: If this function execute successfully when new fund 
    // wasn't allocated to rewards, then something is not right
    // The update should never result in lower Balance than the fund balance
    function updateLINAllocation() 
                                public {
        uint _fundBalance = LINProxy.balanceOf(address(this));
        require(_fundBalance != fundBalance, "Fund Balance is as per the current balance");
        emit FundBalanceUpdated(fundBalance, _fundBalance);
        unallocatedBalance = unallocatedBalance + _fundBalance - fundBalance;
        fundBalance = _fundBalance;
    }
    
    // This function is used by governance contract to create fund for a network that can be paid for rewards by the pot
    function createFund(address _pot, 
                        uint _inflationPerEpoch, 
                        uint _endEpoch, 
                        uint _lastDrawnEpoch) 
                        onlyGovernanceEnforcer 
                        external {
        uint currentEpoch = Pot(_pot).getEpoch(block.number);
        require(_endEpoch >= currentEpoch, "Fund cannot end before starting");
        require(unallocatedBalance >= _inflationPerEpoch*(_endEpoch - _lastDrawnEpoch), 
                "Fund not sufficient to allocate");
        Fund memory fund = Fund(_inflationPerEpoch, _endEpoch, _lastDrawnEpoch, _pot, 0, MAX_INT, 0, uint[][]);
        funds[_pot] = fund;
        emit FundCreated(_pot, _inflationPerEpoch, _endEpoch, _lastDrawnEpoch);
    }

    function updateFundInflation(uint _updatedInflation, 
                                uint _epochOfUpdate, 
                                address _pot) 
                                onlyGovernanceEnforcer 
                                external {
        uint currentEpoch = Pot(_pot).getEpoch(block.number);
        // todo: should we leave more time.
        require(currentEpoch < _epochOfUpdate, "Can't update inflation of previous epochs");
        Fund memory fund = funds[_pot];
        require(fund.endEpoch != 0, "Pot doesn't exist");
        if(currentEpoch > fund.nextInflationUpdateEpoch) {
            fund.unclaimedInflationChangewithdrawal += fund.inflationPerEpoch*(fund.nextInflationUpdateEpoch 
                                                                                - fund.lastDrawnEpoch);
            fund.inflationLog[0].push(fund.nextInflationUpdateEpoch);
            fund.inflationLog[1].push(fund.inflationPerEpoch);
            fund.inflationPerEpoch = fund.nextInflation;
            fund.lastDrawnEpoch = fund.nextInflationUpdateEpoch;
        }
        // todo: Handle negative values for below
        unallocatedBalance = unallocatedBalance + 
                            (_updatedInflation - fund.inflationPerEpoch)*
                            (fund.endEpoch - _epochOfUpdate);
        fund.nextInflation = _updatedInflation;
        fund.nextInflationUpdateEpoch = _epochOfUpdate;
        funds[_pot] = fund;
        emit FundInflationUpdated(_pot, fund.inflationPerEpoch, _updatedInflation, _epochOfUpdate);
    }

    function updateEndEpoch(uint _updatedEndEpoch, 
                            address _pot) 
                            onlyGovernanceEnforcer 
                            external {
        uint currentEpoch = Pot(_pot).getEpoch(block.number);
        require(_updatedEndEpoch != 0);
        Fund memory fund = funds[_pot];
        require(fund.endEpoch != 0, "Pot doesn't exist");
        require(_updatedEndEpoch > currentEpoch, "Can't change inflation for previous or ongoing epochs");
        if(_updatedEndEpoch >= fund.endEpoch) {
            uint finalInflation;
            if(fund.nextInflationUpdateEpoch == MAX_INT) {
                finalInflation = fund.inflationPerEpoch;
            } else {
                finalInflation = fund.nextInflation;
            }
            uint requiredBalance = finalInflation*(_updatedEndEpoch - fund.endEpoch);
            require(unallocatedBalance >= requiredBalance);
            unallocatedBalance -= requiredBalance;
        } else {
            if(_updatedEndEpoch >= fund.nextInflationUpdateEpoch) {
                unallocatedBalance += fund.nextInflation*(fund.endEpoch - _updatedEndEpoch);
            } else {
                unallocatedBalance += fund.nextInflation*(fund.endEpoch - fund.nextInflationUpdateEpoch) 
                                    + fund.inflationPerEpoch*(fund.nextInflationUpdateEpoch - _updatedEndEpoch);
            }
        }
        funds[_pot].endEpoch = _updatedEndEpoch;
        emit FundEndEpochUpdated(_pot, fund.endEpoch, _updatedEndEpoch);
    }

    function updateFundPot(address _currentPotAddress, address _updatedPotAddress) onlyGovernanceEnforcer external {
        // Ensure that the  updated pot does not override current pots
        require(funds[_updatedPotAddress].endEpoch == 0);
        funds[_updatedPotAddress] = funds[_currentPotAddress];
        delete funds[_currentPotAddress];
        emit FundPotAddressUpdated(_currentPotAddress, _updatedPotAddress);
    }

    // This function is used by Pot contract to draw money till the previous epoch
    // TODO: think about balance that will probably be left at  the very end of a fund allocation
    // todo: Add feature such that it is possible to draw till specified epoch
    function draw(address _pot) external returns(uint[][] memory) {
        Fund memory fund = funds[_pot];
        // require(fund.lastDrawnEpoch > fund.endEpoch, "Fund closed");
        require(fund.endEpoch > 0, "Fund doesn't exist");
        uint currentEpoch = Pot(_pot).getEpoch(block.number);
        uint lastEpochToDrawFrom;
        uint withdrawalAmount;
        uint[][] memory localInflationLog;

        if(fund.nextInflationUpdateEpoch <= currentEpoch) {
            withdrawalAmount += handleInflationChange(_pot, currentEpoch);
            fund = funds[_pot];
        }

        if(currentEpoch > fund.endEpoch) {
            lastEpochToDrawFrom = fund.endEpoch;
        } else {
            lastEpochToDrawFrom = currentEpoch;
        }

        withdrawalAmount += fund.unclaimedInflationChangewithdrawal + 
                            fund.inflationPerEpoch*(lastEpochToDrawFrom - fund.lastDrawnEpoch);
        fund.inflationLog[0].push(lastEpochToDrawFrom);
        fund.inflationLog[1].push(fund.inflationPerEpoch);
        localInflationLog  = fund.inflationLog;
        // RESET Inflation log for next draw
        fund.inflationLog[0] = [lastEpochToDrawFrom];
        fund.inflationLog[1] = [];
        fund.unclaimedInflationChangewithdrawal = 0;
        fund.lastDrawnEpoch = lastEpochToDrawFrom;
        funds[_pot] = fund;
        require(fundBalance >= withdrawalAmount, "Balance with fund not sufficient");
        require(LINProxy.approve(_pot, withdrawalAmount), "Fund not allocated to pot");
        fundBalance -= withdrawalAmount;
        emit FundDrawn(_pot, withdrawalAmount, fundBalance);
        return localInflationLog;
    }

    function handleInflationChange(address _pot, 
                                    uint _currentEpoch) 
                                    private 
                                    returns(uint fundToWithdrawBeforeInflationChange) {
        Fund memory fund = funds[_pot];
        uint fundToWithdraw = fund.inflationPerEpoch*(_currentEpoch - fund.lastDrawnEpoch);
        fund.inflationLog[0].push(_currentEpoch);
        fund.inflationLog[1].push(fund.inflationPerEpoch);
        fund.inflationPerEpoch = fund.nextInflation;
        fund.lastDrawnEpoch = _currentEpoch;
        fund.nextInflation = 0;
        fund.nextInflationUpdateEpoch = MAX_INT;
        funds[_pot] = fund;
        return fundToWithdraw;
    }
}