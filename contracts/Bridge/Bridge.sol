pragma solidity >=0.4.21 <0.7.0;
pragma experimental ABIEncoderV2;

import "../Token/TokenLogic.sol";
import "../governance/Comp.sol";


contract Bridge {
    using SafeMath for uint256;

    Comp public mpond;
    TokenLogic public pond;
    address owner;
    address governanceProxy;

    uint256 pondPerMpond = 1000000;
    uint256 lockTime = 1 days;

    struct Claim {
        bytes32 claimId;
        uint256 amount;
        bool isClaimed;
        uint256 time;
    }

    mapping(address => mapping(uint256 => Claim)) claims;
    mapping(address => uint256) claimCount;

    constructor(
        address _mpond,
        address _pond,
        address _owner
    ) public {
        mpond = Comp(_mpond);
        pond = TokenLogic(_pond);
        owner = _owner;
        governanceProxy = governanceProxy;
    }

    function changeConversion(uint256 _newConversion) external returns (bool) {
        require(
            msg.sender == governanceProxy || msg.sender == owner,
            "changeConversion: should be called by owner or governanceProxy"
        );
        pondPerMpond = _newConversion;
        return true;
    }

    function changeLockTime(uint256 _newLockTime) external returns (bool) {
        require(
            msg.sender == governanceProxy || msg.sender == owner,
            "changeLockTime: should be called by owner or governanceProxy"
        );
        lockTime = _newLockTime;
        return true;
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

    function getPond(uint256 _pond) public returns (bytes32, uint256) {
        require(
            _pond >= pondPerMpond,
            "getPond: can only claim pond more than threshold"
        );
        uint256 count = claimCount[msg.sender];
        bytes32 id = keccak256(abi.encodePacked(msg.sender, count + 1, _pond));
        uint256 mpondToSend = _pond.div(pondPerMpond);
        mpond.transferFrom(msg.sender, address(this), mpondToSend);
        Claim memory _claim = Claim(id, _pond, false, now);
        claims[msg.sender][count + 1] = _claim;
        // claims[msg.sender][count + 1].claimId = id;
        // claims[msg.sender][count + 1].amount = _pond;
        // claims[msg.sender][count + 1].time = block.timestamp;
        claimCount[msg.sender] = count + 1;
        return (id, count + 1);
    }

    function getPondWithClaimNumber(uint256 _claimNumber)
        public
        returns (bool)
    {
        Claim memory _claim = claims[msg.sender][_claimNumber];
        require(
            now >= _claim.time + lockTime,
            "getPond: can be only after locktime is complete"
        );
        require(
            _claim.isClaimed != true,
            "getPond: claim shoudn't be already claimed"
        );
        require(_claim.amount != 0, "getMpond: claim amount should not be 0");
        uint256 pondToSend = _claim.amount;
        pond.transfer(msg.sender, pondToSend);
        claims[msg.sender][_claimNumber].isClaimed = true;
        return true;
    }

    function getClaim(address _address, uint256 _claimNumber)
        public
        view
        returns (Claim memory)
    {
        return claims[_address][_claimNumber];
    }
}
