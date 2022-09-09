// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// import "./ClusterSelector.sol";

interface IClusterSelector {
    struct Node {
        address cluster; // sorting condition
        uint256 balance;
        address left;
        address right;
        uint256 sumOfLeftBalances;
        uint256 sumOfRightBalances;
        uint256 height;
    }

    function insert(address cluster, uint256 clusterBalance) external;

    function update(address cluster, uint256 clusterBalance) external;
}

interface IEpochSelector is IClusterSelector {
    function getCurrentEpoch() external view returns (uint256);

    function getCurrentClusters() external returns (address[] memory nodes);
}

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

library ClusterLib {
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

    function ifArrayHasElement(address[16] memory array, address element) internal pure returns (bool) {
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

    function ifArrayHasElement(address[17] memory array, address element) internal pure returns (bool) {
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

    function ifArrayHasElement(address[20] memory array, address element) internal pure returns (bool) {
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

    function ifArrayHasElement(address[256] memory array, address element) internal pure returns (bool) {
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

    function ifArrayHasElement(address[32] memory array, address element) internal pure returns (bool) {
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

    function ifArrayHasElement(address[64] memory array, address element) internal pure returns (bool) {
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

    function _getOnlyTwoIndexesWithWeight(uint256 sumOfLeftBalances, uint256 sumOfRightBalances) internal pure returns (uint256, uint256) {
        return (sumOfLeftBalances, sumOfLeftBalances + sumOfRightBalances);
    }

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

abstract contract SelectorHelper is IClusterSelector {
    mapping(address => Node) public nodes;

    uint256 public totalElements;
    address public root;

    function heightOfTheTree() public view returns (uint256) {
        return height(root);
    }

    function height(address cluster) public view returns (uint256) {
        if (cluster == address(0)) return 0;
        return nodes[cluster].height;
    }

    function _newNode(address cluster, uint256 balance) internal pure returns (Node memory node) {
        node = Node(cluster, balance, address(0), address(0), 0, 0, 1);
    }

    // function getNode(address cluster) public view returns (Node memory node) {
    //     node = nodes[cluster];
    // }

    function _rightRotate(address addressOfZ) internal returns (address) {
        if (addressOfZ == address(0)) {
            revert("trying to RR 0");
        }
        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.left];

        // do not rotate if left is 0
        if (y.cluster == address(0)) {
            // console2.log("RR: not because y is 0 ");
            return z.cluster;
        }
        Node storage T3 = nodes[y.right];

        // cut z.left
        z.sumOfLeftBalances = _getTotalBalancesIncludingWeight(T3.cluster);
        z.left = T3.cluster;
        // cut y.right
        y.sumOfRightBalances = _getTotalBalancesIncludingWeight(z.cluster);
        y.right = z.cluster;

        z.height = Math.max(height(z.right), height(z.left)) + 1;
        y.height = Math.max(height(y.right), height(y.left)) + 1;
        return y.cluster;
    }

    function _leftRotate(address addressOfZ) internal returns (address) {
        if (addressOfZ == address(0)) {
            revert("trying to LR 0");
        }
        Node storage z = nodes[addressOfZ];

        Node storage y = nodes[z.right];

        // do not rotate if right is 0
        if (y.cluster == address(0)) {
            // console2.log("LR: not because y is 0 ");
            return z.cluster;
        }
        Node storage T2 = nodes[y.left];

        // cut z.right
        z.sumOfRightBalances = _getTotalBalancesIncludingWeight(T2.cluster);
        z.right = T2.cluster;
        // cut y.left
        y.sumOfLeftBalances = _getTotalBalancesIncludingWeight(z.cluster);
        y.left = z.cluster;

        z.height = Math.max(height(z.left), height(z.right)) + 1;
        y.height = Math.max(height(y.left), height(y.right)) + 1;

        return y.cluster;
    }

    function getBalance(address cluster) public view returns (int256) {
        if (cluster == address(0)) return 0;

        Node memory node = nodes[cluster];

        return int256(height(node.left)) - int256(height(node.right));
    }

    function _getTotalBalancesIncludingWeight(address _node) internal view returns (uint256) {
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

    // function _printArray(string memory data, address[] memory array) internal view {
    //     console2.log(data);
    //     console2.log("[");
    //     for (uint256 index = 0; index < array.length; index++) {
    //         console2.log(array[index]);
    //     }
    //     console2.log("]");
    // }

    // function _printArray(string memory data, address[256] memory array) internal view {
    //     console2.log(data);
    //     console2.log("[");
    //     for (uint256 index = 0; index < array.length; index++) {
    //         console2.log(array[index]);
    //     }
    //     console2.log("]");
    // }
}

contract SingleSelector is AccessControl, SelectorHelper {
    using ClusterLib for address[256];
    using ClusterLib for address[];

    bytes32 public updaterRole = keccak256(abi.encode("updater")); // find standard format for this
    bytes32 public updaterAdminRole = keccak256(abi.encode("updater admin")); // find standard format for this

    constructor(address _admin) {
        AccessControl._setRoleAdmin(updaterRole, updaterAdminRole);
        AccessControl._grantRole(updaterAdminRole, _admin);
    }

    function insert(address cluster, uint256 clusterBalance) public override onlyRole(updaterRole) {
        require(cluster != address(0), "address(0) not permitted into entry");
        Node memory node = nodes[cluster];
        if (node.cluster == address(0)) {
            root = _insert(root, cluster, clusterBalance);
            totalElements++;
        } else {
            // int256 differenceInKeyBalance = int256(clusterBalance) - int256(node.balance);
            _update(root, cluster, int256(clusterBalance) - int256(node.balance));
        }
    }

    function update(address cluster, uint256 clusterBalance) public override onlyRole(updaterRole) {
        require(cluster != address(0), "address(0) not permitted into entry");
        if (nodes[cluster].cluster == address(0)) {
            //
            revert("Can't update if it is not inserted already");
        } else {
            int256 differenceInKeyBalance = int256(clusterBalance) - int256(nodes[cluster].balance);
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

    function _weightedSearch(address _node, uint256 searchNumber) public view returns (address) {
        // |-----------sumOfLeftWeight -------|----balance-----|------sumOfRightWeights------|
        Node memory node = nodes[_node];
        (uint256 index1, uint256 index2, uint256 index3) = _getIndexes(_node);

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
            revert("CS: during single weighted search");
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
        Node storage currentNode = nodes[node];
        if (node == key) {
            diff > 0 ? currentNode.balance += uint256(diff) : currentNode.balance -= uint256(-diff);
        } else if (key < node) {
            diff > 0 ? currentNode.sumOfLeftBalances += uint256(diff) : currentNode.sumOfLeftBalances -= uint256(-diff);
            _update(currentNode.left, key, diff);
        } else if (key > node) {
            diff > 0 ? currentNode.sumOfRightBalances += uint256(diff) : currentNode.sumOfRightBalances -= uint256(-diff);
            _update(currentNode.right, key, diff);
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

        Node storage currentNode = nodes[node];
        if (key < node) {
            currentNode.left = _insert(currentNode.left, key, keyBalance);
            currentNode.sumOfLeftBalances += keyBalance;
        } else if (key > node) {
            currentNode.right = _insert(currentNode.right, key, keyBalance);
            currentNode.sumOfRightBalances += keyBalance;
        } else {
            revert("Duplicate address being tried to insert in the tree");
        }

        // 2. update the height
        currentNode.height = 1 + Math.max(height(currentNode.left), height(currentNode.right));

        // 3. Get the balance factor
        int256 balance = getBalance(node);

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

    function search(address node) public view returns (bool) {
        if (node == address(0)) {
            return false;
        }

        return nodes[node].cluster == node;
    }

    function nodeData(address _node) public view returns (Node memory node) {
        node = nodes[_node];
    }
}

contract ClusterSelector is SingleSelector {
    using ClusterLib for address[];

    constructor(address _admin) SingleSelector(_admin) {}

    function selectTopNClusters(uint256 randomizer, uint256 N) public view returns (address[] memory) {
        require(N <= totalElements, "Can't select more than available elements");

        address[] memory _emptyPath = new address[](0);
        address[] memory selectedNodes = new address[](N);
        bytes[] memory pathToSelectedNodes = new bytes[](N);

        for (uint256 index = 0; index < N; index++) {
            pathToSelectedNodes[index] = abi.encode(_emptyPath);
        }

        for (uint256 index = 0; index < N; index++) {
            randomizer = uint256(keccak256(abi.encode(randomizer, index)));
            uint256 totalWeightInTree = _getTotalBalancesIncludingWeight(root);
            uint256 _sumOfBalancesOfSelectedNodes = sumOfBalancesOfSelectedNodes(selectedNodes);
            uint256 searchNumber = randomizer % (totalWeightInTree - _sumOfBalancesOfSelectedNodes);
            // console2.log("============= search number in iter", index, searchNumber);
            // console2.log("============= _sumOfBalancesOfSelectedNodes", _sumOfBalancesOfSelectedNodes);

            bytes memory currentPath = abi.encode(_emptyPath);
            (address _node, bytes memory _path) = _selectTopCluster(root, searchNumber, selectedNodes, pathToSelectedNodes, currentPath, 0);
            selectedNodes[index] = _node;
            pathToSelectedNodes[index] = _path;
            // _printArray("path that I need to check", pathToSelectedNodes[index]);
        }
        return selectedNodes;
    }

    function _selectTopCluster(
        address _root,
        uint256 searchNumber,
        address[] memory selectedNodes,
        bytes[] memory pathsToSelectedNodes,
        bytes memory currentNodePath,
        uint256 parentIndex
    ) internal view returns (address, bytes memory) {
        // console2.log("finding cluster", _root);
        // console2.log("searchNumber", searchNumber);
        // console2.log("parentIndex", parentIndex);
        // console2.log("length of parent path", currentNodePath.length);
        // _printArray("Selected clusters", selectedNodes);

        Node memory node = nodes[_root];
        (uint256 leftWeight, uint256 rightWeight) = _getModifiedWeightes(node, selectedNodes, pathsToSelectedNodes);

        // console2.log("leftWeight used for search", leftWeight);
        // console2.log("rightWeight used for searching", rightWeight);

        // if the node is already selected, movie either to left or right
        if (selectedNodes.ifArrayHasElement(_root)) {
            // console2.log("_root is already selected", _root);
            // console2.log("searchNumber", searchNumber);
            // _printArray("selected nodes this _root", selectedNodes);
            (uint256 index1, uint256 index2) = ClusterLib._getOnlyTwoIndexesWithWeight(leftWeight, rightWeight);

            // console2.log("leftWeight", leftWeight);
            // console2.log("node.balance", node.balance);
            // console2.log("rightWeight", rightWeight);
            // console2.log("index1", index1);
            // console2.log("index2", index2);

            currentNodePath = _addAddressToEncodedArray(currentNodePath, _root);

            if (searchNumber <= index1) {
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return _selectTopCluster(node.left, searchNumber, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return
                    _selectTopCluster(node.right, searchNumber - index1, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else {
                revert("CS: when node is selected");
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

            currentNodePath = _addAddressToEncodedArray(currentNodePath, _root);

            if (searchNumber <= index1) {
                // console2.log("case 1");
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return _selectTopCluster(node.left, searchNumber, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else if (searchNumber > index1 && searchNumber <= index2) {
                // console2.log("case 2");
                // currentNodePath[parentIndex] = _root;
                // parentIndex++;
                return (_root, currentNodePath);
            } else if (searchNumber > index2 && searchNumber <= index3) {
                // console2.log("case 3");
                // currentNodePath[parentIndex] = _root;
                parentIndex++;
                return
                    _selectTopCluster(node.right, searchNumber - index2, selectedNodes, pathsToSelectedNodes, currentNodePath, parentIndex);
            } else {
                revert("CS: when node is not selected");
            }
        }
    }

    function _getModifiedWeightes(
        Node memory node,
        address[] memory selectedNodes,
        bytes[] memory pathsToSelectedNodes
    ) internal view returns (uint256 leftWeight, uint256 rightWeight) {
        leftWeight = node.sumOfLeftBalances;
        rightWeight = node.sumOfRightBalances;

        for (uint256 index = 0; index < selectedNodes.length; index++) {
            address[] memory _pathsToSelectedNodes = abi.decode(pathsToSelectedNodes[index], (address[]));

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

    // function _addAddressToEncodedArray(
    //     bytes memory array,
    //     address toAdd,
    //     uint256 indexToUse
    // ) internal pure returns (bytes memory) {
    //     address[17] memory _currentNodePath = abi.decode(array, (address[17]));
    //     _currentNodePath[indexToUse] = toAdd;
    //     return abi.encode(_currentNodePath);
    // }

    function _addAddressToEncodedArray(bytes memory array, address toAdd) internal pure returns (bytes memory) {
        address[] memory _currentNodePath = abi.decode(array, (address[]));
        uint256 lengthOfNewPath = _currentNodePath.length + 1;

        address[] memory _newNodePath = new address[](lengthOfNewPath);

        for (uint256 index = 0; index < lengthOfNewPath - 1; index++) {
            _newNodePath[index] = _currentNodePath[index];
        }
        _newNodePath[lengthOfNewPath - 1] = toAdd;
        return abi.encode(_currentNodePath);
    }

    function sumOfBalancesOfSelectedNodes(address[] memory _nodes) internal view returns (uint256) {
        uint256 total;
        for (uint256 index = 0; index < _nodes.length; index++) {
            Node memory node = nodes[_nodes[index]];
            total += node.balance;
        }
        return total;
    }
}

contract EpochSelector is ClusterSelector, IEpochSelector {
    uint256 public constant epochLength = 4 hours;
    uint256 public immutable startTime;

    uint256 public constant numberOfClustersToSelect = 5;

    // clusters selected during each epoch
    mapping(uint256 => address[]) public clustersSelected;

    constructor(address _admin) ClusterSelector(_admin) {
        startTime = block.timestamp;
    }

    function getCurrentEpoch() public view override returns (uint256) {
        return (block.timestamp - startTime) / epochLength;
    }

    function getCurrentClusters() public override returns (address[] memory nodes) {
        uint256 epoch = getCurrentEpoch();
        nodes = clustersSelected[epoch];
        if (nodes.length == 0) {
            // select and save from the tree
            clustersSelected[epoch] = selectTopNClusters(block.timestamp, numberOfClustersToSelect);
        }
        nodes = clustersSelected[epoch];
    }
}

