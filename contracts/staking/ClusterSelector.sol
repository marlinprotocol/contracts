// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IClusterSelector.sol";

// import "forge-std/console2.sol";

contract ClusterSelector is AccessControl, IClusterSelector {
    bytes32 public updaterRole = keccak256(abi.encode("updater")); // find standard format for this
    bytes32 public updaterAdminRole = keccak256(abi.encode("updater admin")); // find standard format for this

    constructor(address _admin) {
        AccessControl._setRoleAdmin(updaterRole, updaterAdminRole);
        AccessControl._grantRole(updaterAdminRole, _admin);
    }

    mapping(address => Node) public nodes;

    address public root;

    function height(address cluster) public view returns (uint256) {
        if (cluster == address(0)) return 0;
        return nodes[cluster].height;
    }

    function _newNode(address cluster, uint256 balance)
        internal
        pure
        returns (Node memory node)
    {
        node = Node(cluster, balance, address(0), address(0), 0, 0, 1);
    }

    function getNode(address cluster) public view returns (Node memory node) {
        node = nodes[cluster];
    }

    function _rightRotate(address addressOfZ) internal returns (address) {
        Node memory z = getNode(addressOfZ);
        if (addressOfZ == address(0)) {
            revert("trying to RR 0");
        }

        Node memory y = getNode(z.left);

        // do not rotate if left is 0
        if (y.cluster == address(0)) {
            return z.cluster;
        }
        Node memory T3 = getNode(y.right);

        // cut z.left
        nodes[z.cluster].sumOfLeftBalances = _getTotalBalancesIncludingWeight(
            T3.cluster
        );
        nodes[z.cluster].left = T3.cluster;
        // cut y.right
        nodes[y.cluster].sumOfRightBalances = _getTotalBalancesIncludingWeight(
            z.cluster
        );
        nodes[y.cluster].right = z.cluster;

        nodes[z.cluster].height = Math.max(height(z.right), height(z.left)) + 1;
        nodes[y.cluster].height = Math.max(height(y.right), height(y.left)) + 1;
        return y.cluster;
    }

    function _leftRotate(address addressOfZ) internal returns (address) {
        Node memory z = getNode(addressOfZ);
        if (addressOfZ == address(0)) {
            revert("trying to LR 0");
        }

        Node memory y = getNode(z.right);

        // do not rotate if right is 0
        if (y.cluster == address(0)) {
            return z.cluster;
        }
        Node memory T2 = getNode(y.left);

        // cut z.right
        nodes[z.cluster].sumOfRightBalances = _getTotalBalancesIncludingWeight(
            T2.cluster
        );
        nodes[z.cluster].right = T2.cluster;
        // cut y.left
        nodes[y.cluster].sumOfLeftBalances = _getTotalBalancesIncludingWeight(
            z.cluster
        );
        nodes[y.cluster].left = z.cluster;

        nodes[z.cluster].height = Math.max(height(z.left), height(z.right)) + 1;
        nodes[y.cluster].height = Math.max(height(y.left), height(y.right)) + 1;

        return y.cluster;
    }

    function getBalance(address cluster) public view returns (int256) {
        if (cluster == address(0)) return 0;

        Node memory node = nodes[cluster];

        return int256(height(node.left)) - int256(height(node.right));
    }

    function insert(address cluster, uint256 clusterBalance)
        public
        override
        onlyRole(updaterRole)
    {
        require(cluster != address(0), "address(0) not permitted into entry");
        if (nodes[cluster].cluster == address(0)) {
            root = _insert(root, cluster, clusterBalance);
        } else {
            int256 differenceInKeyBalance = int256(clusterBalance) -
                int256(nodes[cluster].balance);
            _update(root, cluster, differenceInKeyBalance);
        }
    }

    function update(address cluster, uint256 clusterBalance)
        public
        override
        onlyRole(updaterRole)
    {
        require(cluster != address(0), "address(0) not permitted into entry");
        if (nodes[cluster].cluster == address(0)) {
            //
            revert("Can't update if it is not inserted already");
        } else {
            int256 differenceInKeyBalance = int256(clusterBalance) -
                int256(nodes[cluster].balance);
            _update(root, cluster, differenceInKeyBalance);
        }
    }

    function weightedSearch(uint256 randomizer) public view returns (address) {
        uint256 totalWeightInTree = _getTotalBalancesIncludingWeight(root);
        uint256 searchNumber = randomizer % totalWeightInTree;
        // console2.log("totalWeightInTree", totalWeightInTree);
        // console2.log("searchNumber", searchNumber);
        return _weightedSearch(root, searchNumber);
    }

    function _weightedSearch(address _node, uint256 searchNumber)
        public
        view
        returns (address)
    {
        // |-----------sumOfLeftWeight -------|----balance-----|------sumOfRightWeights------|
        Node memory node = nodes[_node];
        (uint256 index1, uint256 index2, uint256 index3) = _getIndexes(_node);

        if (searchNumber < index1) {
            return _weightedSearch(node.left, index1 - searchNumber);
        } else if (searchNumber >= index1 && searchNumber < index2) {
            return _node;
        } else if (searchNumber >= index2 && searchNumber <= index3) {
            return _weightedSearch(node.right, searchNumber - index2);
        } else {
            // _printNode(_node);
            // console2.log("indexes", index1, index2, index3);
            // console2.log("search number", searchNumber);
            revert("This case should never occur");
        }
    }

    function _getIndexes(address _node)
        internal
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        Node memory node = nodes[_node];
        return (
            node.sumOfLeftBalances,
            node.sumOfLeftBalances + node.balance,
            node.sumOfLeftBalances + node.balance + node.sumOfRightBalances
        );
    }

    function _update(
        address node,
        address key,
        int256 diff
    ) internal {
        if (node == key) {
            diff > 0
                ? nodes[node].balance += uint256(diff)
                : nodes[node].balance -= uint256(-diff);
        } else if (key < node) {
            diff > 0
                ? nodes[node].sumOfLeftBalances += uint256(diff)
                : nodes[node].sumOfLeftBalances -= uint256(-diff);
            _update(nodes[node].left, key, diff);
        } else if (key > node) {
            diff > 0
                ? nodes[node].sumOfRightBalances += uint256(diff)
                : nodes[node].sumOfRightBalances -= uint256(-diff);
            _update(nodes[node].right, key, diff);
        } else {
            revert("This case should not occur");
        }
    }

    function _insert(
        address node,
        address key,
        uint256 keyBalance
    ) internal returns (address) {
        if (node == address(0)) {
            nodes[key] = _newNode(key, keyBalance);
            return nodes[key].cluster;
        }

        if (key < node) {
            nodes[node].left = _insert(nodes[node].left, key, keyBalance);
            nodes[node].sumOfLeftBalances += keyBalance;
        } else if (key > node) {
            nodes[node].right = _insert(nodes[node].right, key, keyBalance);
            nodes[node].sumOfRightBalances += keyBalance;
        } else {
            revert("Duplicate address being tried to insert in the tree");
        }

        // 2. update the height
        nodes[node].height =
            1 +
            Math.max(height(nodes[node].left), height(nodes[node].right));

        // 3. Get the balance factor
        int256 balance = getBalance(node);

        // Left Left Case
        if (balance > 1 && key < nodes[node].left) {
            // console2.log("_insert LL Case", keyBalance);
            return _rightRotate(node);
        }

        // Right Right Case
        if (balance < -1 && key > nodes[node].right) {
            // console2.log("_insert RR Case", keyBalance);
            return _leftRotate(node);
        }

        // Left Right Case
        if (balance > 1 && key > nodes[node].left) {
            // console2.log("_insert LR Case", keyBalance);
            nodes[node].left = _leftRotate(nodes[node].left);
            return _rightRotate(node);
        }

        // Right Left Case
        if (balance < -1 && key < nodes[node].right) {
            // console2.log("_insert RL Case", keyBalance);
            nodes[node].right = _rightRotate(nodes[node].right);
            return _leftRotate(node);
        }

        return node;
    }

    function search(address node) public view returns (bool) {
        if (node == address(0)) {
            return false;
        }

        return nodes[node].cluster == node;
    }

    function nodeData(address _node) public view returns (Node memory node) {
        node = nodes[_node];
    }

    function _getTotalBalancesIncludingWeight(address _node)
        internal
        view
        returns (uint256)
    {
        Node memory node = nodes[_node];
        return node.balance + node.sumOfLeftBalances + node.sumOfRightBalances;
    }

    // function _printNode(address _node) internal view {
    //     Node memory node = nodes[_node];
    //     console2.log("************************************");
    //     console2.log("cluster", node.cluster);
    //     console2.log("balance", node.balance);
    //     console2.log("left", node.left);
    //     console2.log("right", node.right);
    //     console2.log("sumOfLeftBalances", node.sumOfLeftBalances);
    //     console2.log("sumOfRightBalances", node.sumOfRightBalances);
    //     console2.log(" height", node.height);
    //     console2.log("************************************");
    // }
}
