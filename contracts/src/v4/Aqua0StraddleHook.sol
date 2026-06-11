// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {
    BalanceDelta,
    BalanceDeltaLibrary
} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary
} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {
    ModifyLiquidityParams,
    SwapParams
} from "@uniswap/v4-core/types/PoolOperation.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SharedLiquidityPool} from "./SharedLiquidityPool.sol";
import {Aqua0BaseHook} from "./Aqua0BaseHook.sol";
import {StraddleManager} from "../StraddleManager.sol";
import {OptionsMarketplace} from "../OptionsMarketplace.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {console} from "forge-std/console.sol";

/// @title Aqua0StraddleHook
/// @notice Uniswap V4 hook that extends Aqua0's JIT liquidity with options-based IL hedging.
///         When a user removes liquidity, the hook automatically exercises their straddle
///         positions to offset impermanent loss.
///
///   Hook address must have bits 7 (BEFORE_SWAP), 6 (AFTER_SWAP),
///   3 (BEFORE_REMOVE_LIQUIDITY), and 1 (AFTER_REMOVE_LIQUIDITY) set.
///   Required address pattern: ...xx xx00010100 = 0x...94 in the lowest byte.
contract Aqua0StraddleHook is IHooks, Ownable, Aqua0BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    StraddleManager public immutable straddleManager;
    OptionsMarketplace public immutable marketplace;

    // ─── Events ──────────────────────────────────────────────────────────────

    event OptionsExercisedOnWithdraw(
        address indexed user,
        bytes32 indexed poolId,
        int256 unhedgedIL,
        int256 optionsPayout,
        int256 netResult
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        IPoolManager _poolManager,
        SharedLiquidityPool _sharedPool,
        StraddleManager _straddleManager,
        OptionsMarketplace _marketplace
    ) Ownable(msg.sender) Aqua0BaseHook(_poolManager, _sharedPool) {
        straddleManager = _straddleManager;
        marketplace = _marketplace;
    }

    // ─── Fallback ─────────────────────────────────────────────────────────────

    receive() external payable {}

    // ─── IHooks: Permissions ─────────────────────────────────────────────────

    function getHookPermissions()
        public
        pure
        returns (Hooks.Permissions memory)
    {
        return
            Hooks.Permissions({
                beforeInitialize: false,
                afterInitialize: false,
                beforeAddLiquidity: false,
                afterAddLiquidity: false,
                beforeRemoveLiquidity: true,
                afterRemoveLiquidity: true,
                beforeSwap: true,
                afterSwap: true,
                beforeDonate: false,
                afterDonate: false,
                beforeSwapReturnDelta: false,
                afterSwapReturnDelta: false,
                afterAddLiquidityReturnDelta: false,
                afterRemoveLiquidityReturnDelta: false
            });
    }

    // ─── IHooks: No-ops ──────────────────────────────────────────────────────

    function beforeInitialize(
        address, PoolKey calldata, uint160
    ) external pure override returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(
        address, PoolKey calldata, uint160, int24
    ) external pure override returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata
    ) external pure override returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata,
        BalanceDelta, BalanceDelta, bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeDonate(
        address, PoolKey calldata, uint256, uint256, bytes calldata
    ) external pure override returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(
        address, PoolKey calldata, uint256, uint256, bytes calldata
    ) external pure override returns (bytes4) {
        return IHooks.afterDonate.selector;
    }

    // ─── IHooks: Core Swap Routing ────────────────────────────────────────────

    function beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata
    )
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        _addVirtualLiquidity(key);
        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            0
        );
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        (bool hasJIT, ) = _removeVirtualLiquidity(key);
        if (hasJIT) {
            _settleVirtualLiquidityDeltas(key);
        }
        return (IHooks.afterSwap.selector, 0);
    }

    // ─── IHooks: Remove Liquidity (Options Exercise) ─────────────────────────

    /// @notice Before liquidity removal: record the user's pre-removal state
    ///         so we can compute IL after removal completes.
    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        // Store pre-removal balances for IL calculation
        uint256 bal0 = IERC20(token0).balanceOf(address(sharedPool));
        uint256 bal1 = IERC20(token1).balanceOf(address(sharedPool));

        bytes32 ptrBal0 = keccak256(abi.encode(poolId, "preRemoveBal0"));
        bytes32 ptrBal1 = keccak256(abi.encode(poolId, "preRemoveBal1"));
        assembly {
            tstore(ptrBal0, bal0)
            tstore(ptrBal1, bal1)
        }

        console.log("[StraddleHook] beforeRemoveLiquidity");
        console.log("  sender:", sender);
        console.log("  preRemove bal0:", bal0);
        console.log("  preRemove bal1:", bal1);

        return IHooks.beforeRemoveLiquidity.selector;
    }

    /// @notice After liquidity removal: compute IL, exercise user's straddle options
    ///         if they have hedged positions, and settle the payout.
    function afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, BalanceDelta) {
        PoolId poolId = key.toId();
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        // Read pre-removal balances from transient storage
        uint256 preBal0;
        uint256 preBal1;
        bytes32 ptrBal0 = keccak256(abi.encode(poolId, "preRemoveBal0"));
        bytes32 ptrBal1 = keccak256(abi.encode(poolId, "preRemoveBal1"));
        assembly {
            preBal0 := tload(ptrBal0)
            preBal1 := tload(ptrBal1)
        }

        uint256 postBal0 = IERC20(token0).balanceOf(address(sharedPool));
        uint256 postBal1 = IERC20(token1).balanceOf(address(sharedPool));

        console.log("[StraddleHook] afterRemoveLiquidity");
        console.log("  postRemove bal0:", postBal0);
        console.log("  postRemove bal1:", postBal1);

        // Compute simplified IL from the removal
        int256 unhedgedIL = _computeIL(preBal0, preBal1, postBal0, postBal1);

        // Exercise user's straddle if they have one
        int256 optionsPayout = 0;
        try straddleManager.exerciseHedgeOnWithdraw(sender, PoolId.unwrap(poolId), unhedgedIL) returns (
            int256 payout
        ) {
            optionsPayout = payout;
        } catch {
            // User has no hedge or exercise failed — proceed without options
            console.log("  No hedge to exercise for user:", sender);
        }

        int256 netResult = unhedgedIL + optionsPayout;

        console.log("  unhedgedIL:", unhedgedIL / 1e18);
        console.log("  optionsPayout:", optionsPayout / 1e18);
        console.log("  netResult:", netResult / 1e18);

        emit OptionsExercisedOnWithdraw(
            sender,
            PoolId.unwrap(poolId),
            unhedgedIL,
            optionsPayout,
            netResult
        );

        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /// @dev Simplified IL calculation based on token balance changes.
    ///      Positive = gain, negative = loss.
    function _computeIL(
        uint256 preBal0,
        uint256 preBal1,
        uint256 postBal0,
        uint256 postBal1
    ) internal pure returns (int256) {
        // IL = (postBal - preBal) for the pool's holdings
        // Negative means the pool lost value during the removal
        int256 delta0 = int256(postBal0) - int256(preBal0);
        int256 delta1 = int256(postBal1) - int256(preBal1);
        // Return combined IL (in practice would be USD-weighted)
        return delta0 + delta1;
    }
}
