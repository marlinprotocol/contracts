pragma solidity >=0.4.21 <0.7.0;


contract Logic2 {
    uint256 public x;
    bool private initialized;

    function initialize(uint256 _x) public {
        require(!initialized, "Does the work of constructor");
        initialized = true;
        x = _x;
    }

    function get() public view returns (uint256) {
        return 2 * x;
    }
}
