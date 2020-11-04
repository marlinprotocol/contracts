pragma solidity 0.5.17;


contract StandardOracle {
    mapping(address => bool) public sources;

    constructor() public {
        sources[msg.sender] = true;
    }

    function addSource(address _address)
        public
        onlySource
        isNotContract(_address)
        returns (bool)
    {
        sources[_address] = true;
        return true;
    }

    function renounceSource() public onlySource returns (bool) {
        sources[msg.sender] = false;
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
