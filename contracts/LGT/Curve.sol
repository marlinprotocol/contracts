pragma solidity >=0.4.21 <0.7.0;


contract Curve {
    // y=41.13 * 10^-54 * (x-10^27)^2 + 85.7

    function multiply(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) {
            return 0;
        }
        uint256 c = a * b;
        require(c / a == b, "Multiply overflow check");
        return c;
    }

    function divide(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "Divide by zero");
        uint256 c = a / b;
        return c;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "Addition Overflow check");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "Subtraction overflow check");
        uint256 c = a - b;

        return c;
    }

    function curve(uint256 x, uint256 amount) public pure returns (uint256 y) {
        require(
            x >= 10**27,
            "Tokens should be more than or equal to 1 billion"
        );
        uint256 _temp = add(x, amount);
        _temp = sub(_temp, 10**27);
        _temp = multiply(_temp, _temp);
        _temp = multiply(_temp, 4113 * (10**10));
        _temp = divide(_temp, 10**54);
        _temp = add(_temp, 8570 * (10**10));
        _temp = multiply(_temp, amount);
        y = divide(_temp, 10**12);
    }
}
