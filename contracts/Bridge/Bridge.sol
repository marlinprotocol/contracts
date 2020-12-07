pragma solidity >=0.4.21 <0.7.0;
pragma experimental ABIEncoderV2;

import "../Token/TokenLogic.sol";
import "../governance/MPond.sol";


contract Bridge {
    using SafeMath for uint256;

    MPond public mpond;
    TokenLogic public pond;
    address owner;
    address governanceProxy;

    uint256 pondPerMpond = 1000000;
    uint256 epochLength = 1 days;
    uint256 startEpoch = 0;
    uint256 startTime;

    uint256 lockTime = 180 days;

    uint256 liquidityBp = 20;
    uint256 liquidityDecimals = 4; // 0.0002 (i.e) 0.2%
    uint256 liquidityEpochLength = 10 days; // liquidty will increase arithmatically after locktime
    uint256 liquidityStartTime;
    uint256 liquidityStartEpoch = 1; //after locktime liquidity counter start from 1

    struct Requests {
        uint256 amount;
        uint256 releaseEpoch;
    }
    mapping(address => mapping(uint256 => Requests)) requests; //address->epoch->Request(amount, lockTime)
    mapping(address => mapping(uint256 => uint256)) claimedAmounts; //address->epoch->amount

    constructor(
        address _mpond,
        address _pond,
        address _owner,
        address _governanceProxy
    ) public {
        mpond = MPond(_mpond);
        pond = TokenLogic(_pond);
        owner = _owner;
        governanceProxy = _governanceProxy;
        startTime = block.timestamp;
        liquidityStartTime = block.timestamp;
    }

    function changeLiquidityBp(uint256 _newLbp) external returns (bool) {
        require(
            msg.sender == owner || msg.sender == governanceProxy,
            "Liquidity can be only changed by governance or owner"
        );
        liquidityBp = _newLbp;
        return true;
    }

    function getCurrentEpoch() internal view returns (uint256) {
        return (block.timestamp - startTime).div(epochLength) + startEpoch;
    }

    function lockTimeEpoch(uint256 _time) internal view returns (uint256) {
        return _time.div(epochLength);
    }

    function getLiquidityEpoch() public view returns (uint256) {
        if (block.timestamp < liquidityStartTime + 180 days) {
            return 0;
        }
        return
            (block.timestamp - liquidityStartTime - 180 days).div(
                liquidityEpochLength
            ) + liquidityStartEpoch;
    }

    function effectiveLiquidity() public view returns (uint256) {
        uint256 effective = getLiquidityEpoch().mul(liquidityBp);
        if (effective > 10000) {
            return 10000;
        } else {
            return effective;
        }
    }

    function getConvertableAmount(address _address, uint256 _epoch)
        public
        view
        returns (uint256)
    {
        Requests memory _req = requests[_address][_epoch];
        uint256 _claimedAmount = claimedAmounts[_address][_epoch];
        if (
            _claimedAmount >= _req.amount.mul(effectiveLiquidity()).div(10000)
        ) {
            return 0;
        } else {
            return
                (_req.amount.mul(effectiveLiquidity()).div(10000)).sub(
                    _claimedAmount
                );
        }
    }

    function getClaimedAmount(address _address, uint256 _epoch)
        public
        view
        returns (uint256)
    {
        return claimedAmounts[_address][_epoch];
    }

    function convert(uint256 _epoch, uint256 _amount) public returns (uint256) {
        require(_amount > 0, "Should be non zero amount");
        uint256 _claimedAmount = claimedAmounts[msg.sender][_epoch];
        uint256 totalUnlockableAmount = _claimedAmount + _amount;
        Requests memory _req = requests[msg.sender][_epoch];
        require(
            totalUnlockableAmount <=
                _req.amount.mul(effectiveLiquidity()).div(10000),
            "total unlock amount should be less than requests_amount*effective_liquidity"
        );
        require(
            getCurrentEpoch() > _req.releaseEpoch,
            "Funds can only be released after requests exceed locktime"
        );
        claimedAmounts[msg.sender][_epoch] = totalUnlockableAmount;
        mpond.transferFrom(msg.sender, address(this), _amount);
        pond.transfer(msg.sender, _amount.mul(pondPerMpond));
        return _amount.mul(pondPerMpond);
    }

    function placeRequest(uint256 amount) external returns (uint256, uint256) {
        uint256 epoch = getCurrentEpoch();
        require(amount != 0, "Request should be placed with non zero amount");
        require(
            requests[msg.sender][epoch].amount == 0,
            "Only one request per epoch is acceptable"
        );
        require(
            mpond.balanceOf(msg.sender) > 0,
            "mPond balance should be greated than 0 for placing requests"
        );
        require(
            amount <= mpond.balanceOf(msg.sender),
            "request should be placed with amount less than or equal to balance"
        );
        Requests memory _req = Requests(
            amount,
            epoch + lockTimeEpoch(lockTime)
        );
        requests[msg.sender][epoch] = _req;
        return (epoch, epoch + lockTimeEpoch(lockTime));
    }

    function viewRequest(address _address, uint256 _epoch)
        public
        view
        returns (Requests memory)
    {
        return requests[_address][_epoch];
    }

    function addLiquidity(uint256 _mpond, uint256 _pond)
        external
        returns (bool)
    {
        require(
            msg.sender == owner,
            "addLiquidity: only owner can call this function"
        );
        mpond.transferFrom(msg.sender, address(this), _mpond);
        pond.transferFrom(msg.sender, address(this), _pond);
        return true;
    }

    function removeLiquidity(
        uint256 _mpond,
        uint256 _pond,
        address _withdrawAddress
    ) external returns (bool) {
        require(
            msg.sender == owner,
            "removeLiquidity: only owner can call this function"
        );
        mpond.transfer(_withdrawAddress, _mpond);
        pond.transfer(_withdrawAddress, _pond);
        return true;
    }

    function getLiquidity() public view returns (uint256, uint256) {
        return (pond.balanceOf(address(this)), mpond.balanceOf(address(this)));
    }

    function getMpond(uint256 _mpond) public returns (uint256) {
        uint256 pondToDeduct = mpond.balanceOf(msg.sender).mul(pondPerMpond);
        pond.transferFrom(msg.sender, address(this), pondToDeduct);
        mpond.transfer(msg.sender, _mpond);
        return pondToDeduct;
    }
}
