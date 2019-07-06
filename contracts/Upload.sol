pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Upload {

    using SafeMath for uint256;

    event PublisherContract(string namespace, string fileArchiveUrl);

    struct UploadContract {
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

    mapping(bytes32 => UploadContract) uploadContracts;
    mapping(address => uint256) refunds;
    address MARLIN_TOKEN_ADDRESS;

    constructor(address _tokenContractAddress) public {
        MARLIN_TOKEN_ADDRESS = _tokenContractAddress;
    }

    function addUploadContract(
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
        if (uploadContracts[_id].nodes.length > 0) {
            require(msg.sender == uploadContracts[_id].publisher);
            refundUploadContract(_id);
        }
        uploadContracts[_id].publisher = msg.sender;
        uploadContracts[_id].namespace = _namespace;
        uploadContracts[_id].archiveUrl = _archiveUrl;
        uploadContracts[_id].storageReward = _storageReward;
        uploadContracts[_id].deliveryReward = _deliveryReward;
        uploadContracts[_id].validTill = now.add(_duration);
        uploadContracts[_id].expiry = _expiry;
        uploadContracts[_id].replication = _replication;
        uploadContracts[_id].requiredStake = _requiredStake;
        emit PublisherContract(_namespace, _archiveUrl);
    }

    function scaleUploadContract(
        string _namespace,
        string _archiveUrl,
        uint256 _replication
    )
        public
        returns (bool _success)
    {
        bytes32 _id = keccak256(abi.encodePacked(_namespace, _archiveUrl));
        require(msg.sender == uploadContracts[_id].publisher);

        require(uploadContracts[_id].nodes.length <= _replication);
        uploadContracts[_id].replication = _replication;

        _success = true;
    }

    function serveUploadContract(
        string _namespace,
        string _archiveUrl
    )
        public
        returns (bool _success)
    {
        bytes32 _id = keccak256(abi.encodePacked(_namespace, _archiveUrl));

        // make sure upload contract is valid
        require(uploadContracts[_id].validTill > now);
        require(uploadContracts[_id].expiry > now);

        // make sure it is a new node
        require(uploadContracts[_id].activeNodes[msg.sender] == false);

        // make sure upload contract has slots remaining, if yes, add new node
        require(uploadContracts[_id].nodes.length < uploadContracts[_id].replication);
        uploadContracts[_id].activeNodes[msg.sender] = true;
        uploadContracts[_id].nodes.push(msg.sender);

        // make sure transfer of tokens is possible
        require(ERC20(MARLIN_TOKEN_ADDRESS).transferFrom(
            msg.sender,
            address(this),
            uploadContracts[_id].requiredStake
        ));

        _success = true;
    }

    function withdrawStake(
        string _namespace,
        string _archiveUrl
    )
        public
        returns (bool _success)
    {
        bytes32 _id = keccak256(abi.encodePacked(_namespace, _archiveUrl));

        // make sure upload contract is not valid anymore
        require(now > uploadContracts[_id].validTill);

        // make sure this node was serving
        require(uploadContracts[_id].activeNodes[msg.sender] == true);
        removeNode(_id, msg.sender);
        uploadContracts[_id].activeNodes[msg.sender] = false;

        // withdraw tokens
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, uploadContracts[_id].requiredStake));

        _success = true;
    }

    function withdrawRefund()
        public
    {
        uint256 _refund = refunds[msg.sender];
        require(_refund > 0);
        refunds[msg.sender] = 0;
        require(ERC20(MARLIN_TOKEN_ADDRESS).transfer(msg.sender, _refund));
    }

    function readUploadContract(bytes32 _id)
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
        _publisher = uploadContracts[_id].publisher;
        _namespace = uploadContracts[_id].namespace;
        _archiveUrl = uploadContracts[_id].archiveUrl;
        _storageReward = uploadContracts[_id].storageReward;
        _deliveryReward = uploadContracts[_id].deliveryReward;
        _validTill = uploadContracts[_id].validTill;
        _expiry = uploadContracts[_id].expiry;
        _replication = uploadContracts[_id].replication;
        _requiredStake = uploadContracts[_id].requiredStake;
    }

    function readRefund(address _node)
        public
        constant
        returns (uint256 _value)
    {
        _value = refunds[_node];
    }

    function readStake(string _namespace, string _archiveUrl, address _node)
        public
        constant
        returns (uint256 _value)
    {
        bytes32 _id = keccak256(abi.encodePacked(_namespace, _archiveUrl));
        if (uploadContracts[_id].activeNodes[_node] == true) {
            _value = uploadContracts[_id].requiredStake;
        }
    }

    function refundUploadContract(bytes32 _id)
        internal
    {
        // make sure upload contract is not valid anymore
        require(now > uploadContracts[_id].validTill);

        address[] memory _nodes = uploadContracts[_id].nodes;
        for (uint256 i = _nodes.length; i > 0; i--) {
            address _node = _nodes[i];
            refunds[_node] = refunds[_node].add(uploadContracts[_id].requiredStake);
            removeNode(_id, _node);
            uploadContracts[_id].activeNodes[_node] = false;
        }
    }

    function removeNode(bytes32 _id, address _node)
        internal
        constant
    {
        address[] memory _nodes = uploadContracts[_id].nodes;
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
            (now > uploadContracts[_id].expiry) ||
            (uploadContracts[_id].expiry == 0) ||
            (now > uploadContracts[_id].validTill)
        ) {
            return true;
        }
        return false;
    }
}
