pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Publisher-side upload clauses
 * @author Marlin Labs
 * @notice Publishers can create new clauses for storing and delivering content
 */
contract Upload {

    using SafeMath for uint256;

    event PublisherContract(string namespace, string fileArchiveUrl);

    /**
     * @notice Struct for Publisher Clause
     * @param publisher Address of the publisher
     * @param namespace Namespace of the website/project
     * @param archiveUrl URL of the file archive
     * @param storageReward Reward (LIN) for storing this content
     * @param deliveryReward Reward (LIN) for delivering/serving this content
     * @param validTill UTC timestamp till which this clause is valid
     * @param expiry UTC timestamp at which clause auto-expires if no master nodes join
     * @param replication Replication factor of the content
     * @param requiredStake Stake (LIN) required to store/deliver this content
     * @param nodes Addresses of the master nodes that have joined this clause
     * @param activeNodes Mapping of whether an address has joined this clause or not
     */
    struct PublisherClause {
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

    mapping(bytes32 => PublisherClause) clauses;
    mapping(address => uint256) refunds;
    address MARLIN_TOKEN_ADDRESS;

    /**
     * @notice Constructor that saves the address of the Marlin token contract
     * @param _tokenContractAddress Address of Marlin token contract
     */
    constructor(address _tokenContractAddress) public {
        MARLIN_TOKEN_ADDRESS = _tokenContractAddress;
    }

    /**
     * @notice Function to create a new publisher-side clause
     * @dev This may also be called to renew a clause whose validity was over
     * @param _namespace Namespace of the website/project
     * @param _archiveUrl URL of the file archive
     * @param _storageReward Reward (LIN) for storing this content
     * @param _deliveryReward Reward (LIN) for delivering/serving this content
     * @param _duration Duration of the clause after which its validity ends (seconds)
     * @param _expiry UTC timestamp at which clause auto-expires if no master nodes join
     * @param _replication Replication factor of the content
     * @param _requiredStake Stake (LIN) required to store/deliver this content
     */
    function addPublisherClause(
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
        if (clauses[_id].nodes.length > 0) {
            require(msg.sender == clauses[_id].publisher);
            refundPublisherClause(_id);
        }
        clauses[_id].publisher = msg.sender;
        clauses[_id].namespace = _namespace;
        clauses[_id].archiveUrl = _archiveUrl;
        clauses[_id].storageReward = _storageReward;
        clauses[_id].deliveryReward = _deliveryReward;
        clauses[_id].validTill = now.add(_duration);
        clauses[_id].expiry = _expiry;
        clauses[_id].replication = _replication;
        clauses[_id].requiredStake = _requiredStake;
        emit PublisherContract(_namespace, _archiveUrl);
    }

    /**
     * @notice Function to be called by publisher to scale out/in replication factor
     * @dev Can scale in only upto the already joined number of master nodes
     * @param _id keccak256(_namespace, _archiveUrl) is the ID of the clause
     * @param _replication Replication factor of the content
     * @return _success Boolean, true if updated successfully
     */
    function scalePublisherClause(
        bytes32 _id,
        uint256 _replication
    )
        public
        returns (bool _success)
    {
        require(msg.sender == clauses[_id].publisher);

        require(clauses[_id].nodes.length <= _replication);
        clauses[_id].replication = _replication;

        _success = true;
    }

    /**
     * @notice Function to join a clause and deliver/serve content
     * @dev Clause can only be joined till the replication is not satisfied
     *      msg.sender must approve this contract to transferFrom LIN tokens on their behalf
     * @param _id keccak256(_namespace, _archiveUrl) is the ID of the clause
     * @return _success Boolean, true if joined the clause successfully
     */
    function servePublisherClause(bytes32 _id)
        public
        returns (bool _success)
    {
        // make sure upload contract is valid
        require(clauses[_id].validTill > now);
        require(clauses[_id].expiry > now);

        // make sure it is a new node
        require(clauses[_id].activeNodes[msg.sender] == false);

        // make sure upload contract has slots remaining, if yes, add new node
        require(clauses[_id].nodes.length < clauses[_id].replication);
        clauses[_id].activeNodes[msg.sender] = true;
        clauses[_id].nodes.push(msg.sender);

        // make sure transfer of tokens is possible
        require(ERC20(MARLIN_TOKEN_ADDRESS).transferFrom(
            msg.sender,
            address(this),
            clauses[_id].requiredStake
        ));

        _success = true;
    }

    /**
     * @notice Leave the clause after its validity is over
     * @dev This also means the staked LIN tokens will be transferred back
     * @param _id keccak256(_namespace, _archiveUrl) is the ID of the clause
     * @return _success Boolean, true if withdrawn successfully
     */
    function withdrawStake(bytes32 _id)
        public
        returns (bool _success)
    {
        // make sure upload contract is not valid anymore
        require(now > clauses[_id].validTill);

        // make sure this node was serving
        require(clauses[_id].activeNodes[msg.sender] == true);
        removeNode(_id, msg.sender);
        clauses[_id].activeNodes[msg.sender] = false;

        // withdraw tokens
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, clauses[_id].requiredStake));

        _success = true;
    }

    /**
     * @notice Function to withdraw refundable LIN tokens from this contract
     * @dev Tokens are refunded if the publisher renews their clause beyond the initial clause validity
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
     * @notice Function to read publisher-side clause details
     * @param _id keccak256(_namespace, _archiveUrl) is the ID of the clause
     * @return _publisher Address of the publisher, who created this clause
     * @return _namespace Namespace of the website/project
     * @return _archiveUrl URL of the file archive
     * @return _storageReward Reward (LIN) for storing this content
     * @return _deliveryReward Reward (LIN) for delivering/serving this content
     * @return _validTill UTC timestamp at which clause's validity is over
     * @return _expiry UTC timestamp at which clause auto-expires if no master nodes join
     * @return _replication Replication factor of the content
     * @return _requiredStake Stake (LIN) required to store/deliver this content
     */
    function readPublisherClause(bytes32 _id)
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
        _publisher = clauses[_id].publisher;
        _namespace = clauses[_id].namespace;
        _archiveUrl = clauses[_id].archiveUrl;
        _storageReward = clauses[_id].storageReward;
        _deliveryReward = clauses[_id].deliveryReward;
        _validTill = clauses[_id].validTill;
        _expiry = clauses[_id].expiry;
        _replication = clauses[_id].replication;
        _requiredStake = clauses[_id].requiredStake;
    }

    /**
     * @notice Function to read the refund value of a master node
     * @param _node Address of the master node
     * @return _value Refund value of the master node
     */
    function readRefund(address _node)
        public
        constant
        returns (uint256 _value)
    {
        _value = refunds[_node];
    }

    /**
     * @notice Function to read the stake of a master node for specific clause
     * @param _id keccak256(_namespace, _archiveUrl) is the ID of the clause
     * @param _node Address of the master node
     * @return _value LIN tokens staked by the master node for this clause
     */
    function readStake(bytes32 _id, address _node)
        public
        constant
        returns (uint256 _value)
    {
        if (clauses[_id].activeNodes[_node] == true) {
            _value = clauses[_id].requiredStake;
        }
    }

    function refundPublisherClause(bytes32 _id)
        internal
    {
        // make sure upload contract is not valid anymore
        require(now > clauses[_id].validTill);

        address[] memory _nodes = clauses[_id].nodes;
        for (uint256 i = _nodes.length; i > 0; i--) {
            address _node = _nodes[i];
            refunds[_node] = refunds[_node].add(clauses[_id].requiredStake);
            removeNode(_id, _node);
            clauses[_id].activeNodes[_node] = false;
        }
    }

    function removeNode(bytes32 _id, address _node)
        internal
        constant
    {
        address[] memory _nodes = clauses[_id].nodes;
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
            (now > clauses[_id].expiry) ||
            (clauses[_id].expiry == 0) ||
            (now > clauses[_id].validTill)
        ) {
            return true;
        }
        return false;
    }
}
