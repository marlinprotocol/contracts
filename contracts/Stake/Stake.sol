pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "../governance/Comp.sol";


contract StakeManager {
    using SafeMath for uint256;

    struct Stake {
        address delegator;
        uint256 amount;
        uint256 delegatedStake;
    }

    enum TokenType {POND, MPOND}

    mapping(uint256 => address) tokenAddresses;

    mapping(address => mapping(uint256 => mapping(uint256 => Stake))) stakingData;

    function depositStake(
        uint256 _role,
        TokenType _tokenType,
        uint256 _amount,
        address _delegator
    ) public {
        Stake memory senderStake = stakingData[msg.sender][_role][uint256(
            _tokenType
        )];
        require(
            senderStake.delegator == address(0) ||
                senderStake.delegator == _delegator
        );
        senderStake.amount = senderStake.amount.add(_amount);
        senderStake.delegatedStake = senderStake.delegatedStake.add(_amount);
        stakingData[_delegator][_role][uint256(_tokenType)] = senderStake;
        require(
            ERC20(tokenAddresses[uint256(_tokenType)]).transferFrom(
                msg.sender,
                address(this),
                _amount
            )
        );
        if (_tokenType == TokenType.MPOND) {
            // send a request to delegate governance rights for the amount to delegator
            Comp(tokenAddresses[uint256(_tokenType)]).delegate(
                _delegator,
                _amount
            );
        }
    }

    function redelegateStake(
        uint256 _role,
        TokenType _tokenType,
        address _delegator
    ) public {
        Stake memory senderCurrentStakeData = stakingData[msg
            .sender][_role][uint256(_tokenType)];
        if (_delegator != senderCurrentStakeData.delegator) {
            stakingData[senderCurrentStakeData.delegator][_role][uint256(
                _tokenType
            )]
                .delegatedStake = stakingData[senderCurrentStakeData
                .delegator][_role][uint256(_tokenType)]
                .delegatedStake
                .sub(senderCurrentStakeData.amount);
            stakingData[_delegator][_role][uint256(_tokenType)]
                .delegatedStake = stakingData[_delegator][_role][uint256(
                _tokenType
            )]
                .delegatedStake
                .add(senderCurrentStakeData.amount);
            stakingData[msg.sender][_role][uint256(_tokenType)]
                .delegator = _delegator;

            if (_tokenType == TokenType.MPOND) {
                // send a request to undelegate governacne rights for the amount to previous delegator
                Comp(tokenAddresses[uint256(_tokenType)]).unDelegate(
                    senderCurrentStakeData.delegator,
                    _amount
                );
                // send a request to delegate governacne rights for the amount to next delegator
                Comp(tokenAddresses[uint256(_tokenType)]).delegate(
                    _delegator,
                    _amount
                );
            }
        }
    }

    function withdrawStake(
        address _staker,
        uint256 _role,
        TokenType _tokenType,
        uint256 _amount
    ) public onlyRoleStakingContracts {
        Stake memory senderStake = stakingData[_staker][_role][uint256(
            _tokenType
        )];
        require(senderStake.amount >= _amount);
        stakingData[_staker][_role].amount = stakingData[_staker][_role]
            .amount
            .sub(_amount);
        require(
            ERC20(tokenAddresses[uint256[_tokenType]]).transfer(
                _staker,
                _amount
            )
        );
    }

    function getDelegatedStake(uint256 _role, address _user)
        public
        view
        returns (uint256[2] memory)
    {
        return [
            stakingData[_user][_role][uint256(TokenType.POND)].delegatedStake,
            stakingData[_user][_role][uint256(TokenType.MPOND)].delegatedStake
        ];
    }

    function getDelegatedStake(
        uint256 _role,
        TokenType _tokenType,
        address _user
    ) public view returns (uint256) {
        return stakingData[_user][_role][uint256(_tokenType)].delegatedStake;
    }

    modifier onlyRoleStakingContracts {
        // prateek to fill
        _;
    }
}
