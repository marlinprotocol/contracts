// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// OpenZeppelin Contracts (last updated v4.7.0) (access/AccessControl.sol)

// OpenZeppelin Contracts v4.4.1 (access/IAccessControl.sol)

/**
 * @dev External interface of AccessControl declared to support ERC165 detection.
 */
interface IAccessControl {
    /**
     * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
     *
     * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
     * {RoleAdminChanged} not being emitted signaling this.
     *
     * _Available since v3.1._
     */
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    /**
     * @dev Emitted when `account` is granted `role`.
     *
     * `sender` is the account that originated the contract call, an admin role
     * bearer except when using {AccessControl-_setupRole}.
     */
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Emitted when `account` is revoked `role`.
     *
     * `sender` is the account that originated the contract call:
     *   - if using `revokeRole`, it is the admin role bearer
     *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
     */
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {AccessControl-_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) external view returns (bytes32);

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been granted `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `account`.
     */
    function renounceRole(bytes32 role, address account) external;
}

// OpenZeppelin Contracts v4.4.1 (utils/Context.sol)

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

// OpenZeppelin Contracts (last updated v4.7.0) (utils/Strings.sol)

/**
 * @dev String operations.
 */
library Strings {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    uint8 private constant _ADDRESS_LENGTH = 20;

    /**
     * @dev Converts a `uint256` to its ASCII `string` decimal representation.
     */
    function toString(uint256 value) internal pure returns (string memory) {
        // Inspired by OraclizeAPI's implementation - MIT licence
        // https://github.com/oraclize/ethereum-api/blob/b42146b063c7d6ee1358846c198246239e9360e8/oraclizeAPI_0.4.25.sol

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation.
     */
    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    /**
     * @dev Converts a `uint256` to its ASCII `string` hexadecimal representation with fixed length.
     */
    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }

    /**
     * @dev Converts an `address` with fixed length of 20 bytes to its not checksummed ASCII `string` hexadecimal representation.
     */
    function toHexString(address addr) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), _ADDRESS_LENGTH);
    }
}

// OpenZeppelin Contracts v4.4.1 (utils/introspection/ERC165.sol)

// OpenZeppelin Contracts v4.4.1 (utils/introspection/IERC165.sol)

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/**
 * @dev Implementation of the {IERC165} interface.
 *
 * Contracts that want to implement ERC165 should inherit from this contract and override {supportsInterface} to check
 * for the additional interface id that will be supported. For example:
 *
 * ```solidity
 * function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
 *     return interfaceId == type(MyInterface).interfaceId || super.supportsInterface(interfaceId);
 * }
 * ```
 *
 * Alternatively, {ERC165Storage} provides an easier to use but more expensive implementation.
 */
abstract contract ERC165 is IERC165 {
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

/**
 * @dev Contract module that allows children to implement role-based access
 * control mechanisms. This is a lightweight version that doesn't allow enumerating role
 * members except through off-chain means by accessing the contract event logs. Some
 * applications may benefit from on-chain enumerability, for those cases see
 * {AccessControlEnumerable}.
 *
 * Roles are referred to by their `bytes32` identifier. These should be exposed
 * in the external API and be unique. The best way to achieve this is by
 * using `public constant` hash digests:
 *
 * ```
 * bytes32 public constant MY_ROLE = keccak256("MY_ROLE");
 * ```
 *
 * Roles can be used to represent a set of permissions. To restrict access to a
 * function call, use {hasRole}:
 *
 * ```
 * function foo() public {
 *     require(hasRole(MY_ROLE, msg.sender));
 *     ...
 * }
 * ```
 *
 * Roles can be granted and revoked dynamically via the {grantRole} and
 * {revokeRole} functions. Each role has an associated admin role, and only
 * accounts that have a role's admin role can call {grantRole} and {revokeRole}.
 *
 * By default, the admin role for all roles is `DEFAULT_ADMIN_ROLE`, which means
 * that only accounts with this role will be able to grant or revoke other
 * roles. More complex role relationships can be created by using
 * {_setRoleAdmin}.
 *
 * WARNING: The `DEFAULT_ADMIN_ROLE` is also its own admin: it has permission to
 * grant and revoke this role. Extra precautions should be taken to secure
 * accounts that have been granted it.
 */
abstract contract AccessControl is Context, IAccessControl, ERC165 {
    struct RoleData {
        mapping(address => bool) members;
        bytes32 adminRole;
    }

    mapping(bytes32 => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /**
     * @dev Modifier that checks that an account has a specific role. Reverts
     * with a standardized message including the required role.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
     *
     * _Available since v4.1._
     */
    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAccessControl).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function hasRole(bytes32 role, address account) public view virtual override returns (bool) {
        return _roles[role].members[account];
    }

    /**
     * @dev Revert with a standard message if `_msgSender()` is missing `role`.
     * Overriding this function changes the behavior of the {onlyRole} modifier.
     *
     * Format of the revert message is described in {_checkRole}.
     *
     * _Available since v4.6._
     */
    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, _msgSender());
    }

    /**
     * @dev Revert with a standard message if `account` is missing `role`.
     *
     * The format of the revert reason is given by the following regular expression:
     *
     *  /^AccessControl: account (0x[0-9a-f]{40}) is missing role (0x[0-9a-f]{64})$/
     */
    function _checkRole(bytes32 role, address account) internal view virtual {
        if (!hasRole(role, account)) {
            revert(
                string(
                    abi.encodePacked(
                        "AccessControl: account ",
                        Strings.toHexString(uint160(account), 20),
                        " is missing role ",
                        Strings.toHexString(uint256(role), 32)
                    )
                )
            );
        }
    }

    /**
     * @dev Returns the admin role that controls `role`. See {grantRole} and
     * {revokeRole}.
     *
     * To change a role's admin, use {_setRoleAdmin}.
     */
    function getRoleAdmin(bytes32 role) public view virtual override returns (bytes32) {
        return _roles[role].adminRole;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleGranted} event.
     */
    function grantRole(bytes32 role, address account) public virtual override onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * If `account` had been granted `role`, emits a {RoleRevoked} event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     *
     * May emit a {RoleRevoked} event.
     */
    function revokeRole(bytes32 role, address account) public virtual override onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev Revokes `role` from the calling account.
     *
     * Roles are often managed via {grantRole} and {revokeRole}: this function's
     * purpose is to provide a mechanism for accounts to lose their privileges
     * if they are compromised (such as when a trusted device is misplaced).
     *
     * If the calling account had been revoked `role`, emits a {RoleRevoked}
     * event.
     *
     * Requirements:
     *
     * - the caller must be `account`.
     *
     * May emit a {RoleRevoked} event.
     */
    function renounceRole(bytes32 role, address account) public virtual override {
        require(account == _msgSender(), "AccessControl: can only renounce roles for self");

        _revokeRole(role, account);
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event. Note that unlike {grantRole}, this function doesn't perform any
     * checks on the calling account.
     *
     * May emit a {RoleGranted} event.
     *
     * [WARNING]
     * ====
     * This function should only be called from the constructor when setting
     * up the initial roles for the system.
     *
     * Using this function in any other way is effectively circumventing the admin
     * system imposed by {AccessControl}.
     * ====
     *
     * NOTE: This function is deprecated in favor of {_grantRole}.
     */
    function _setupRole(bytes32 role, address account) internal virtual {
        _grantRole(role, account);
    }

    /**
     * @dev Sets `adminRole` as ``role``'s admin role.
     *
     * Emits a {RoleAdminChanged} event.
     */
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdminRole = getRoleAdmin(role);
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleGranted} event.
     */
    function _grantRole(bytes32 role, address account) internal virtual {
        if (!hasRole(role, account)) {
            _roles[role].members[account] = true;
            emit RoleGranted(role, account, _msgSender());
        }
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * Internal function without access restriction.
     *
     * May emit a {RoleRevoked} event.
     */
    function _revokeRole(bytes32 role, address account) internal virtual {
        if (hasRole(role, account)) {
            _roles[role].members[account] = false;
            emit RoleRevoked(role, account, _msgSender());
        }
    }
}

interface IClusterSelector {
    /// @notice Address of the node
    /// @param node Address of the node
    /// @param balance Balance of the node
    /// @param left Address of the node left of node
    /// @param right Address of the node right of the node
    /// @param sumOfLeftBalances Sum of the balance of nodes on left of the node
    /// @param sumOfRightBalances Sum of the balance of the nodes of right of the node
    /// @param height Height of the current node
    struct Node {
        address node; // sorting condition
        uint96 balance;
        address left;
        uint96 sumOfLeftBalances;
        address right;
        uint96 sumOfRightBalances;
        uint256 height;
    }

    /// @notice Add an element to tree. If the element already exists, it will be updated
    /// @param newNode Address of the node to add
    /// @param balance Balance of the node
    function insert(address newNode, uint96 balance) external;

    /// @notice Update the balance of the node
    /// @param cluster Address of the existing node
    /// @param clusterBalance new balance of the node
    function update(address cluster, uint96 clusterBalance) external;

    /// @notice Delete a node from the tree
    /// @param key Address of the node to delete
    function deleteNode(address key) external;
}

interface IEpochSelector is IClusterSelector {
    function getCurrentEpoch() external view returns (uint256);

    function getCurrentClusters() external returns (address[] memory nodes);

    /// @notice Delete a node from tree if it is stored
    /// @param key Address of the node
    function deleteNodeIfPresent(address key) external returns (bool);
}

// OpenZeppelin Contracts (last updated v4.7.0) (utils/math/Math.sol)

/**
 * @dev Standard math utilities missing in the Solidity language.
 */
library Math {
    enum Rounding {
        Down, // Toward negative infinity
        Up, // Toward infinity
        Zero // Toward zero
    }

    /**
     * @dev Returns the largest of two numbers.
     */
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    /**
     * @dev Returns the smallest of two numbers.
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /**
     * @dev Returns the average of two numbers. The result is rounded towards
     * zero.
     */
    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow.
        return (a & b) + (a ^ b) / 2;
    }

    /**
     * @dev Returns the ceiling of the division of two numbers.
     *
     * This differs from standard division with `/` in that it rounds up instead
     * of rounding down.
     */
    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b - 1) / b can overflow on addition, so we distribute.
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    /**
     * @notice Calculates floor(x * y / denominator) with full precision. Throws if result overflows a uint256 or denominator == 0
     * @dev Original credit to Remco Bloemen under MIT license (https://xn--2-umb.com/21/muldiv)
     * with further edits by Uniswap Labs also under MIT license.
     */
    function mulDiv(
        uint256 x,
        uint256 y,
        uint256 denominator
    ) internal pure returns (uint256 result) {
        unchecked {
            // 512-bit multiply [prod1 prod0] = x * y. Compute the product mod 2^256 and mod 2^256 - 1, then use
            // use the Chinese Remainder Theorem to reconstruct the 512 bit result. The result is stored in two 256
            // variables such that product = prod1 * 2^256 + prod0.
            uint256 prod0; // Least significant 256 bits of the product
            uint256 prod1; // Most significant 256 bits of the product
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }

            // Handle non-overflow cases, 256 by 256 division.
            if (prod1 == 0) {
                return prod0 / denominator;
            }

            // Make sure the result is less than 2^256. Also prevents denominator == 0.
            require(denominator > prod1);

            ///////////////////////////////////////////////
            // 512 by 256 division.
            ///////////////////////////////////////////////

            // Make division exact by subtracting the remainder from [prod1 prod0].
            uint256 remainder;
            assembly {
                // Compute remainder using mulmod.
                remainder := mulmod(x, y, denominator)

                // Subtract 256 bit number from 512 bit number.
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }

            // Factor powers of two out of denominator and compute largest power of two divisor of denominator. Always >= 1.
            // See https://cs.stackexchange.com/q/138556/92363.

            // Does not overflow because the denominator cannot be zero at this stage in the function.
            uint256 twos = denominator & (~denominator + 1);
            assembly {
                // Divide denominator by twos.
                denominator := div(denominator, twos)

                // Divide [prod1 prod0] by twos.
                prod0 := div(prod0, twos)

                // Flip twos such that it is 2^256 / twos. If twos is zero, then it becomes one.
                twos := add(div(sub(0, twos), twos), 1)
            }

            // Shift in bits from prod1 into prod0.
            prod0 |= prod1 * twos;

            // Invert denominator mod 2^256. Now that denominator is an odd number, it has an inverse modulo 2^256 such
            // that denominator * inv = 1 mod 2^256. Compute the inverse by starting with a seed that is correct for
            // four bits. That is, denominator * inv = 1 mod 2^4.
            uint256 inverse = (3 * denominator) ^ 2;

            // Use the Newton-Raphson iteration to improve the precision. Thanks to Hensel's lifting lemma, this also works
            // in modular arithmetic, doubling the correct bits in each step.
            inverse *= 2 - denominator * inverse; // inverse mod 2^8
            inverse *= 2 - denominator * inverse; // inverse mod 2^16
            inverse *= 2 - denominator * inverse; // inverse mod 2^32
            inverse *= 2 - denominator * inverse; // inverse mod 2^64
            inverse *= 2 - denominator * inverse; // inverse mod 2^128
            inverse *= 2 - denominator * inverse; // inverse mod 2^256

            // Because the division is now exact we can divide by multiplying with the modular inverse of denominator.
            // This will give us the correct result modulo 2^256. Since the preconditions guarantee that the outcome is
            // less than 2^256, this is the final result. We don't need to compute the high bits of the result and prod1
            // is no longer required.
            result = prod0 * inverse;
            return result;
        }
    }

    /**
     * @notice Calculates x * y / denominator with full precision, following the selected rounding direction.
     */
    function mulDiv(
        uint256 x,
        uint256 y,
        uint256 denominator,
        Rounding rounding
    ) internal pure returns (uint256) {
        uint256 result = mulDiv(x, y, denominator);
        if (rounding == Rounding.Up && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
        return result;
    }

    /**
     * @dev Returns the square root of a number. It the number is not a perfect square, the value is rounded down.
     *
     * Inspired by Henry S. Warren, Jr.'s "Hacker's Delight" (Chapter 11).
     */
    function sqrt(uint256 a) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        // For our first guess, we get the biggest power of 2 which is smaller than the square root of the target.
        // We know that the "msb" (most significant bit) of our target number `a` is a power of 2 such that we have
        // `msb(a) <= a < 2*msb(a)`.
        // We also know that `k`, the position of the most significant bit, is such that `msb(a) = 2**k`.
        // This gives `2**k < a <= 2**(k+1)` → `2**(k/2) <= sqrt(a) < 2 ** (k/2+1)`.
        // Using an algorithm similar to the msb conmputation, we are able to compute `result = 2**(k/2)` which is a
        // good first aproximation of `sqrt(a)` with at least 1 correct bit.
        uint256 result = 1;
        uint256 x = a;
        if (x >> 128 > 0) {
            x >>= 128;
            result <<= 64;
        }
        if (x >> 64 > 0) {
            x >>= 64;
            result <<= 32;
        }
        if (x >> 32 > 0) {
            x >>= 32;
            result <<= 16;
        }
        if (x >> 16 > 0) {
            x >>= 16;
            result <<= 8;
        }
        if (x >> 8 > 0) {
            x >>= 8;
            result <<= 4;
        }
        if (x >> 4 > 0) {
            x >>= 4;
            result <<= 2;
        }
        if (x >> 2 > 0) {
            result <<= 1;
        }

        // At this point `result` is an estimation with one bit of precision. We know the true value is a uint128,
        // since it is the square root of a uint256. Newton's method converges quadratically (precision doubles at
        // every iteration). We thus need at most 7 iteration to turn our partial result with one bit of precision
        // into the expected uint128 result.
        unchecked {
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            result = (result + a / result) >> 1;
            return min(result, a / result);
        }
    }

    /**
     * @notice Calculates sqrt(a), following the selected rounding direction.
     */
    function sqrt(uint256 a, Rounding rounding) internal pure returns (uint256) {
        uint256 result = sqrt(a);
        if (rounding == Rounding.Up && result * result < a) {
            result += 1;
        }
        return result;
    }
}

// import "forge-std/console2.sol";

library ClusterLib {
    string constant CANNOT_RR_ADDRESS_ZERO = "1";
    string constant CANNOT_LR_ADDRESS_ZERO = "2";
    string constant CANNOT_BE_ADDRESS_ZERO = "3";
    string constant NODE_NOT_PRESENT_IN_THE_TREE = "4";
    string constant ERROR_OCCURED_DURING_WEIGHTED_SEARCH = "5";
    string constant ERROR_OCCURED_DURING_UPDATE = "6";
    string constant CANNOT_INSERT_DUPLICATE_ELEMENT_INTO_TREE = "7";
    string constant ERROR_OCCURED_DURING_DELETE = "8";
    string constant INSUFFICIENT_ELEMENTS_IN_TREE = "9";
    string constant ERROR_OCCURED_DURING_TRAVERSING_SELECTED_NODE = "10";
    string constant ERROR_OCCURED_DURING_TRAVERSING_NON_SELECTED_NODE = "11";

    /// @notice Checks if the array has an element in it
    /// @param array Array to check
    /// @param element Element to check in the array
    function ifArrayHasElement(address[] memory array, address element) internal pure returns (bool) {
        for (uint256 index = 0; index < array.length; index++) {
            if (element == array[index]) {
                return true;
            }
            if (element == address(0)) {
                break;
            }
        }
        return false;
    }

    /// @notice Returns indexes when only balances and left and right weights are provided
    /// @param sumOfLeftBalances Sum of balances of nodes on the left
    /// @param balance Balance of the node
    /// @param sumOfRightBalances Sum of balances of nodes on the right
    /// @return First index of the search
    /// @return Second index of the search
    /// @return Third index of the search
    function _getIndexesWithWeights(
        uint256 sumOfLeftBalances,
        uint256 balance,
        uint256 sumOfRightBalances
    )
        internal
        pure
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (sumOfLeftBalances, sumOfLeftBalances + balance, sumOfLeftBalances + balance + sumOfRightBalances);
    }

    /// @notice Add element to array
    /// @param array Array to which the element must be added
    /// @param toAdd Element to add
    /// @return A new array with element added to it
    function _addAddressToEncodedArray(bytes memory array, address toAdd) internal pure returns (bytes memory) {
        address[] memory _currentNodePath = abi.decode(array, (address[]));
        uint256 lengthOfNewPath = _currentNodePath.length + 1;

        address[] memory _newNodePath = new address[](lengthOfNewPath);

        for (uint256 index = 0; index < lengthOfNewPath - 1; index++) {
            _newNodePath[index] = _currentNodePath[index];
        }
        _newNodePath[lengthOfNewPath - 1] = toAdd;
        return abi.encode(_newNodePath);
    }

    function _getAddressesFromEncodedArray(bytes memory array) internal pure returns (address[] memory) {
        return abi.decode(array, (address[]));
    }

    // function _addAddressToEncodedArray(bytes memory array, address toAdd) internal pure returns (bytes memory) {
    //     return abi.encodePacked(array, toAdd);
    // }

    // function ifArrayHasElement(bytes memory array, address element) internal pure returns (bool) {
    //     uint256 index = 0;
    //     while (index < array.length) {
    //         address temp = bytesToAddress(slice(array, index, 20));
    //         if (temp == element) {
    //             return true;
    //         }
    //         index += 20;
    //     }

    //     return false;
    // }

    // function bytesToAddress(bytes memory bys) private pure returns (address addr) {
    //     assembly {
    //         addr := mload(add(bys, 20))
    //     }
    // }

    // function slice(
    //     bytes memory _bytes,
    //     uint256 _start,
    //     uint256 _length
    // ) internal pure returns (bytes memory) {
    //     require(_length + 31 >= _length, "slice_overflow");
    //     require(_bytes.length >= _start + _length, "slice_outOfBounds");

    //     bytes memory tempBytes;

    //     assembly {
    //         switch iszero(_length)
    //         case 0 {
    //             // Get a location of some free memory and store it in tempBytes as
    //             // Solidity does for memory variables.
    //             tempBytes := mload(0x40)

    //             // The first word of the slice result is potentially a partial
    //             // word read from the original array. To read it, we calculate
    //             // the length of that partial word and start copying that many
    //             // bytes into the array. The first word we copy will start with
    //             // data we don't care about, but the last `lengthmod` bytes will
    //             // land at the beginning of the contents of the new array. When
    //             // we're done copying, we overwrite the full first word with
    //             // the actual length of the slice.
    //             let lengthmod := and(_length, 31)

    //             // The multiplication in the next line is necessary
    //             // because when slicing multiples of 32 bytes (lengthmod == 0)
    //             // the following copy loop was copying the origin's length
    //             // and then ending prematurely not copying everything it should.
    //             let mc := add(add(tempBytes, lengthmod), mul(0x20, iszero(lengthmod)))
    //             let end := add(mc, _length)

    //             for {
    //                 // The multiplication in the next line has the same exact purpose
    //                 // as the one above.
    //                 let cc := add(add(add(_bytes, lengthmod), mul(0x20, iszero(lengthmod))), _start)
    //             } lt(mc, end) {
    //                 mc := add(mc, 0x20)
    //                 cc := add(cc, 0x20)
    //             } {
    //                 mstore(mc, mload(cc))
    //             }

    //             mstore(tempBytes, _length)

    //             //update free-memory pointer
    //             //allocating the array padded to 32 bytes like the compiler does now
    //             mstore(0x40, and(add(mc, 31), not(31)))
    //         }
    //         //if we want a zero-length slice let's just return a zero-length array
    //         default {
    //             tempBytes := mload(0x40)
    //             //zero out the 32 bytes slice we are about to return
    //             //we need to do it because Solidity does not garbage collect
    //             mstore(tempBytes, 0)

    //             mstore(0x40, add(tempBytes, 0x20))
    //         }
    //     }

    //     return tempBytes;
    // }
}

// import "forge-std/console2.sol";

abstract contract SelectorHelper is IClusterSelector {
    /// @notice List of all nodes
    mapping(address => Node) public nodes;

    /// @notice Total number of all nodes in the tree
    uint256 public totalElements;

    /// @notice Address of the current root
    address public root;

    /// @notice Height of the tree at a given moment
    /// @return Height of the tree
    function heightOfTheTree() public view returns (uint256) {
        return height(root);
    }

    /// @notice Height of any node at a given moment
    /// @param node Address of the node whose height needs to be searched
    /// @return Height of the node
    function height(address node) public view returns (uint256) {
        if (node == address(0)) return 0;
        return nodes[node].height;
    }

    /// @notice Function to create a empty node
    /// @param node Address of the new node
    /// @param balance Balance of the new node
    /// @return newNode Empty node with address and balance
    function _newNode(address node, uint96 balance) internal pure returns (Node memory newNode) {
        newNode = Node(node, balance, address(0), 0, address(0), 0, 1);
    }

    /// @notice Right rotate a given node
    /// @param addressOfZ address of the node to right rotate
    /// @return Returns the new root after the rotation
    /// @notice ----------------------------- z -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- y     T4 -------------------------
    /// @notice ------------------------- / \        ------------------------
    /// @notice ------------------------ x   T3       -----------------------
    /// @notice ----------------------- / \            ----------------------
    /// @notice ---------------------- T1  T2            --------------------
    /// @notice is rotated to
    /// @notice ----------------------------- y -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- x     z --------------------------
    /// @notice ------------------------- / \   / \ -------------------------
    /// @notice ------------------------ T1 T2 T3 T4 ------------------------
    function _rightRotate(address addressOfZ) internal returns (address) {
        if (addressOfZ == address(0)) {
            revert(ClusterLib.CANNOT_RR_ADDRESS_ZERO);
        }
        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.left];

        // do not rotate if left is 0
        if (y.node == address(0)) {
            // console2.log("RR: not because y is 0 ");
            return z.node;
        }
        Node storage T3 = nodes[y.right];

        // cut z.left
        z.sumOfLeftBalances = _getTotalBalancesIncludingWeight(T3);
        z.left = T3.node;
        // cut y.right
        y.sumOfRightBalances = _getTotalBalancesIncludingWeight(z);
        y.right = z.node;

        z.height = calculateUpdatedHeight(z);
        y.height = calculateUpdatedHeight(y);
        return y.node;
    }

    /// @notice Lef rotate a given node
    /// @param addressOfZ address of the node to left rotate
    /// @return Returns the new root after the rotation
    /// @notice ----------------------------- z -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- T1    y --------------------------
    /// @notice -------------------------       / \ -------------------------
    /// @notice ------------------------      T2   x ------------------------
    /// @notice -----------------------           / \ -----------------------
    /// @notice ----------------------           T3  T4 ---------------------
    /// @notice is rotated to
    /// @notice ----------------------------- y -----------------------------
    /// @notice --------------------------- /   \ ---------------------------
    /// @notice -------------------------- z     x --------------------------
    /// @notice ------------------------- / \   / \ -------------------------
    /// @notice ------------------------ T1 T2 T3 T4 ------------------------
    function _leftRotate(address addressOfZ) internal returns (address) {
        if (addressOfZ == address(0)) {
            revert(ClusterLib.CANNOT_LR_ADDRESS_ZERO);
        }
        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.right];

        // do not rotate if right is 0
        if (y.node == address(0)) {
            // console2.log("LR: not because y is 0 ");
            return z.node;
        }
        Node storage T2 = nodes[y.left];

        // cut z.right
        z.sumOfRightBalances = _getTotalBalancesIncludingWeight(T2);
        z.right = T2.node;
        // cut y.left
        y.sumOfLeftBalances = _getTotalBalancesIncludingWeight(z);
        y.left = z.node;

        z.height = calculateUpdatedHeight(z);
        y.height = calculateUpdatedHeight(y);
        return y.node;
    }

    /// @notice Returns the node balance i.e difference in heights of left and right nodes
    /// @param node Address of the node to get balance of
    /// @return Balance of the node
    function getHeightDifference(address node) public view returns (int256) {
        if (node == address(0)) return 0;

        Node memory existingNode = nodes[node];

        return int256(height(existingNode.left)) - int256(height(existingNode.right));
    }

    /// @notice Returns the data of the node
    /// @param _node Address of the node
    /// @return node Data of the node
    function nodeData(address _node) public view returns (Node memory node) {
        node = nodes[_node];
    }

    /// @notice Get total weight of the node
    /// @param node Node to calculate total weight for
    /// @return Total weight of the node
    function _getTotalBalancesIncludingWeight(Node memory node) internal pure returns (uint96) {
        return node.balance + node.sumOfLeftBalances + node.sumOfRightBalances;
    }

    /// @notice Returns the sum of balances of given nodes
    /// @param _nodes List of nodes
    /// @return Sum of balances of given nodes
    function sumOfBalancesOfSelectedNodes(address[] memory _nodes) internal view returns (uint256) {
        uint256 total;
        for (uint256 index = 0; index < _nodes.length; index++) {
            Node memory node = nodes[_nodes[index]];
            total += node.balance;
        }
        return total;
    }

    function calculateUpdatedHeight(Node memory node) internal view returns (uint256) {
        return Math.max(height(node.right), height(node.left)) + 1;
    }

    // function _printNode(address _node) internal view {
    //     Node memory node = nodes[_node];
    //     console2.log("************************************");
    //     console2.log("cluster", node.node);
    //     console2.log("balance", node.balance);
    //     console2.log("left", node.left);
    //     console2.log("right", node.right);
    //     console2.log("sumOfLeftBalances", node.sumOfLeftBalances);
    //     console2.log("sumOfRightBalances", node.sumOfRightBalances);
    //     console2.log(" height", node.height);
    //     console2.log("************************************");
    // }

    // function _printArray(string memory data, bytes memory arrayBytes) internal view {
    //     console2.log(data);
    //     address[] memory array = abi.decode(arrayBytes, (address[]));
    //     console2.log("[");
    //     for (uint256 index = 0; index < array.length; index++) {
    //         console2.log(index, array[index]);
    //     }
    //     console2.log("]");
    // }

    // function _printArray(string memory data, address[] memory array) internal view {
    //     console2.log(data);
    //     console2.log("[");
    //     for (uint256 index = 0; index < array.length; index++) {
    //         console2.log(index, array[index]);
    //     }
    //     console2.log("]");
    // }

    // function _printPaths(string memory data, bytes[] memory bytesdata) internal view {
    //     console2.log(data);

    //     console2.log("[");
    //     for (uint256 index = 0; index < bytesdata.length; index++) {
    //         address[] memory _paths = abi.decode(bytesdata[index], (address[]));
    //         _printArray("subarray ", _paths);
    //     }
    //     console2.log("]");
    // }
}

contract SingleSelector is SelectorHelper {
    constructor() {}

    /// @inheritdoc IClusterSelector
    function insert(address newNode, uint96 balance) public virtual override {
        require(newNode != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[newNode];
        if (node.node == address(0)) {
            root = _insert(root, newNode, balance);
            totalElements++;
        } else {
            // int256 differenceInKeyBalance = int256(clusterBalance) - int256(node.balance);
            _update(root, newNode, int96(balance) - int96(node.balance));
        }
    }

    /// @inheritdoc IClusterSelector
    function deleteNode(address key) public virtual override {
        require(key != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[key];
        require(node.node == key, ClusterLib.NODE_NOT_PRESENT_IN_THE_TREE);
        if (node.node == key) {
            // delete node
            (root) = _deleteNode(root, key, node.balance);
            totalElements--;
        }
    }

    /// @inheritdoc IClusterSelector
    function update(address existingNode, uint96 newBalance) public virtual override {
        require(existingNode != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        if (nodes[existingNode].node == address(0)) {
            assert(false);
        } else {
            int96 differenceInKeyBalance = int96(newBalance) - int96(nodes[existingNode].balance);
            _update(root, existingNode, differenceInKeyBalance);
        }
    }

    /// @notice Search a single node from the tree. Probability of getting selected is proportional to node's balance
    /// @param randomizer random number used for traversing the tree
    /// @return Address of the selected node
    function weightedSearch(uint256 randomizer) public view returns (address) {
        Node memory _root = nodes[root];
        uint256 totalWeightInTree = _getTotalBalancesIncludingWeight(_root);
        uint256 searchNumber = randomizer % totalWeightInTree;
        // console2.log("totalWeightInTree", totalWeightInTree);
        // console2.log("searchNumber", searchNumber);
        return _weightedSearch(root, searchNumber);
    }

    /// @notice internal function to recursively search the node
    /// @param _node address of the node
    /// @param searchNumber random number used for traversing the tree
    /// @return Address of the selected node
    function _weightedSearch(address _node, uint256 searchNumber) public view returns (address) {
        // |-----------sumOfLeftWeight -------|----balance-----|------sumOfRightWeights------|
        Node memory node = nodes[_node];
        (uint256 index1, uint256 index2, uint256 index3) = ClusterLib._getIndexesWithWeights(
            node.sumOfLeftBalances,
            node.balance,
            node.sumOfRightBalances
        );

        if (searchNumber <= index1) {
            return _weightedSearch(node.left, searchNumber);
        } else if (searchNumber > index1 && searchNumber <= index2) {
            return _node;
        } else if (searchNumber > index2 && searchNumber <= index3) {
            return _weightedSearch(node.right, searchNumber - index2);
        } else {
            // _printNode(_node);
            // console2.log("indexes", index1, index2, index3);
            // console2.log("search number", searchNumber);
            revert(ClusterLib.ERROR_OCCURED_DURING_WEIGHTED_SEARCH);
        }
    }

    /// @notice Update the balance of the node
    /// @param root Address of the current node
    /// @param key Address of the key
    /// @param diff Difference in the balance of the key
    function _update(
        address root,
        address key,
        int96 diff
    ) internal {
        Node storage currentNode = nodes[root];
        if (root == key) {
            diff > 0 ? currentNode.balance += uint96(diff) : currentNode.balance -= uint96(-diff);
        } else if (key < root) {
            diff > 0 ? currentNode.sumOfLeftBalances += uint96(diff) : currentNode.sumOfLeftBalances -= uint96(-diff);
            _update(currentNode.left, key, diff);
        } else {
            diff > 0 ? currentNode.sumOfRightBalances += uint96(diff) : currentNode.sumOfRightBalances -= uint96(-diff);
            _update(currentNode.right, key, diff);
        }
    }

    /// @notice Insert the node to the by searching the position where to add
    /// @param node Address of the current node
    /// @param key Address to add
    /// @param keyBalance Balance of the key
    function _insert(
        address node,
        address key,
        uint96 keyBalance
    ) internal returns (address) {
        if (node == address(0)) {
            nodes[key] = _newNode(key, keyBalance);
            return nodes[key].node;
        }

        Node storage currentNode = nodes[node];
        if (key < node) {
            currentNode.left = _insert(currentNode.left, key, keyBalance);
            currentNode.sumOfLeftBalances += keyBalance;
        } else {
            currentNode.right = _insert(currentNode.right, key, keyBalance);
            currentNode.sumOfRightBalances += keyBalance;
        }

        // 2. update the height
        currentNode.height = calculateUpdatedHeight(currentNode);

        // 3. Get the balance factor
        int256 balance = getHeightDifference(node);

        // Left Left Case
        if (balance > 1 && key < currentNode.left) {
            // console2.log("_insert LL Case", keyBalance);
            return _rightRotate(node);
        }

        // Right Right Case
        if (balance < -1 && key > currentNode.right) {
            // console2.log("_insert RR Case", keyBalance);
            return _leftRotate(node);
        }

        // Left Right Case
        if (balance > 1 && key > currentNode.left) {
            // console2.log("_insert LR Case", keyBalance);
            currentNode.left = _leftRotate(currentNode.left);
            return _rightRotate(node);
        }

        // Right Left Case
        if (balance < -1 && key < currentNode.right) {
            // console2.log("_insert RL Case", keyBalance);
            currentNode.right = _rightRotate(currentNode.right);
            return _leftRotate(node);
        }

        return node;
    }

    /// @notice Returns true if the node is present in the tree with non zero balance.
    /// @param _node Address of the node to search
    /// @return True if node is present
    function search(address _node) public view returns (bool) {
        if (_node == address(0)) {
            return false;
        }
        Node memory node = nodes[_node];
        return node.node == _node && node.balance != 0;
    }

    /// @notice Internal function to delete the node from the key
    /// @param _root Current root
    /// @param key Address of the node to be removed
    /// @param existingBalanceOfKey Balance of the key to be deleted
    function _deleteNode(
        address _root,
        address key,
        uint96 existingBalanceOfKey
    ) internal returns (address) {
        // console2.log("At node", _root);
        // console2.log("Element to delete", key);
        // console2.log("Balance of key to delete", existingBalanceOfKey);
        if (_root == address(0)) {
            return (_root);
        }

        Node storage node = nodes[_root];
        if (key < _root) {
            // console2.log("Moving to left");
            node.sumOfLeftBalances -= existingBalanceOfKey;
            (node.left) = _deleteNode(node.left, key, existingBalanceOfKey);
            // console2.log("After Moving to left");
        } else if (key > _root) {
            // console2.log("Moving to right");
            // console2.log("node.sumOfRightBalances", node.sumOfRightBalances);
            node.sumOfRightBalances -= existingBalanceOfKey;
            (node.right) = _deleteNode(node.right, key, existingBalanceOfKey);
            // console2.log("After Moving to right");
        } else {
            // console2.log("Wow! found node to delete");
            // if node.left and node.right are full, select the next smallest element to node.right, replace it with element to be removed
            // if node.right is full and node.left is null, select the next smallest element to node.right, replace it with element to be removed
            // if node.left is full and node.right is null, select node.left, replace it with node.left
            // if node.left and node.right are null, simply delete the element

            if (node.left != address(0) && node.right != address(0)) {
                // console2.log("case 1");
                return _case1OnDelete(_root);
            } else if (node.left == address(0) && node.right != address(0)) {
                // console2.log("case 2");
                return _case2OnDelete(_root);
            } else if (node.left != address(0) && node.right == address(0)) {
                // console2.log("case 3");
                return _case3OnDelete(_root);
            } else if (node.left == address(0) && node.right == address(0)) {
                delete nodes[_root];
                return address(0);
            } else {
                revert(ClusterLib.ERROR_OCCURED_DURING_DELETE);
            }
        }

        node.height = calculateUpdatedHeight(node);

        int256 balance = getHeightDifference(_root);

        if (balance > 1 && getHeightDifference(node.left) >= 0) {
            return (_rightRotate(_root));
        }

        if (balance > 1 && getHeightDifference(node.right) < 0) {
            node.left = _leftRotate(node.left);
            return (_rightRotate(_root));
        }

        if (balance < -1 && getHeightDifference(node.right) <= 0) {
            return (_leftRotate(_root));
        }

        if (balance < -1 && getHeightDifference(node.right) > 0) {
            node.right = _rightRotate(node.right);
            return (_leftRotate(_root));
        }

        return (_root);
    }

    /// @notice Internal function to delete when there exists a left node but no right node
    /// @param _node Address of Node to delete
    /// @return Address of node to replace the deleted node
    function _case3OnDelete(address _node) internal returns (address) {
        Node memory C_ND = nodes[_node];
        delete nodes[_node];

        Node memory SND = nodes[C_ND.left];
        return SND.node;
    }

    ///@notice Internal function to delete when there exist a right node but no left node
    /// @param _node Address of Node to delete
    /// @return Address of node to replace the deleted node
    function _case2OnDelete(address _node) internal returns (address) {
        Node memory C_ND = nodes[_node];
        delete nodes[_node];

        Node memory SND = nodes[C_ND.right];
        return SND.node;
    }

    /// @notice Internal function to delete when both left and right node are defined.
    /// @param _node Address of Node to delete
    /// @return Address of node to replace the deleted node
    function _case1OnDelete(address _node) internal returns (address) {
        // update deletion here

        Node memory C_ND = nodes[_node];
        Node memory nodeRight = nodes[C_ND.right];

        if (nodeRight.left == address(0)) {
            Node storage nodeRightStorage = nodes[C_ND.right];

            nodeRightStorage.left = C_ND.left;
            nodeRightStorage.sumOfLeftBalances = C_ND.sumOfLeftBalances;
            nodeRightStorage.height = 1 + Math.max(height(nodeRightStorage.left), height(nodeRightStorage.right));

            delete nodes[_node];

            return C_ND.right;
        } else {
            // nodes[_node].balance = 0;
            // return _node

            Node memory leastMinNode = _findLeastMinNodeForCase1(C_ND.right);

            C_ND.right = _deleteNode(C_ND.right, leastMinNode.node, leastMinNode.balance);
            delete nodes[_node];

            Node storage lmnStore = nodes[leastMinNode.node];

            // lmn is removed in storage, so create a new one
            lmnStore.node = leastMinNode.node;
            lmnStore.balance = leastMinNode.balance;
            lmnStore.left = C_ND.left;
            lmnStore.right = C_ND.right;
            lmnStore.sumOfLeftBalances = C_ND.sumOfLeftBalances;

            Node memory C_ND_right = nodes[C_ND.right];
            lmnStore.sumOfRightBalances = _getTotalBalancesIncludingWeight(C_ND_right);
            lmnStore.height = calculateUpdatedHeight(lmnStore);

            return leastMinNode.node;
        }
    }

    /// @notice Find the least minimum node for given node
    /// @param _node Address of node from which least min node has to be found
    /// @return Copy of Node that will be replaced
    function _findLeastMinNodeForCase1(address _node) internal view returns (Node memory) {
        Node memory node = nodes[_node];

        if (node.left != address(0)) {
            return _findLeastMinNodeForCase1(node.left);
        }

        return (node);
    }
}

contract ClusterSelector is SingleSelector {
    using ClusterLib for address[];
    using ClusterLib for bytes;

    constructor() SingleSelector() {}

    /// @notice Select top N clusters
    /// @return List of addresses selected
    function selectTopNClusters(uint256 randomizer, uint256 N) public view returns (address[] memory) {
        require(N <= totalElements, ClusterLib.INSUFFICIENT_ELEMENTS_IN_TREE);

        address[] memory _emptyPath = new address[](0);
        address[] memory selectedNodes = new address[](N);
        bytes[] memory pathToSelectedNodes = new bytes[](N);

        for (uint256 index = 0; index < N; index++) {
            pathToSelectedNodes[index] = abi.encode(_emptyPath);
        }

        for (uint256 index = 0; index < N; index++) {
            randomizer = uint256(keccak256(abi.encode(randomizer, index)));
            Node memory _root = nodes[root];
            uint256 totalWeightInTree = _getTotalBalancesIncludingWeight(_root);
            uint256 _sumOfBalancesOfSelectedNodes = sumOfBalancesOfSelectedNodes(selectedNodes);
            uint256 searchNumber = randomizer % (totalWeightInTree - _sumOfBalancesOfSelectedNodes);
            // console2.log("============= search number in iter", index, searchNumber);
            // console2.log("============= _sumOfBalancesOfSelectedNodes", _sumOfBalancesOfSelectedNodes);

            bytes memory currentPath = abi.encode(_emptyPath);
            (address _node, bytes memory _path) = _selectTopCluster(root, searchNumber, selectedNodes, pathToSelectedNodes, currentPath, 0);
            selectedNodes[index] = _node;
            pathToSelectedNodes[index] = _path;
            // console2.log("length of path selected", _path.length);
            // _printArray("path that I need to check", pathToSelectedNodes[index]);
        }
        return selectedNodes;
    }

    /// @notice Select top N Clusters
    /// @param _root Address of the current node (which is referred as root here)
    /// @param searchNumber a random number used to navigate through the tree
    /// @param selectedNodes List of already selected nodes. This node have to ignored while traversing the tree
    /// @param pathsToSelectedNodes Paths to the selected nodes.
    /// @param currentNodePath Stores the current path to the selected node from the root
    /// @param  parentIndex Distance of the selected node from the root
    /// @return Address of the selected node
    /// @return Path to the selected node
    function _selectTopCluster(
        address _root,
        uint256 searchNumber,
        address[] memory selectedNodes,
        bytes[] memory pathsToSelectedNodes,
        bytes memory currentNodePath,
        uint256 parentIndex
    ) internal view returns (address, bytes memory) {
        // console2.log("====================================================================================");
        // console2.log("finding cluster", _root);
        // console2.log("searchNumber", searchNumber);
        // console2.log("parentIndex", parentIndex);
        // _printNode(_root);
        // console2.log("length of parent path", currentNodePath.length);
        // _printArray("Selected clusters", selectedNodes);
        // _printPaths("paths to selected clusters", pathsToSelectedNodes);

        Node memory node = nodes[_root];
        (uint256 leftWeight, uint256 rightWeight) = _getModifiedWeightes(node, selectedNodes, pathsToSelectedNodes);

        // console2.log("leftWeight used for search", leftWeight);
        // console2.log("rightWeight used for searching", rightWeight);

        // if the node is already selected, movie either to left or right
        if (selectedNodes.ifArrayHasElement(_root)) {
            // console2.log("_root is already selected", _root);
            // console2.log("searchNumber", searchNumber);
            // _printArray("selected nodes this _root", selectedNodes);

            (uint256 index1, , uint256 index2) = ClusterLib._getIndexesWithWeights(leftWeight, 0, rightWeight);

            // console2.log("leftWeight", leftWeight);
            // console2.log("node.balance", node.balance);
            // console2.log("rightWeight", rightWeight);
            // console2.log("index1", index1);
            // console2.log("index2", index2);

            currentNodePath = currentNodePath._addAddressToEncodedArray(_root);

            if (searchNumber <= index1) {
                // console2.log(_root, "Selected and moved to left");
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return _selectTopCluster(node.left, searchNumber, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                // console2.log(_root, "Selected and moved to right");
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return
                    _selectTopCluster(node.right, searchNumber - index1, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else {
                revert(ClusterLib.ERROR_OCCURED_DURING_TRAVERSING_SELECTED_NODE);
            }
        }
        // if not selected then, check if it lies between the indexes
        else {
            // console2.log("_root is not selected", _root);
            // console2.log("searchNumber", searchNumber);
            // _printArray("selected nodes this _root", selectedNodes);
            (uint256 index1, uint256 index2, uint256 index3) = ClusterLib._getIndexesWithWeights(leftWeight, node.balance, rightWeight);

            // console2.log("leftWeight", leftWeight);
            // console2.log("node.balance", node.balance);
            // console2.log("rightWeight", rightWeight);
            // console2.log("index1", index1);

            currentNodePath = currentNodePath._addAddressToEncodedArray(_root);

            if (searchNumber <= index1) {
                // console2.log(_root, "Not select and moved to left");
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return _selectTopCluster(node.left, searchNumber, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                // console2.log(_root, "Wow!, Selected");
                // console2.log("case 2");
                // currentNodePath[parentIndex] = _root;
                // parentIndex++;
                return (_root, currentNodePath);
            } else if (searchNumber > index2 && searchNumber <= index3) {
                // console2.log(_root, "Not select and moved to right");
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return
                    _selectTopCluster(node.right, searchNumber - index2, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else {
                revert(ClusterLib.ERROR_OCCURED_DURING_TRAVERSING_NON_SELECTED_NODE);
            }
        }
    }

    /// @notice When a node is selected, the left and right weights have to be reduced in memory
    /// @param node Node to reduce the weights
    /// @param selectedNodes List of selected nodes
    /// @param pathsToSelectedNodes Paths to the selected nodes
    /// @return leftWeight reduced left weight of the node
    /// @return rightWeight reduced right weight of the node
    function _getModifiedWeightes(
        Node memory node,
        address[] memory selectedNodes,
        bytes[] memory pathsToSelectedNodes
    ) internal view returns (uint256 leftWeight, uint256 rightWeight) {
        leftWeight = node.sumOfLeftBalances;
        rightWeight = node.sumOfRightBalances;

        for (uint256 index = 0; index < selectedNodes.length; index++) {
            address[] memory _pathsToSelectedNodes = ClusterLib._getAddressesFromEncodedArray(pathsToSelectedNodes[index]);

            if (_pathsToSelectedNodes.ifArrayHasElement(node.left)) {
                Node memory selectedNode = nodes[selectedNodes[index]];
                leftWeight -= selectedNode.balance;
            }

            if (_pathsToSelectedNodes.ifArrayHasElement(node.right)) {
                Node memory selectedNode = nodes[selectedNodes[index]];
                rightWeight -= selectedNode.balance;
            }
        }
    }
}

/// @title Contract to select the top 5 clusters in an epoch
contract EpochSelector is AccessControl, ClusterSelector, IEpochSelector {
    /// @notice Event emitted when Cluster is selected
    /// @param epoch Number of Epoch
    /// @param cluster Address of cluster
    event ClusterSelected(uint256 indexed epoch, address indexed cluster);

    /// @notice length of epoch
    uint256 public constant epochLength = 4 hours;

    /// @notice timestamp when the selector starts
    uint256 public immutable startTime;

    /// @notice Number of clusters selected in every epoch
    uint256 public immutable numberOfClustersToSelect;

    /// @notice clusters selected during each epoch
    mapping(uint256 => address[]) public clustersSelected;

    /// @notice ID for update role
    bytes32 public constant updaterRole = keccak256(abi.encode("updater")); // find standard format for this

    /// @notice ID for updater admin role
    bytes32 public constant updaterAdminRole = keccak256(abi.encode("updater admin")); // find standard format for this

    constructor(address _admin, uint256 _numberOfClustersToSelect) ClusterSelector() {
        startTime = block.timestamp;
        numberOfClustersToSelect = _numberOfClustersToSelect;
        AccessControl._setRoleAdmin(updaterRole, updaterAdminRole);
        AccessControl._grantRole(updaterAdminRole, _admin);
    }

    /// @notice Current Epoch
    function getCurrentEpoch() public view override returns (uint256) {
        return (block.timestamp - startTime) / epochLength;
    }

    /// @notice Returns the list of selected clusters in the current epoch
    /// @return List of the clusters selected
    function getCurrentClusters() public override returns (address[] memory) {
        uint256 epoch = getCurrentEpoch();
        address[] memory nodes = clustersSelected[epoch];
        if (nodes.length == 0) {
            // select and save from the tree
            clustersSelected[epoch] = selectTopNClusters(block.timestamp, numberOfClustersToSelect);
            nodes = clustersSelected[epoch];
            for (uint256 index = 0; index < nodes.length; index++) {
                emit ClusterSelected(epoch, nodes[index]);
            }
        }
        return nodes;
    }

    /// @inheritdoc IClusterSelector
    function insert(address newNode, uint96 balance) public override(IClusterSelector, SingleSelector) onlyRole(updaterRole) {
        require(newNode != address(0), "address(0) not permitted into entry");
        Node memory node = nodes[newNode];
        if (node.node == address(0)) {
            root = _insert(root, newNode, balance);
            totalElements++;
        } else {
            // int256 differenceInKeyBalance = int256(clusterBalance) - int256(node.balance);
            _update(root, newNode, int96(balance) - int96(node.balance));
        }
    }

    /// @inheritdoc IClusterSelector
    function deleteNode(address key) public override(IClusterSelector, SingleSelector) onlyRole(updaterRole) {
        require(key != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[key];
        require(node.node == key, ClusterLib.NODE_NOT_PRESENT_IN_THE_TREE);
        if (node.node == key) {
            // delete node
            (root) = _deleteNode(root, key, node.balance);
            totalElements--;
        }
    }

    function deleteNodeIfPresent(address key) public override onlyRole(updaterRole) returns (bool) {
        require(key != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        Node memory node = nodes[key];
        if (node.node == key) {
            // delete node
            (root) = _deleteNode(root, key, node.balance);
            totalElements--;
            return true;
        }
        return false;
    }

    /// @inheritdoc IClusterSelector
    function update(address existingNode, uint96 newBalance) public override(IClusterSelector, SingleSelector) onlyRole(updaterRole) {
        require(existingNode != address(0), ClusterLib.CANNOT_BE_ADDRESS_ZERO);
        if (nodes[existingNode].node == address(0)) {
            assert(false);
        } else {
            int96 differenceInKeyBalance = int96(newBalance) - int96(nodes[existingNode].balance);
            _update(root, existingNode, differenceInKeyBalance);
        }
    }
}

