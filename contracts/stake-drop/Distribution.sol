pragma solidity 0.5.17;

import "./AddressRegistry.sol";
import "./StakeRegistry.sol";
import "./ValidatorRegistry.sol";
import "../governance/MPondLogic.sol";


contract Distribution {
    using SafeMath for uint256;
    address public admin;
    ValidatorRegistry public validatorRegistry;
    StakeRegistry public stakeRegistry;
    AddressRegistry public addressRegistry;
    MPondLogic public mpond;

    mapping(bytes32 => uint256) public claimedBalances;

    constructor(
        address _validatorRegistry,
        address _stakeRegistry,
        address _addressRegistry,
        address _tokenAddress
    ) public {
        admin = msg.sender;
        validatorRegistry = ValidatorRegistry(_validatorRegistry);
        stakeRegistry = StakeRegistry(_stakeRegistry);
        addressRegistry = AddressRegistry(_addressRegistry);
        mpond = MPondLogic(_tokenAddress);
    }

    function addTokens(uint256 _amount) public returns (bool) {
        mpond.transferFrom(msg.sender, address(this), _amount);
        return true;
    }

    function removeTokens(uint256 _amount) public returns (bool) {
        require(msg.sender == admin, "Only owner can remove tokens");
        mpond.transfer(msg.sender, _amount);
        return true;
    }

    function changeTokenAddress(address _newTokenAddress)
        public
        returns (bool)
    {
        require(msg.sender == admin, "Only owner can change token address");
        mpond = MPondLogic(_newTokenAddress);
        return true;
    }

    function getUnclaimedAmount() public view returns (uint256) {
        bytes32 stakingAddressHash = addressRegistry.reverseMap(msg.sender);
        uint256 reward = stakeRegistry.rewardPerAddress(stakingAddressHash);
        uint256 balanceToTransfer = reward.sub(
            claimedBalances[stakingAddressHash]
        );
        return balanceToTransfer;
    }

    function claimAmount() public returns (bool) {
        uint256 balanceToTransfer = getUnclaimedAmount();
        require(balanceToTransfer != 0, "Withdrawl balance should be non-zero");
        bytes32 stakingAddressHash = addressRegistry.reverseMap(msg.sender);
        claimedBalances[stakingAddressHash] = claimedBalances[stakingAddressHash]
            .add(balanceToTransfer);
        mpond.transfer(msg.sender, balanceToTransfer);
        return true;
    }
}
