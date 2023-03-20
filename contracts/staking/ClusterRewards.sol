// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./interfaces/IClusterSelector.sol";
import "./ReceiverStaking.sol";
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
        address[] memory _clusterSelectors,
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
            _networkIds.length == _clusterSelectors.length,
            "CRW:I-Each NetworkId need a corresponding clusterSelector and vice versa"
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
            require(_clusterSelectors[i] !=  address(0), "CRW:CN-ClusterSelector must exist");
            clusterSelectors[_networkIds[i]] = IClusterSelector(_clusterSelectors[i]);
            _weight += _rewardWeight[i];
            emit NetworkAdded(_networkIds[i], _rewardWeight[i], _clusterSelectors[i]);
        }
        totalRewardWeight = _weight;
        _changeRewardPerEpoch(_totalRewardsPerEpoch);
        payoutDenomination = 1e18;
    }

//-------------------------------- Initializer end --------------------------------//

//-------------------------------- Admin functions start --------------------------------//

    bytes32 public constant CLAIMER_ROLE = keccak256("CLAIMER_ROLE");
    bytes32 public constant FEEDER_ROLE = keccak256("FEEDER_ROLE");
    uint256 public constant RECEIVER_TICKETS_PER_EPOCH = 2**16;
    uint256 constant SWITCHING_PERIOD = 33 days;

    mapping(address => uint256) public clusterRewards;

    mapping(bytes32 => uint256) public rewardWeight;
    uint256 public totalRewardWeight;
    uint256 public totalRewardsPerEpoch;
    uint256 public payoutDenomination;

    mapping(uint256 => uint256) public rewardDistributedPerEpoch;
    uint256 public latestNewEpochRewardAt;
    uint256 public rewardDistributionWaitTime;

    mapping(address => mapping(uint256 => uint256)) public ticketsIssued;
    mapping(bytes32 => IClusterSelector) public clusterSelectors; // networkId -> clusterSelector
    ReceiverStaking public receiverStaking;

    event NetworkAdded(bytes32 networkId, uint256 rewardPerEpoch, address clusterSelector);
    event NetworkRemoved(bytes32 networkId);
    event NetworkUpdated(bytes32 networkId, uint256 updatedRewardPerEpoch, address clusterSelector);
    event ClusterRewarded(bytes32 networkId);
    event ReceiverStakingUpdated(address receiverStaking);
    event RewardPerEpochChanged(uint256 updatedRewardPerEpoch);
    event RewardDistributionWaitTimeChanged(uint256 updatedWaitTime);
    event TicketsIssued(bytes32 indexed networkId, uint256 indexed epoch, address indexed user);

    modifier onlyFeeder() {
        require(hasRole(FEEDER_ROLE, _msgSender()), "only feeder");
        _;
    }

    function addNetwork(bytes32 _networkId, uint256 _rewardWeight, address _clusterSelector) external onlyAdmin {
        require(rewardWeight[_networkId] == 0, "CRW:AN-Network already exists");
        require(_clusterSelector !=  address(0), "CRW:AN-ClusterSelector must exist");
        rewardWeight[_networkId] = _rewardWeight;
        IClusterSelector networkClusterSelector = IClusterSelector(_clusterSelector);
        require(networkClusterSelector.START_TIME() == receiverStaking.START_TIME(), "CRW:AN-start time inconsistent");
        require(networkClusterSelector.EPOCH_LENGTH() == receiverStaking.EPOCH_LENGTH(), "CRW:AN-epoch length inconsistent");

        clusterSelectors[_networkId] = networkClusterSelector;
        totalRewardWeight += _rewardWeight;
        emit NetworkAdded(_networkId, _rewardWeight, _clusterSelector);
    }

    function removeNetwork(bytes32 _networkId) external onlyAdmin {
        uint256 networkWeight = rewardWeight[_networkId];
        require(address(clusterSelectors[_networkId]) != address(0), "CRW:RN-Network doesnt exist");
        delete rewardWeight[_networkId];
        delete clusterSelectors[_networkId];
        totalRewardWeight -= networkWeight;
        emit NetworkRemoved(_networkId);
    }

    function updateNetwork(bytes32 _networkId, uint256 _updatedRewardWeight, address _updatedClusterSelector) external onlyAdmin {
        uint256 networkWeight = rewardWeight[_networkId];
        require(_updatedClusterSelector !=  address(0), "CRW:UN-ClusterSelector must exist");
        address currentClusterSelector = address(clusterSelectors[_networkId]);
        require(currentClusterSelector != address(0), "CRW:UN-Network doesnt exist");

        if(_updatedClusterSelector != currentClusterSelector) {
            IClusterSelector networkClusterSelector = IClusterSelector(_updatedClusterSelector);
            require(networkClusterSelector.START_TIME() == receiverStaking.START_TIME(), "CRW:UN-start time inconsistent");
            require(networkClusterSelector.EPOCH_LENGTH() == receiverStaking.EPOCH_LENGTH(), "CRW:UN-epoch length inconsistent");
            clusterSelectors[_networkId] = IClusterSelector(_updatedClusterSelector);
        }

        rewardWeight[_networkId] = _updatedRewardWeight;
        totalRewardWeight = totalRewardWeight - networkWeight + _updatedRewardWeight;
        emit NetworkUpdated(_networkId, _updatedRewardWeight, _updatedClusterSelector);
    }

    /// @dev any updates to startTime or epoch length in receiver staking must also be reflected in all clusterSelectors
    function updateReceiverStaking(address _receiverStaking) external onlyAdmin {
        _updateReceiverStaking(_receiverStaking);
    }

    function _updateReceiverStaking(address _receiverStaking) internal {
        receiverStaking = ReceiverStaking(_receiverStaking);
        emit ReceiverStakingUpdated(_receiverStaking);
    }

    function changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) external onlyAdmin {
        _changeRewardPerEpoch(_updatedRewardPerEpoch);
    }

    function _changeRewardPerEpoch(uint256 _updatedRewardPerEpoch) internal {
        totalRewardsPerEpoch = _updatedRewardPerEpoch;
        emit RewardPerEpochChanged(_updatedRewardPerEpoch);
    }

    function updateRewardWaitTime(uint256 _updatedWaitTime) external onlyAdmin {
        _updateRewardWaitTime(_updatedWaitTime);
    }

    function _updateRewardWaitTime(uint256 _updatedWaitTime) internal {
        rewardDistributionWaitTime = _updatedWaitTime;
        emit RewardDistributionWaitTimeChanged(_updatedWaitTime);
    }

