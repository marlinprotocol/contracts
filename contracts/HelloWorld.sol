pragma solidity 0.6.1;

contract HelloWorld {
    string public message;

    event LogMessageChanged(
        string oldMessage,
        string newMessage,
        uint256 timestamp
    );

    constructor() public {
        message = "Hello, World !!!";
    }

    /**
    * Function to change the message
    * @param _newMessage {string} The new message
     */
    function changeMessage(string memory _newMessage, uint256 _timestamp)
        public
    {
        string memory oldMessage = message;
        message = _newMessage;
        emit LogMessageChanged(oldMessage, _newMessage, _timestamp);
    }
}
