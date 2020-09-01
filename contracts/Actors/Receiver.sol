// SPDX-License-Identifier: <SPDX-License>
pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Token/TokenLogic.sol";
import "../Fund/Pot.sol";


contract Receiver is Initializable {
    using SafeMath for uint256;

    TokenLogic LINToken;
    Pot pot;
    address governanceEnforcerProxy;

    uint256 subscriptionFee;
    mapping(uint256 => mapping(address => uint256)) receivers;

    modifier onlyGovernanceEnforcer() {
        require(
            msg.sender == address(governanceEnforcerProxy),
            "ClusterRegistry: Function can only be invoked by Governance Enforcer"
        );
        _;
    }

    function initialize(
        address _LINAddress,
        address _potAddress,
        address _governanceEnforcerProxy
    ) public initializer {
        LINToken = TokenLogic(_LINAddress);
        pot = Pot(_potAddress);
        governanceEnforcerProxy = _governanceEnforcerProxy;
    }

    // Note: Both the startEpoch and  EndEpoch are included
    function subscribe(uint256 _startEpoch, uint256 _endEpoch) external {
        uint256 feeToPay = subscriptionFee.mul(
            _endEpoch.sub(_startEpoch).add(1)
        );
        require(_startEpoch <= _endEpoch, "Receiver: Invalid inputs");
        require(
            _startEpoch > pot.getEpoch(block.number),
            "Receiver: Can't subscribe to past or current epochs"
        );
        for (uint256 i = _startEpoch; i <= _endEpoch; i++) {
            require(
                receivers[i][msg.sender] > 0,
                "Receiver: Already subscribed to epoch"
            );
            receivers[i][msg.sender] = subscriptionFee;
        }
        require(
            LINToken.transferFrom(msg.sender, address(this), feeToPay),
            "Receiver: Fee not received"
        );
    }

    function unsubscribe(uint256[] calldata _epochs) external {
        uint256 currentEpoch = pot.getEpoch(block.number);
        uint256 amountToReturn = 0;
        for (uint256 i = 0; i < _epochs.length; i++) {
            require(
                _epochs[i] > currentEpoch,
                "Receiver: Can't unsubcribe to past or current epochs"
            );
            uint256 feePaid = receivers[i][msg.sender];
            require(
                feePaid > 0,
                "Receiver: Can't unsubscribe without first subscribing to the epochs"
            );
            amountToReturn += feePaid;
            delete receivers[i][msg.sender];
        }
        require(
            LINToken.transfer(msg.sender, amountToReturn),
            "Receiver: Couldn't return subscription fee"
        );
    }

    function isValidReceiver(address _receiver, uint256 _blockNo)
        public
        view
        returns (bool)
    {
        return (receivers[_blockNo][_receiver] > 0);
    }

    function changeSubscriptionFee(uint256 _updatedSubscriptionFee)
        external
        onlyGovernanceEnforcer
        returns (bool)
    {
        subscriptionFee = _updatedSubscriptionFee;
        return true;
    }
}