//-------------------------------- Admin functions end --------------------------------//

//-------------------------------- User functions start --------------------------------//

    struct SignedTicket {
        uint16[] tickets;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function feed(
        bytes32 _networkId,
        address[] calldata _clusters,
        uint256[] calldata _payouts,
        uint256 _epoch
    ) external onlyFeeder {
        require(receiverStaking.START_TIME() + SWITCHING_PERIOD + 1 days > block.timestamp, "CRW:F-Invalid method");
        uint256 rewardDistributed = rewardDistributedPerEpoch[_epoch];
        if(rewardDistributed == 0) {
            require(
                block.timestamp > latestNewEpochRewardAt + rewardDistributionWaitTime,
                "CRW:F-Cant distribute reward for new epoch within such short interval"
            );
            latestNewEpochRewardAt = block.timestamp;
        }
        uint256 currentPayoutDenomination = payoutDenomination;
        uint256 networkRewardWeight = rewardWeight[_networkId];
        uint256 currentTotalRewardsPerEpoch = totalRewardsPerEpoch*1 days/receiverStaking.EPOCH_LENGTH()*networkRewardWeight/totalRewardWeight;
        for(uint256 i=0; i < _clusters.length; i++) {
            uint256 clusterReward = (currentTotalRewardsPerEpoch * _payouts[i]) / currentPayoutDenomination;
            rewardDistributed = rewardDistributed + clusterReward;
            clusterRewards[_clusters[i]] = clusterRewards[_clusters[i]] + clusterReward;
        }
        require(
            rewardDistributed <= currentTotalRewardsPerEpoch,
            "CRW:F-Reward Distributed  cant  be more  than totalRewardPerEpoch"
        );
        rewardDistributedPerEpoch[_epoch] = rewardDistributed;
        emit ClusterRewarded(_networkId);
    }

    // TODO: uint16 is necessary ?
    function _processReceiverTickets(address _signer, uint256 _epoch, address[] memory _selectedClusters, uint16[] memory _tickets, uint256 _totalNetworkRewardsPerEpoch, uint256 _epochTotalStake) internal {
        (uint256 _epochReceiverStake, address _receiver) = receiverStaking.balanceOfSignerAt(_signer, _epoch);
        require(!_isTicketsIssued(_receiver, _epoch), "CRW:IPRT-Tickets already issued");

        uint256 _rewardShare = _totalNetworkRewardsPerEpoch * _epochReceiverStake / _epochTotalStake;
        unchecked {
            uint256 _totalTickets;
            for(uint256 i=0; i < _tickets.length; ++i) {
                // cant overflow as max supply of POND is 1e28, so max value of multiplication is 1e28*2^16*1e28 < uint256
                // value that can be added  per iteration is < 1e28*2^16*1e28/1e18, so clusterRewards for cluster cant overflow
                clusterRewards[_selectedClusters[i]] += _rewardShare * uint256(_tickets[i]) / RECEIVER_TICKETS_PER_EPOCH;

                // cant overflow as tickets[i] <= 2^16
                _totalTickets += uint256(_tickets[i]);
            }
            require(_totalTickets == RECEIVER_TICKETS_PER_EPOCH, "CRW:IPRT-Total ticket count invalid");
        }

        _markAsIssued(_receiver, _epoch);
    }

    function _processReceiverTickets(address _signer, uint256 _epoch, address[] memory _selectedClusters, uint256[] memory _tickets, uint256 _totalNetworkRewardsPerEpoch, uint256 _epochTotalStake) internal {
        (uint256 _epochReceiverStake, address _receiver) = receiverStaking.balanceOfSignerAt(_signer, _epoch);
        require(!_isTicketsIssued(_receiver, _epoch), "CRW:IPRT-Tickets already issued");

        uint256 _rewardShare = _totalNetworkRewardsPerEpoch * _epochReceiverStake / _epochTotalStake;
        unchecked {
            uint256 _totalTickets;
            for(uint256 i=0; i < _tickets.length; ++i) {
                // cant overflow as max supply of POND is 1e28, so max value of multiplication is 1e28*2^16*1e28 < uint256
                // value that can be added  per iteration is < 1e28*2^16*1e28/1e18, so clusterRewards for cluster cant overflow
                clusterRewards[_selectedClusters[i]] += _rewardShare * _tickets[i] / RECEIVER_TICKETS_PER_EPOCH;

                // cant overflow as tickets[i] <= 2^16
                _totalTickets += _tickets[i];
            }
            require(_totalTickets == RECEIVER_TICKETS_PER_EPOCH, "CRW:IPRT-Total ticket count invalid");
        }

        _markAsIssued(_receiver, _epoch);
    }

    function _isTicketsIssued(address _receiver, uint256 _epoch) internal view returns(bool) {
        unchecked {
            uint256 _index = _epoch/256;
            uint256 _pos = _epoch%256;
            uint256 _issuedFlags = ticketsIssued[_receiver][_index];
            return (_issuedFlags & 2**(255-_pos)) != 0;
        }
    }

    function isTicketsIssued(address _receiver, uint256 _epoch) public view returns(bool) {
        return _isTicketsIssued(_receiver, _epoch);
    }

    function _markAsIssued(address _receiver, uint256 _epoch) internal {
        unchecked {
            uint256 _index = _epoch/256;
            uint256 _pos = _epoch%256;
            uint256 _issuedFlags = ticketsIssued[_receiver][_index];
            ticketsIssued[_receiver][_index] = _issuedFlags | 2**(255-_pos);
        }
    }

    function _verifySignedTicket(SignedTicket memory _signedTicket, bytes32 _networkId, uint256 _epoch) internal pure returns(address _signer) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, keccak256(abi.encode(_networkId, _epoch,_signedTicket.tickets))));
        _signer = ecrecover(prefixedHashMessage, _signedTicket.v, _signedTicket.r, _signedTicket.s);
        require(_signer != address(0), "CRW:IVST-Invalid signature");
    }

    function issueTickets(bytes32 _networkId, uint24[] memory _epochs, uint16[][] memory _tickets) external {
        uint256 numberOfEpochs = _epochs.length;
        require(numberOfEpochs == _tickets.length, "CRW:MIT-invalid inputs");
        unchecked {
            for(uint256 i=0; i < numberOfEpochs; ++i) {
                issueTickets(_networkId, _epochs[i], _tickets[i]);
            }
        }
    }

    function issueTickets(bytes32 _networkId, uint24 _fromEpoch, uint24 _toEpoch, uint16[][] memory _tickets) external {
        require(_fromEpoch <= _toEpoch, "CRW:MOIT-invalid inputs");
        unchecked {
            // underflow is checked above and overflow can only happen if _toEpoch is max(uint24) and _fromEpoch is 0
            // in that case numberOfEpochs will be 0, which won't issue any tickets, so no side effects because of unchecked
            uint24 numberOfEpochs = _toEpoch - _fromEpoch + 1;
            require(numberOfEpochs == _tickets.length, "CRW:MOIT-invalid inputs");
            for(uint24 i=0; i < numberOfEpochs; ++i) {
                // won't overflow as max value of `_fromEpoch + i` is _toEpoch
                issueTickets(_networkId, _fromEpoch + i, _tickets[i]);
            }
        }
    }

    function issueTickets(bytes memory _ticketInfo) external {
        unchecked {
            (
                bytes32 _networkId, 
                uint256 _fromEpoch, 
                uint256 _noOfEpochs,
                uint256[][] memory _tickets
            ) = _parseTicketInfo(_ticketInfo);

            uint256 _totalNetworkRewardsPerEpoch = getRewardPerEpoch(_networkId);

            for(uint256 i=0; i < _noOfEpochs; ++i) {
                uint256 _epoch = _fromEpoch + i;
                (uint256 _epochTotalStake, uint256 _currentEpoch) = receiverStaking.getEpochInfo(_epoch);

                require(_epoch < _currentEpoch, "CRW:IT-Epoch not completed");

                address[] memory _selectedClusters = clusterSelectors[_networkId].getClusters(_epoch);

                _processReceiverTickets(msg.sender, _epoch, _selectedClusters, _tickets[i], _totalNetworkRewardsPerEpoch, _epochTotalStake);

                emit TicketsIssued(_networkId, _epoch, msg.sender);
            }
        }
    }

    function _parseTicketInfo(bytes memory ticketInfo) internal view returns(
        bytes32 networkId, 
        uint256 fromEpoch, 
        uint256 noOfEpochs,
        uint256[][] memory tickets
    ) {
        // Ticket Structure
        // |--NetworkId(256 bits)--|--FromEpoch(32 bits)--|--N*Ticket(16 bits)--|

        uint256 length;
        bytes32 currentWord;
        assembly {
            length :=  mload(ticketInfo)
            networkId := mload(add(ticketInfo, 0x20))
            currentWord := mload(add(ticketInfo, 0x40))
        }
        fromEpoch = uint256(currentWord >> 224);
        unchecked {
            require(length >= 36 && (length - 36)%8 == 0, "CR:IPTI-invalid ticket info encoding");
            // +1 because of slight overflow on last word
            uint256 noOfWords = length/32;
            noOfEpochs = (length - 36)/8; // 32 (networkId) + 4 (fromEpoch) / 2(tickets) / 4(tickets per epoch)
            tickets = new uint256[][](noOfEpochs);
            uint256 clustersToSelect = clusterSelectors[networkId].NUMBER_OF_CLUSTERS_TO_SELECT();
            tickets[0] = new uint256[](clustersToSelect);
            (uint256 _currentEpochIndex, uint256 _currentTicketIndex, uint256 _totalTicketsInEpoch) = _extractTickets(currentWord, 2, 0, 0, 0, tickets);
            
            for(uint256 i=1; i < noOfWords; ++i) {
                assembly {
                    currentWord := mload(add(ticketInfo, add(0x40, mul(0x20, i))))
                }
                (_currentEpochIndex, _currentTicketIndex, _totalTicketsInEpoch) = _extractTickets(currentWord, 0, _currentEpochIndex, _currentTicketIndex, _totalTicketsInEpoch, tickets);
            }
        }
    }

    function _extractTickets(
        bytes32 word, 
        uint256 startIndex, 
        uint256 currentEpochIndex, 
        uint256 currentTicketIndex, 
        uint256 totalTicketsInEpoch,
        uint256[][] memory tickets
    ) internal pure returns(uint256, uint256, uint256) {
        unchecked {
            for(uint256 i = startIndex; i < 16; ++i) {
                uint256 ticket = _extractTicket(word, i);
                totalTicketsInEpoch += ticket;
                tickets[currentEpochIndex][currentTicketIndex] = ticket;
                currentTicketIndex++;

                if(currentTicketIndex > tickets[currentEpochIndex].length - 2) {
                    require(RECEIVER_TICKETS_PER_EPOCH >= totalTicketsInEpoch, "CR:IET-Invalid tickets");
                    tickets[currentEpochIndex][tickets[currentEpochIndex].length - 1] = RECEIVER_TICKETS_PER_EPOCH - totalTicketsInEpoch;
                    if(currentEpochIndex == tickets.length - 1) return (currentEpochIndex, currentTicketIndex, RECEIVER_TICKETS_PER_EPOCH);
                    currentEpochIndex++;
                    tickets[currentEpochIndex] = new uint256[](tickets[currentEpochIndex-1].length);
                    currentTicketIndex = 0;
                    totalTicketsInEpoch = 0;
                }
            }
        }
        return (currentEpochIndex, currentTicketIndex, totalTicketsInEpoch);
    }

    function _extractTicket(bytes32 word, uint256 index) internal pure returns(uint256) {
        assert(index < 16);
        unchecked {
            return uint16(uint256(word >> (256 - (index + 1)*16)));   
        }
    }

    function issueTickets(bytes32 _networkId, uint24 _epoch, SignedTicket[] memory _signedTickets) external {
        (uint256 _epochTotalStake, uint256 _currentEpoch) = receiverStaking.getEpochInfo(_epoch);

        require(_epoch < _currentEpoch, "CRW:SIT-Epoch not completed");

        address[] memory _selectedClusters = clusterSelectors[_networkId].getClusters(_epoch);
        uint256 _totalNetworkRewardsPerEpoch = getRewardPerEpoch(_networkId);

        for(uint256 i=0; i < _signedTickets.length; i++) {
            address _signer = _verifySignedTicket(_signedTickets[i], _networkId, _epoch);
            _processReceiverTickets(
                _signer,
                _epoch,
                _selectedClusters,
                _signedTickets[i].tickets,
                _totalNetworkRewardsPerEpoch,
                _epochTotalStake
            );
            emit TicketsIssued(_networkId, _epoch, _signer);
        }
    }

    function issueTickets(bytes32 _networkId, uint24 _epoch, uint16[] memory _tickets) public {
        (uint256 _epochTotalStake, uint256 _currentEpoch) = receiverStaking.getEpochInfo(_epoch);

        require(_epoch < _currentEpoch, "CRW:IT-Epoch not completed");

        address[] memory _selectedClusters = clusterSelectors[_networkId].getClusters(_epoch);

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
        if(block.timestamp < receiverStaking.START_TIME() + SWITCHING_PERIOD) return 0;
        return (totalRewardsPerEpoch * rewardWeight[_networkId]) / totalRewardWeight;
    }

//-------------------------------- User functions end --------------------------------//
}
