pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./Pond.sol";
import "./MPond.sol";

// convertMultipleEpochs()
contract Bridge is
    Initializable, // initializer
    ContextUpgradeable,
    ERC165Upgradeable, // supportsInterface
    AccessControlUpgradeable,
    AccessControlEnumerableUpgradeable,
    UUPSUpgradeable
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()));
        _;
    }
    modifier onlyGovernance() {
        require(hasRole(GOVERNANCE_ROLE, _msgSender()));
        _;
    }

//-------------------------------- Overrides start --------------------------------//
    function supportsInterface(bytes4 interfaceId) public view virtual override( ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool){
        return super.supportsInterface(interfaceId);
    }

    function _grantRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable){
        super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable){
        super._revokeRole(role, account);
    }

    function _authorizeUpgrade(address /*account*/) internal view override onlyAdmin {}

//-------------------------------- Overrides ends --------------------------------//

//-------------------------------- Initializer start --------------------------------//
    
    uint256[50] private __gap1;

    function initialize(
        address _mpond,
        address _pond,
        address _governanceProxy
    ) public initializer {
        mpond = MPond(_mpond);
        pond = Pond(_pond);
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GOVERNANCE_ROLE, _governanceProxy);

        startTime = block.timestamp;
        liquidityStartTime = block.timestamp;
        liquidityBp = 1000;
        lockTimeEpochs = 180;
        liquidityEpochLength = 180 days;
    }

