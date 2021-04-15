pragma solidity 0.5.17;


contract StandardOracle {
    mapping(address => bool) public sources;
    uint256 public numberOfSources;

    constructor() public {
        sources[msg.sender] = true;
        numberOfSources++;
    }

    function addSource(address _address) public onlySource {
        require(!sources[_address], "Should not be an existing source");
        sources[_address] = true;
        numberOfSources++;
    }

    function renounceSource() public onlySource {
        require(
            numberOfSources != 1,
            "Cannot renounce source if the number of sources is only one"
        );
        sources[msg.sender] = false;
        numberOfSources--;
    }

    modifier onlySource() {
        require(sources[msg.sender], "Only source can add another source");
        _;
    }
}
