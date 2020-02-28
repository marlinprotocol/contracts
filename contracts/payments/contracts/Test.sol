pragma solidity ^0.5.0;

contract Test {
    string greeting = "Hello";
    
    function getGreeting() public view returns(string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }
}