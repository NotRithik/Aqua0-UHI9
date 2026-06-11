// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import "forge-std/Script.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/test/PoolSwapTest.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

/// @notice Simulates trading volume on V4 pools for demo purposes.
contract SimulateSwaps is Script {
    address constant ROUTER = 0xb8065EF54Ee112898F882aad750b36675A2997AF;
    address constant HOOK = 0x11bfe6282D51BA5d4123dbe0e77E6548E87CC0C0;
    address constant USDC = 0x789Bd53090A4Ed348bA1Cc0E4ADA0f140678Afc8;
    address constant WETH = 0x148bA9A0A88F70962f863482BDc6A3c5049839CB;

    function run() external {
        uint256 swapperKey = vm.envUint("SWAPPER_PRIVATE_KEY");

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(WETH),
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        vm.startBroadcast(swapperKey);

        IERC20(USDC).approve(ROUTER, type(uint256).max);
        IERC20(WETH).approve(ROUTER, type(uint256).max);

        PoolSwapTest router = PoolSwapTest(ROUTER);
        PoolSwapTest.TestSettings memory ts = PoolSwapTest.TestSettings({ takeClaims: false, settleUsingBurn: false });

        // 50 crab swaps
        for (uint256 i = 0; i < 50; i++) {
            bool zeroForOne = i % 2 == 0;
            int256 amount = zeroForOne ? -1e16 : -5e19;

            router.swap(
                poolKey,
                SwapParams({
                    zeroForOne: zeroForOne,
                    amountSpecified: amount,
                    sqrtPriceLimitX96: zeroForOne ? 4295128740 : 1461446703485210103287273052203988822378723970341
                }),
                ts,
                ""
            );
        }

        // 1 big directional swap
        router.swap(
            poolKey,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -1e20,
                sqrtPriceLimitX96: 4295128740
            }),
            ts,
            ""
        );

        vm.stopBroadcast();
    }
}
