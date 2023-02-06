// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/IEpochSelector.sol";
import "./interfaces/IReceiverStaking.sol";
import "./interfaces/IClusterRewards.sol";

contract ClusterRewards is
    Initializable,  // initializer
    ContextUpgradeable,  // _msgSender, _msgData
    ERC165Upgradeable,  // supportsInterface
    AccessControlUpgradeable,  // RBAC
    AccessControlEnumerableUpgradeable,  // RBAC enumeration
    ERC1967UpgradeUpgradeable,  // delegate slots, proxy admin, private upgrade
    UUPSUpgradeable,  // public upgrade
    IClusterRewards  // interface
{
    // in case we add more contracts in the inheritance chain
    uint256[500] private __gap0;

    /// @custom:oz-upgrades-unsafe-allow constructor
    // initializes the logic contract without any admins
    // safeguard against takeover of the logic contract
    constructor() initializer {}

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "only admin");
        _;
    }

//-------------------------------- Overrides start --------------------------------//

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165Upgradeable, AccessControlUpgradeable, AccessControlEnumerableUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _grantRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account) internal virtual override(AccessControlUpgradeable, AccessControlEnumerableUpgradeable) {
        super._revokeRole(role, account);

        // protect against accidentally removing all admins
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) != 0, "Cannot be adminless");
    }

    function _authorizeUpgrade(address /*account*/) onlyAdmin internal view override {}

//-------------------------------- Overrides end --------------------------------//

//-------------------------------- Initializer start --------------------------------//

    uint256[50] private __gap1;

    function initialize(
        address _admin,
        address _claimer,
        address _receiverStaking,
        bytes32[] memory _networkIds,
        uint256[] memory _rewardWeight,
        address[] memory _epochSelectors,
        uint256 _totalRewardsPerEpoch
    )
        public
        initializer
    {
        require(
            _networkIds.length == _rewardWeight.length,
            "CRW:I-Each NetworkId need a corresponding RewardPerEpoch and vice versa"
        );
        require(
            _networkIds.length == _epochSelectors.length,
            "CRW:I-Each NetworkId need a corresponding epochSelector and vice versa"
        );

        __Context_init_unchained();
        __ERC165_init_unchained();
        __AccessControl_init_unchained();
        __AccessControlEnumerable_init_unchained();
        __ERC1967Upgrade_init_unchained();
        __UUPSUpgradeable_init_unchained();

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);

        _setupRole(CLAIMER_ROLE, _claimer);

        _updateReceiverStaking(_receiverStaking);

        uint256 _weight = 0;
        for(uint256 i=0; i < _networkIds.length; i++) {
            rewardWeight[_networkIds[i]] = _rewardWeight[i];
            require(_epochSelectors[i] !=  address(0), "CRW:CN-EpochSelector must exist");
            epochSelectors[_networkIds[i]] = IEpochSelector(_epochSelectors[i]);
            _weight += _rewardWeight[i];
            emit NetworkAdded(_networkIds[i], _rewardWeight[i], _epochSelectors[i]);
        }
        totalRewardWeight = _weight;
        _changeRewardPerEpoch(_totalRewardsPerEpoch);
    }

//-------------------------------- Initializer end --------------------------------//

