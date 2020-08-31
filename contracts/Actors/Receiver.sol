// SPDX-License-Identifier: <SPDX-License>
pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Token/TokenLogic.sol";
import "../Fund/Pot.sol";


contract Receiver is Initializable {
    using SafeMath for uint256;

    TokenLogic LINToken;
    Pot pot;
    uint subscriptionFee;
    mapping(uint => mapping(address => uint)) receivers;

    function initialize(address _LINAddress, address _potAddress) public initializer {
        LINToken = TokenLogic(_LINAddress);
        pot = Pot(_potAddress);
    }

    // Note: Both the startEpoch and  EndEpoch are included
    function subscribe(uint _startEpoch, uint _endEpoch) external {
        uint feeToPay = subscriptionFee.mul(_endEpoch.sub(_startEpoch).add(1));
        require(_startEpoch <= _endEpoch, "Receiver: Invalid inputs");
        require(_startEpoch > pot.getEpoch(block.number), "Receiver: Can't subscribe to past or current epochs");
        for(uint i=_startEpoch; i <= _endEpoch; i++) {
            require(receivers[i][msg.sender] > 0, "Receiver: Already subscribed to epoch");
            receivers[i][msg.sender] = subscriptionFee;
        }
        require(LINToken.transferFrom(msg.sender, address(this), feeToPay), "Receiver: Fee not received");
    }

    function unsubscribe(uint[] calldata _epochs) external {
        uint currentEpoch = pot.getEpoch(block.number);
        uint amountToReturn = 0;
        for(uint i=0; i < _epochs.length; i++) {
            require(_epochs[i] > currentEpoch, "Receiver: Can't unsubcribe to past or current epochs");
            uint feePaid = receivers[i][msg.sender];
            require(feePaid > 0, "Receiver: Can't unsubscribe without first subscribing to the epochs");
            amountToReturn += feePaid;
            delete receivers[i][msg.sender];
        }
        require(LINToken.transfer(msg.sender, amountToReturn), "Receiver: Couldn't return subscription fee");
    }

    function isValidReceiver(address _receiver, uint _blockNo) public view returns (bool) {
        return (receivers[_blockNo][_receiver] > 0);
    }
}
