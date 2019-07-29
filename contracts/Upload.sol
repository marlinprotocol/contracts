pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
@title Publisher-side upload offers
@author Marlin Labs
@notice Publishers can create new offers for storing and delivering content
*/
contract Upload {

    using SafeMath for uint256;

    event NewPublisherOffer(bytes32 id);

    /**
    @notice Struct for Publisher Offer
    @param publisher Address of the publisher
    @param namespace Namespace of the website/project
    @param archiveUrl URL of the file archive
    @param storageReward Reward (LIN) for storing this content
    @param deliveryReward Reward (LIN) for delivering/serving this content
    @param validTill UTC timestamp till which this offer is valid
    @param expiry UTC timestamp at which offer auto-expires if no master nodes join
    @param replication Replication factor of the content
    @param requiredStake Stake (LIN) required to store/deliver this content
    @param nodes Addresses of the master nodes that have joined this offer
    @param activeNodes Mapping of whether an address has joined this offer or not
    */
    struct PublisherOffer {
        address publisher;
        string namespace;
        string archiveUrl;
        uint256 storageReward;
        uint256 deliveryReward;
        uint256 validTill;
        uint256 expiry;
        uint256 replication;
        uint256 requiredStake;
        address[] nodes;
        mapping(address => bool) activeNodes;
    }

    mapping(bytes32 => PublisherOffer) offers;
    mapping(address => bytes32[]) offersByPublisher;
    mapping(address => uint256) refunds;
    address MARLIN_TOKEN_ADDRESS;

    /**
    @notice Constructor that saves the address of the Marlin token contract
    @param _tokenContractAddress Address of Marlin token contract
    */
    constructor(address _tokenContractAddress) public {
        MARLIN_TOKEN_ADDRESS = _tokenContractAddress;
    }

    /**
    @notice Function to create a new publisher-side offer
    @dev This may also be called to renew a offer whose validity was over
    @param _namespace Namespace of the website/project
    @param _archiveUrl URL of the file archive
    @param _storageReward Reward (LIN) for storing this content
    @param _deliveryReward Reward (LIN) for delivering/serving this content
    @param _duration Duration of the offer after which its validity ends (seconds)
    @param _expiry UTC timestamp at which offer auto-expires if no master nodes join
    @param _replication Replication factor of the content
    @param _requiredStake Stake (LIN) required to store/deliver this content
    */
    function addPublisherOffer(
        string _namespace,
        string _archiveUrl,
        uint256 _storageReward,
        uint256 _deliveryReward,
        uint256 _duration,
        uint256 _expiry,
        uint256 _replication,
        uint256 _requiredStake
    )
        public
    {
        bytes32 _id = keccak256(abi.encodePacked(_namespace, _archiveUrl));
        require(isUnique(_id));
        require(now < _expiry);
        require(_requiredStake > 0);
        if (offers[_id].nodes.length > 0) {
            require(msg.sender == offers[_id].publisher);
            refundPublisherOffer(_id);
        }
        addToList(msg.sender, _id);
        offers[_id].publisher = msg.sender;
        offers[_id].namespace = _namespace;
        offers[_id].archiveUrl = _archiveUrl;
        offers[_id].storageReward = _storageReward;
        offers[_id].deliveryReward = _deliveryReward;
        offers[_id].validTill = now.add(_duration);
        offers[_id].expiry = _expiry;
        offers[_id].replication = _replication;
        offers[_id].requiredStake = _requiredStake;
        emit NewPublisherOffer(_id);
    }

    /**
    @notice Function to be called by publisher to scale out/in replication factor
    @dev Can scale in only upto the already joined number of master nodes
    @param _id keccak256(_namespace, _archiveUrl) is the ID of the offer
    @param _replication Replication factor of the content
    @return {
      "_success": "Boolean, true if updated successfully"
    }
    */
    function scalePublisherOffer(
        bytes32 _id,
        uint256 _replication
    )
        public
        returns (bool _success)
    {
        require(msg.sender == offers[_id].publisher);

        require(offers[_id].nodes.length <= _replication);
        offers[_id].replication = _replication;

        _success = true;
    }

    /**
    @notice Function to join a offer and deliver/serve content
    @dev Offer can only be joined till the replication is not satisfied
         msg.sender must approve this contract to transferFrom LIN tokens on their behalf
    @param _id keccak256(_namespace, _archiveUrl) is the ID of the offer
    @return {
      "_success": "Boolean, true if joined the offer successfully"
    }
    */
    function servePublisherOffer(bytes32 _id)
        public
        returns (bool _success)
    {
        // make sure upload contract is valid
        require(offers[_id].validTill > now);
        require(offers[_id].expiry > now);

        // make sure it is a new node
        require(offers[_id].activeNodes[msg.sender] == false);

        // make sure upload contract has slots remaining, if yes, add new node
        require(offers[_id].nodes.length < offers[_id].replication);
        offers[_id].activeNodes[msg.sender] = true;
        offers[_id].nodes.push(msg.sender);

        // make sure transfer of tokens is possible
        require(ERC20(MARLIN_TOKEN_ADDRESS).transferFrom(
            msg.sender,
            address(this),
            offers[_id].requiredStake
        ));

        _success = true;
    }

    /**
    @notice Leave the offer after its validity is over
    @dev This also means the staked LIN tokens will be transferred back
    @param _id keccak256(_namespace, _archiveUrl) is the ID of the offer
    @return {
      "_success": "Boolean, true if withdrawn successfully"
    }
    */
    function withdrawStake(bytes32 _id)
        public
        returns (bool _success)
    {
        // make sure upload contract is not valid anymore
        require(now > offers[_id].validTill);

        // make sure this node was serving
        require(offers[_id].activeNodes[msg.sender] == true);
        removeNode(_id, msg.sender);
        offers[_id].activeNodes[msg.sender] = false;

        // withdraw tokens
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, offers[_id].requiredStake));

        _success = true;
    }

    /**
    @notice Function to withdraw refundable LIN tokens from this contract
    @dev Tokens are refunded if the publisher renews their offer beyond the initial offer validity
    */
    function withdrawRefund()
        public
    {
        uint256 _refund = refunds[msg.sender];
        require(_refund > 0);
        refunds[msg.sender] = 0;
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, _refund));
    }

    /**
    @notice Function to read publisher-side offer details
    @param _id keccak256(_namespace, _archiveUrl) is the ID of the offer
    @return {
      "_publisher": "Address of the publisher, who created this offer",
      "_namespace": "Namespace of the website/project",
      "_archiveUrl": "URL of the file archive",
      "_storageReward": "Reward (LIN) for storing this content",
      "_deliveryReward": "Reward (LIN) for delivering/serving this content",
      "_validTill": "UTC timestamp at which offer's validity is over",
      "_expiry": "UTC timestamp at which offer auto-expires if no master nodes join",
      "_replication": "Replication factor of the content",
      "_requiredStake": "Stake (LIN) required to store/deliver this content"
    }
    */
    function readPublisherOffer(bytes32 _id)
        public
        constant
        returns (
            address _publisher,
            string _namespace,
            string _archiveUrl,
            uint256 _storageReward,
            uint256 _deliveryReward,
            uint256 _validTill,
            uint256 _expiry,
            uint256 _replication,
            uint256 _requiredStake
        )
    {
        _publisher = offers[_id].publisher;
        _namespace = offers[_id].namespace;
        _archiveUrl = offers[_id].archiveUrl;
        _storageReward = offers[_id].storageReward;
        _deliveryReward = offers[_id].deliveryReward;
        _validTill = offers[_id].validTill;
        _expiry = offers[_id].expiry;
        _replication = offers[_id].replication;
        _requiredStake = offers[_id].requiredStake;
    }

    /**
    @notice Function to read the offers owned by a publisher
    @param _publisher Address of the publisher
    @return {
      "_ids": "Array of bytes (IDs) of offers"
    }
    */
    function readOffersByPublisher(address _publisher)
        public
        constant
        returns (bytes32[] _ids)
    {
        _ids = offersByPublisher[_publisher];
    }

    /**
    @notice Function to read the refund value of a master node
    @param _node Address of the master node
    @return {
      "_value": "Refund value of the master node"
    }
    */
    function readRefund(address _node)
        public
        constant
        returns (uint256 _value)
    {
        _value = refunds[_node];
    }

    /**
    @notice Function to read the stake of a master node for specific offer
    @param _id keccak256(_namespace, _archiveUrl) is the ID of the offer
    @param _node Address of the master node
    @return {
      "_value": "LIN tokens staked by the master node for this offer"
    }
    */
    function readStake(bytes32 _id, address _node)
        public
        constant
        returns (uint256 _value)
    {
        if (offers[_id].activeNodes[_node] == true) {
            _value = offers[_id].requiredStake;
        }
    }

    function addToList(address _publisher, bytes32 _id)
        internal
    {
        if (!isInList(offersByPublisher[_publisher], _id)) {
            offersByPublisher[_publisher].push(_id);
        }
    }

    function isInList(bytes32[] _list, bytes32 _item)
        internal
        pure
        returns (bool _success)
    {
        uint256 _length = _list.length;
        for (uint256 _i = 0; _i < _length; _i++) {
            if (_item == _list[_i]) {
                _success = true;
                break;
            }
        }
    }

    function refundPublisherOffer(bytes32 _id)
        internal
    {
        // make sure upload contract is not valid anymore
        require(now > offers[_id].validTill);

        address[] memory _nodes = offers[_id].nodes;
        for (uint256 i = _nodes.length; i > 0; i--) {
            address _node = _nodes[i];
            refunds[_node] = refunds[_node].add(offers[_id].requiredStake);
            removeNode(_id, _node);
            offers[_id].activeNodes[_node] = false;
        }
    }

    function removeNode(bytes32 _id, address _node)
        internal
        constant
    {
        address[] memory _nodes = offers[_id].nodes;
        for (uint256 i = _nodes.length; i > 0; i--) {
            if (_nodes[i] == _node) {
                delete _nodes[i];
                break;
            }
        }
    }

    function isUnique(bytes32 _id)
        internal
        constant
        returns (bool _is)
    {
        if (
            (now > offers[_id].expiry) ||
            (offers[_id].expiry == 0) ||
            (now > offers[_id].validTill)
        ) {
            return true;
        }
        return false;
    }
}
