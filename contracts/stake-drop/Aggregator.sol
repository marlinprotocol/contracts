pragma solidity 0.5.17;

import "./StakeRegistry.sol";
import "./AddressRegistry.sol";
import "./Distribution.sol";


contract Aggregator {
    using SafeMath for uint256;

    function getPending(
        address _stakeRegistry,
        address _addressRegistry,
        address _distribution
    ) public view returns (uint256) {
        AddressRegistry a = AddressRegistry(_addressRegistry);
        StakeRegistry s = StakeRegistry(_stakeRegistry);
        Distribution d = Distribution(_distribution);

        bytes32 stakingAddressHash = a.reverseMap(msg.sender);
        uint256 reward = s.rewardPerAddress(stakingAddressHash);
        uint256 balanceToTransfer = reward.sub(
            d.claimedBalances(stakingAddressHash)
        );
        return balanceToTransfer;
    }

    function getTotalPending(
        address[] memory _stakeRegistry,
        address[] memory _addressRegistry,
        address[] memory _distribution
    ) public view returns (uint256) {
        require(
            _stakeRegistry.length == _addressRegistry.length,
            "Arity Mismatch"
        );
        require(
            _distribution.length == _addressRegistry.length,
            "Arity Mismatch"
        );
        uint256 balanceToTransfer = 0;
        for (uint256 index = 0; index < _stakeRegistry.length; index++) {
            balanceToTransfer = balanceToTransfer.add(
                getPending(
                    _stakeRegistry[index],
                    _addressRegistry[index],
                    _distribution[index]
                )
            );
        }
        return balanceToTransfer;
    }
}