//-------------------------------- Admin functions start --------------------------------//

    bytes32 public constant CLAIMER_ROLE = keccak256("CLAIMER_ROLE");
    uint256 public constant RECEIVER_TICKETS_PER_EPOCH = 1e18;

    mapping(address => uint256) public clusterRewards;

    mapping(bytes32 => uint256) public rewardWeight;
    uint256 public totalRewardWeight;
    uint256 public totalRewardsPerEpoch;
    uint256 public __unused_1;

    mapping(uint256 => uint256) public __unused_2;
    uint256 public __unused_3;
    uint256 public __unused_4;

    mapping(address => mapping(uint256 => uint256)) public ticketsIssued;
    mapping(bytes32 => IEpochSelector) public epochSelectors; // networkId -> epochSelector
    IReceiverStaking public receiverStaking;

    event NetworkAdded(bytes32 networkId, uint256 rewardPerEpoch, address epochSelector);
    event NetworkRemoved(bytes32 networkId);
    event NetworkUpdated(bytes32 networkId, uint256 updatedRewardPerEpoch, address epochSelector);
    event ReceiverStakingUpdated(address receiverStaking);
    event RewardPerEpochChanged(uint256 updatedRewardPerEpoch);
    event TicketsIssued(bytes32 indexed networkId, uint256 indexed epoch, address indexed user);

    modifier onlyClaimer() {
        require(hasRole(CLAIMER_ROLE, _msgSender()), "only claimer");
        _;
    }

    function addNetwork(bytes32 _networkId, uint256 _rewardWeight, address _epochSelector) external onlyAdmin {
        require(rewardWeight[_networkId] == 0, "CRW:AN-Network already exists");
        require(_epochSelector !=  address(0), "CRW:AN-EpochSelector must exist");
        rewardWeight[_networkId] = _rewardWeight;
        IEpochSelector networkEpochSelector = IEpochSelector(_epochSelector);
        require(networkEpochSelector.START_TIME() == receiverStaking.START_TIME(), "CRW:AN-start time inconsistent");
        require(networkEpochSelector.EPOCH_LENGTH() == receiverStaking.EPOCH_LENGTH(), "CRW:AN-epoch length inconsistent");
        
        epochSelectors[_networkId] = networkEpochSelector;
        totalRewardWeight += _rewardWeight;
        emit NetworkAdded(_networkId, _rewardWeight, _epochSelector);
    }

    function removeNetwork(bytes32 _networkId) external onlyAdmin {
        uint256 networkWeight = rewardWeight[_networkId];
        require(address(epochSelectors[_networkId]) != address(0), "CRW:RN-Network doesnt exist");
        delete rewardWeight[_networkId];
        delete epochSelectors[_networkId];
        totalRewardWeight -= networkWeight;
        emit NetworkRemoved(_networkId);
    }

    function updateNetwork(bytes32 _networkId, uint256 _updatedRewardWeight, address _updatedEpochSelector) external onlyAdmin {
        uint256 networkWeight = rewardWeight[_networkId];
        require(_updatedEpochSelector !=  address(0), "CRW:UN-EpochSelector must exist");
        address currentEpochSelector = address(epochSelectors[_networkId]);
        require(currentEpochSelector != address(0), "CRW:UN-Network doesnt exist");

        if(_updatedEpochSelector != currentEpochSelector) {
            IEpochSelector networkEpochSelector = IEpochSelector(_updatedEpochSelector);
            require(networkEpochSelector.START_TIME() == receiverStaking.START_TIME(), "CRW:UN-start time inconsistent");
            require(networkEpochSelector.EPOCH_LENGTH() == receiverStaking.EPOCH_LENGTH(), "CRW:UN-epoch length inconsistent");
            epochSelectors[_networkId] = IEpochSelector(_updatedEpochSelector);
        }

        rewardWeight[_networkId] = _updatedRewardWeight;
        totalRewardWeight = totalRewardWeight - networkWeight + _updatedRewardWeight;
        emit NetworkUpdated(_networkId, _updatedRewardWeight, _updatedEpochSelector);
    }

    /// @dev any updates to startTime or epoch length in receiver staking must also be reflected in all epochSelectors
    function updateReceiverStaking(address _receiverStaking) external onlyAdmin {
        _updateReceiverStaking(_receiverStaking);
    }

    function _updateReceiverStaking(address _receiverStaking) internal {
        receiverStaking = IReceiverStaking(_receiverStaking);
        emit ReceiverStakingUpdated(_receiverStaking);
    }

    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) external onlyAdmin {
        _changeRewardPerEpoch(_updatedRewardPerEpoch);
    }

    function _changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) internal {
        totalRewardsPerEpoch = _updatedRewardPerEpoch;
        emit RewardPerEpochChanged(_updatedRewardPerEpoch);
    }

//-------------------------------- Admin functions end --------------------------------//

