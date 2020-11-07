pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../Token/TokenLogic.sol";
import "../governance/mPondLogic.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";


contract BridgeLogic is Initializable {
    using SafeMath for uint256;

    uint256 public constant pondPerMpond = 1000000;
    uint256 public constant epochLength = 1 days;
    uint256 public constant lockTimeEpochs = 180;
    uint256 public constant liquidityDecimals = 4;
    uint256 public constant liquidityEpochLength = 180 days;
    uint256 public constant liquidityStartEpoch = 1;

    uint256 public liquidityBp;

    mPondLogic public mpond;
    TokenLogic public pond;
    address public owner;
    address public governanceProxy;
    uint256 public startTime;
    uint256 public liquidityStartTime;

    struct Requests {
        uint256 amount;
        uint256 releaseEpoch;
    }

    mapping(address => mapping(uint256 => Requests)) public requests; //address->epoch->Request(amount, lockTime)
    mapping(address => mapping(uint256 => uint256)) public claimedAmounts; //address->epoch->amount

    function initialize(
        address _mpond,
        address _pond,
        address _owner,
        address _governanceProxy
    ) public initializer {
        mpond = mPondLogic(_mpond);
        pond = TokenLogic(_pond);
        owner = _owner;
        governanceProxy = _governanceProxy;
        startTime = block.timestamp;
        liquidityStartTime = block.timestamp;
        liquidityBp = 20;
    }

    function changeLiquidityBp(uint256 _newLbp) external {
        require(
            msg.sender == owner || msg.sender == governanceProxy,
            "Liquidity can be only changed by governance or owner"
        );
        liquidityBp = _newLbp;
    }

    function getCurrentEpoch() internal view returns (uint256) {
        return (block.timestamp - startTime) / (epochLength);
    }

    function getLiquidityEpoch() public view returns (uint256) {
        if (block.timestamp < liquidityStartTime + 180 days) {
            return 0;
        }
        return
            (block.timestamp - liquidityStartTime - 180 days) /
            (liquidityEpochLength) +
            liquidityStartEpoch;
    }

    function effectiveLiquidity() public view returns (uint256) {
        uint256 effective = getLiquidityEpoch().mul(liquidityBp);
        if (effective > 10000) {
            return 10000;
        }
        return effective;
    }

    function getConvertableAmount(address _address, uint256 _epoch)
        public
        view
        returns (uint256)
    {
        uint256 _reqAmount = requests[_address][_epoch].amount;
        uint256 _claimedAmount = claimedAmounts[_address][_epoch];
        if (_claimedAmount >= _reqAmount.mul(effectiveLiquidity()) / (10000)) {
            return 0;
        }
        return
            (_reqAmount.mul(effectiveLiquidity()) / (10000)).sub(
                _claimedAmount
            );
    }

    function convert(uint256 _epoch, uint256 _amount) public returns (uint256) {
        require(_amount != 0, "Should be non zero amount");
        uint256 _claimedAmount = claimedAmounts[msg.sender][_epoch];
        uint256 totalUnlockableAmount = _claimedAmount.add(_amount);
        Requests memory _req = requests[msg.sender][_epoch];

        // replace div with actual divide
        require(
            totalUnlockableAmount <=
                _req.amount.mul(effectiveLiquidity()) / (10000),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        );
        require(
            getCurrentEpoch() >= _req.releaseEpoch,
            "Funds can only be released after requests exceed locktime"
        );
        claimedAmounts[msg.sender][_epoch] = totalUnlockableAmount;

        mpond.transferFrom(msg.sender, address(this), _amount);
        // pond.tranfer(msg.sender, _amount.mul(pondPerMpond));
        SafeERC20.safeTransfer(pond, msg.sender, _amount.mul(pondPerMpond));
        return _amount.mul(pondPerMpond);
    }

    function placeRequest(uint256 amount) external returns (uint256, uint256) {
        uint256 epoch = getCurrentEpoch();
        require(
            amount != 0 && amount <= mpond.balanceOf(msg.sender),
            "Request should be placed with amount greater than 0 and less than the balance of the user"
        );
        require(
            requests[msg.sender][epoch].amount == 0,
            "Only one request per epoch is acceptable"
        );
        Requests memory _req = Requests(amount, epoch.add(lockTimeEpochs));
        requests[msg.sender][epoch] = _req;
        return (epoch, _req.releaseEpoch);
    }

    function addLiquidity(uint256 _mpond, uint256 _pond)
        external
        onlyOwner("addLiquidity: only owner can call this function")
        returns (bool)
    {
        mpond.transferFrom(msg.sender, address(this), _mpond);
        // pond.transferFrom(msg.sender, address(this), _pond);
        SafeERC20.safeTransferFrom(pond, msg.sender, address(this), _pond);
        return true;
    }

    function removeLiquidity(
        uint256 _mpond,
        uint256 _pond,
        address _withdrawAddress
    )
        external
        onlyOwner("removeLiquidity: only owner can call this function")
        returns (bool)
    {
        mpond.transfer(_withdrawAddress, _mpond);
        // pond.transfer(_withdrawAddress, _pond);
        SafeERC20.safeTransfer(pond, _withdrawAddress, _pond);
        return true;
    }

    function getLiquidity() public view returns (uint256, uint256) {
        return (pond.balanceOf(address(this)), mpond.balanceOf(address(this)));
    }

    function getMpond(uint256 _mpond) public returns (uint256) {
        uint256 pondToDeduct = mpond.balanceOf(msg.sender).mul(pondPerMpond);
        // pond.transferFrom(msg.sender, address(this), pondToDeduct);
        SafeERC20.safeTransferFrom(
            pond,
            msg.sender,
            address(this),
            pondToDeduct
        );
        mpond.transfer(msg.sender, _mpond);
        return pondToDeduct;
    }

    modifier onlyOwner(string memory _error) {
        require(msg.sender == owner, _error);
        _;
    }
}
