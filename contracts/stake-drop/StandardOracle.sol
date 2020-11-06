pragma solidity 0.5.17;


contract StandardOracle {
    mapping(address => bool) public sources;
    uint256 public numberOfSources;

    constructor() public {
        sources[msg.sender] = true;
        numberOfSources++;
    }

    function addSource(address _address)
        public
        onlySource
        isNotContract(_address)
        returns (bool)
    {
        require(!sources[msg.sender], "Should not be an existing source");
        sources[_address] = true;
        numberOfSources++;
        return true;
    }

    function renounceSource() public onlySource returns (bool) {
        require(
            numberOfSources != 1,
            "Cannot renounce source if the number of sources is only one"
        );
        sources[msg.sender] = false;
        numberOfSources--;
        return true;
    }

    function isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size != 0;
    }

    modifier onlySource() {
        require(sources[msg.sender], "Only source can add another source");
        _;
    }

    modifier isNotContract(address _address) {
        require(!isContract(_address), "Should not be a contract source");
        _;
    }
}