//-------------------------------- User functions start --------------------------------//

    struct SignedTicket {
        uint256[] tickets;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function issueTickets(bytes32 _networkId, uint256 _epoch, SignedTicket[] memory _signedTickets) external {
        (uint256 _epochTotalStake, uint256 _currentEpoch) = receiverStaking.getEpochInfo(_epoch);

        require(_epoch < _currentEpoch, "CRW:SIT-Epoch not completed");

        address[] memory _selectedClusters = epochSelectors[_networkId].getClusters(_epoch);
        uint256 _totalNetworkRewardsPerEpoch = getRewardPerEpoch(_networkId);

        require(_totalNetworkRewardsPerEpoch != 0, "no rewards");
        require(_signedTickets.length > 0);

        for(uint256 i=0; i < _signedTickets.length; i++) {
            address _receiver = _verifySignedTicket(_signedTickets[i]);
            _processReceiverTickets(
                _receiver, 
                _epoch, 
                _selectedClusters, 
                _signedTickets[i].tickets,
                _totalNetworkRewardsPerEpoch, 
                _epochTotalStake
            );
        }
    }

    function _processReceiverTickets(address _receiver, uint256 _epoch, address[] memory _selectedClusters, uint256[] memory _tickets, uint256 _totalNetworkRewardsPerEpoch, uint256 _epochTotalStake) internal {
        uint256 _epochTicketsIssued = ticketsIssued[_receiver][_epoch];
        uint256 _epochReceiverStake = receiverStaking.balanceOfSignerAt(_receiver, _epoch);

        require(_tickets.length > 0);

        unchecked {
            for(uint256 i=0; i < _tickets.length; ++i) {
                require(_tickets[i] <= RECEIVER_TICKETS_PER_EPOCH, "CRW:IPRT-Invalid ticket count");
                require(_tickets[i] != 0);
                require(_epochReceiverStake != 0, "no stake for receiver");
                require(_selectedClusters[i] !=  address(0), "CRW:IPRT-Invalid cluster");

                // cant overflow as max supply of POND is 1e28, so max value of multiplication is 1e28*1e18*1e28 < uint256
                // value that can be added  per iteration is < 1e28*1e18*1e28/1e18, so clusterRewards for cluster cant overflow
                clusterRewards[_selectedClusters[i]] += _totalNetworkRewardsPerEpoch * _tickets[i] * _epochReceiverStake / _epochTotalStake / RECEIVER_TICKETS_PER_EPOCH;
                // cant overflow as tickets <= 1e18
                _epochTicketsIssued += _tickets[i];
            }
        }

        require(_epochTicketsIssued <= RECEIVER_TICKETS_PER_EPOCH, "CRW:IPRT-Excessive tickets issued");
        ticketsIssued[_receiver][_epoch] = _epochTicketsIssued;
    }

    function _verifySignedTicket(SignedTicket memory _signedTicket) internal pure returns(address _receiver) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, keccak256(abi.encode(_signedTicket.tickets))));
        _receiver = ecrecover(prefixedHashMessage, _signedTicket.v, _signedTicket.r, _signedTicket.s);
        require(_receiver != address(0), "CRW:IVST-Invalid signature");
    }

    function issueTickets(bytes32 _networkId, uint256[] memory _epoch, uint256[][] memory _tickets) external {
        uint256 numberOfEpochs = _epoch.length;
        require(numberOfEpochs == _tickets.length, "CRW:MIT-invalid inputs");
        for(uint256 i=0; i < numberOfEpochs; i++) {
            issueTickets(_networkId, _epoch[i], _tickets[i]);
        }
    }

    function issueTickets(bytes32 _networkId, uint256 _epoch, uint256[] memory _tickets) public {
        (uint256 _epochTotalStake, uint256 _currentEpoch) = receiverStaking.getEpochInfo(_epoch);

        require(_epoch < _currentEpoch, "CRW:IT-Epoch not completed");
        // require(_epochReceiverStake != 0, "CRW:IT-Not eligible to issue tickets");

        address[] memory _selectedClusters = epochSelectors[_networkId].getClusters(_epoch);

        uint256 _totalNetworkRewardsPerEpoch = getRewardPerEpoch(_networkId);

        _processReceiverTickets(msg.sender, _epoch, _selectedClusters, _tickets, _totalNetworkRewardsPerEpoch, _epochTotalStake);

        emit TicketsIssued(_networkId, _epoch, msg.sender);
    }

    function claimReward(address _cluster) external onlyRole(CLAIMER_ROLE) returns(uint256) {
        uint256 pendingRewards = clusterRewards[_cluster];
        if(pendingRewards > 1) {
            uint256 rewardsToTransfer = pendingRewards - 1;
            clusterRewards[_cluster] = 1;
            return rewardsToTransfer;
        }
        return 0;
    }

    function getRewardPerEpoch(bytes32 _networkId) public view returns(uint256) {
        return (totalRewardsPerEpoch * rewardWeight[_networkId]) / totalRewardWeight;
    }

//-------------------------------- User functions end --------------------------------//

    /// @notice Checks if the array has an element in it
    /// @param array Array to check
    /// @param element Element to check in the array
    function ifArrayHasElement(address[] memory array, address element) internal pure returns (bool) {
        for (uint256 index = 0; index < array.length; index++) {
            if (element == array[index]) {
                return true;
            }
        }
        return false;
    }
}