//-------------------------------- Initializer end --------------------------------//
    
    uint256 public constant pondPerMpond = 1000000;
    uint256 public constant epochLength = 1 days;
    uint256 public constant liquidityStartEpoch = 1;
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 public liquidityBp;
    uint256 public lockTimeEpochs;
    uint256 public liquidityEpochLength;

    MPond public mpond;
    Pond public pond;
    address public governanceProxy;
    uint256 public startTime;
    uint256 public liquidityStartTime;

    struct Requests {
        uint256 amount;
        uint256 releaseEpoch;
    }

    event PlacedRequest(
        address indexed sender,
        uint256 requestCreateEpoch,
        uint256 unlockRequestEpoch
    );
    event MPondToPond(
        address indexed sender,
        uint256 indexed requestCreateEpoch,
        uint256 PondReceived
    );
    event PondToMPond(address indexed sender, uint256 MpondReceived);

    mapping(address => mapping(uint256 => Requests)) public requests; //address->epoch->Request(amount, lockTime)
    mapping(address => mapping(uint256 => uint256)) public claimedAmounts; //address->epoch->amount
    mapping(address => uint256) public totalAmountPlacedInRequests; //address -> amount

    address public stakingContract;


    function changeStakingContract(address _newAddr) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(GOVERNANCE_ROLE, msg.sender),
            "Liquidity can be  changed by governance or owner"
        );
        stakingContract = _newAddr;
    }

    function changeLiquidityBp(uint256 _newLbp) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(GOVERNANCE_ROLE, msg.sender),
            "Liquidity can be only changed by governance or owner"
        );
        liquidityBp = _newLbp;
    }

    // input should be number of days
    function changeLockTimeEpochs(uint256 _newLockTimeEpochs) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(GOVERNANCE_ROLE, msg.sender),
            "LockTime can be only changed by goveranance or owner"
        );
        lockTimeEpochs = _newLockTimeEpochs;
    }

    // input should be number of days
    function changeLiquidityEpochLength(uint256 _newLiquidityEpochLength)
        external
    {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(GOVERNANCE_ROLE, msg.sender),
            "LiquidityEpoch length can only be changed by governance or owner"
        );
        liquidityEpochLength = _newLiquidityEpochLength * 1 days;
    }

    function getCurrentEpoch() internal view returns (uint256) {
        return (block.timestamp - startTime) / (epochLength);
    }

    function getLiquidityEpoch(uint256 _startTime)
        public
        view
        returns (uint256)
    {
        if (block.timestamp < _startTime) {
            return 0;
        }
        return
            (block.timestamp - _startTime) /
            (liquidityEpochLength) +
            liquidityStartEpoch;
    }

    function effectiveLiquidity(uint256 _startTime)
        public
        view
        returns (uint256)
    {
        uint256 effective = getLiquidityEpoch(_startTime) * liquidityBp;
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
        uint256 _reqReleaseTime = (requests[_address][_epoch].releaseEpoch *
            epochLength) + liquidityStartTime;
        uint256 _claimedAmount = claimedAmounts[_address][_epoch];
        if (
            _claimedAmount >=
            (_reqAmount * effectiveLiquidity(_reqReleaseTime)) / (10000)
        ) {
            return 0;
        }
        return
            ((_reqAmount * effectiveLiquidity(_reqReleaseTime)) / (10000)) -
            _claimedAmount;
    }

    function convert(uint256 _epoch, uint256 _amount) public returns (uint256) {
        require(_amount != 0, "Should be non zero amount");
        uint256 _claimedAmount = claimedAmounts[msg.sender][_epoch];
        uint256 totalUnlockableAmount = _claimedAmount + _amount;
        Requests memory _req = requests[msg.sender][_epoch];
        uint256 _reqReleaseTime = (_req.releaseEpoch * epochLength) + liquidityStartTime;

        // replace div with actual divide
        require(
            totalUnlockableAmount <=
                (_req.amount * effectiveLiquidity(_reqReleaseTime)) / (10000),
            "total unlock amount should be less than or equal to requests_amount*effective_liquidity."
        );
        require(
            getCurrentEpoch() >= _req.releaseEpoch,
            "Funds can only be released after requests exceed locktime"
        );
        claimedAmounts[msg.sender][_epoch] = totalUnlockableAmount;

        mpond.transferFrom(msg.sender, address(this), _amount);
        // pond.tranfer(msg.sender, _amount.mul(pondPerMpond));
        SafeERC20Upgradeable.safeTransfer(
            pond,
            msg.sender,
            _amount * pondPerMpond
        );
        uint256 amountLockedInRequests = totalAmountPlacedInRequests[
            msg.sender
        ];
        totalAmountPlacedInRequests[msg.sender] =
            amountLockedInRequests -
            _amount;
        emit MPondToPond(msg.sender, _epoch, _amount * pondPerMpond);
        return _amount * pondPerMpond;
    }

    function placeRequest(uint256 amount) external returns (uint256, uint256) {
        uint256 epoch = getCurrentEpoch();
        uint256 amountInRequests = totalAmountPlacedInRequests[msg.sender];
        uint256 amountOnWhichRequestCanBePlaced = mpond.balanceOf(msg.sender) +
            mpond.getDelegates(stakingContract, msg.sender) -
            amountInRequests;
        require(
            amount != 0 && amount <= amountOnWhichRequestCanBePlaced,
            "Request should be placed with amount greater than 0 and less than remainingAmount"
        );
        // require(
        //     amount != 0 && amount <= mpond.balanceOf(msg.sender),
        //     "Request should be placed with amount greater than 0 and less than the balance of the user"
        // );
        require(
            requests[msg.sender][epoch].amount == 0,
            "Only one request per epoch is acceptable"
        );
        Requests memory _req = Requests(amount, epoch + lockTimeEpochs);
        requests[msg.sender][epoch] = _req;
        totalAmountPlacedInRequests[msg.sender] = amountInRequests + amount;
        emit PlacedRequest(msg.sender, epoch, _req.releaseEpoch);
        return (epoch, _req.releaseEpoch);
    }

    function addLiquidity(uint256 _mpond, uint256 _pond)
        external
        onlyAdmin
        returns (bool)
    {
        mpond.transferFrom(msg.sender, address(this), _mpond);
        // pond.transferFrom(msg.sender, address(this), _pond);
        SafeERC20Upgradeable.safeTransferFrom(
            pond,
            msg.sender,
            address(this),
            _pond
        );
        return true;
    }

    function removeLiquidity(
        uint256 _mpond,
        uint256 _pond,
        address _withdrawAddress
    ) external onlyAdmin returns (bool) {
        mpond.transfer(_withdrawAddress, _mpond);
        // pond.transfer(_withdrawAddress, _pond);
        SafeERC20Upgradeable.safeTransfer(pond, _withdrawAddress, _pond);
        return true;
    }

    function getLiquidity() public view returns (uint256, uint256) {
        return (pond.balanceOf(address(this)), mpond.balanceOf(address(this)));
    }

    function getMpond(uint256 _mpond) public returns (uint256) {
        uint256 pondToDeduct = _mpond * pondPerMpond;
        // pond.transferFrom(msg.sender, address(this), pondToDeduct);
        SafeERC20Upgradeable.safeTransferFrom(
            pond,
            msg.sender,
            address(this),
            pondToDeduct
        );
        mpond.transfer(msg.sender, _mpond);
        emit PondToMPond(msg.sender, _mpond);
        return pondToDeduct;
    }

    function transferOwner(address newOwner) public onlyAdmin {
        require(
            newOwner != address(0),
            "BridgeLogic: newOwner is the zero address"
        );

        _revokeRole(DEFAULT_ADMIN_ROLE, getRoleMember(DEFAULT_ADMIN_ROLE, 0));
        _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
    }

    function renounceOwnership() public onlyAdmin {
        _revokeRole(DEFAULT_ADMIN_ROLE, getRoleMember(DEFAULT_ADMIN_ROLE, 0));
    }

    function transferGovernance(address newGoverance) public onlyGovernance {
        require(
            newGoverance != address(0),
            "BridgeLogic: newGovernance is the zero address"
        );
        _revokeRole(GOVERNANCE_ROLE, getRoleMember(GOVERNANCE_ROLE, 0));
        _grantRole(GOVERNANCE_ROLE, newGoverance);
    }
}
