// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {StateLibrary} from "@uniswap/v4-core/libraries/StateLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";

contract CheckOnChainTest is Test {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    function test_check_pools_on_chain() public {
        string memory json = vm.readFile("deployments/unichain-sepolia.json");
        address pmAddr = vm.parseJsonAddress(json, ".poolManager");
        address usdcAddr = vm.parseJsonAddress(json, ".mockUsdc");
        address wethAddr = vm.parseJsonAddress(json, ".mockWeth");
        address wbtcAddr = vm.parseJsonAddress(json, ".mockWbtc");

        IPoolManager pm = IPoolManager(pmAddr);

        // Pool 1: WETH/USDC 0.3%
        address e0 = usdcAddr < wethAddr ? usdcAddr : wethAddr;
        address e1 = usdcAddr < wethAddr ? wethAddr : usdcAddr;
        PoolKey memory pk1 = PoolKey({
            currency0: Currency.wrap(e0),
            currency1: Currency.wrap(e1),
            fee: 3000, tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        (uint160 sp1, int24 tick1, , uint24 fee1) = StateLibrary.getSlot0(pm, pk1.toId());
        uint128 liq1 = StateLibrary.getLiquidity(pm, pk1.toId());

        console.log("=== Pool 1: WETH/USDC 0.3% ===");
        console.log("  tick:", tick1);
        console.log("  sqrtPrice:", sp1);
        console.log("  liquidity:", liq1);
        console.log("  fee:", fee1);

        // Pool 2: WBTC/USDC 0.3%
        address b0 = usdcAddr < wbtcAddr ? usdcAddr : wbtcAddr;
        address b1 = usdcAddr < wbtcAddr ? wbtcAddr : usdcAddr;
        PoolKey memory pk2 = PoolKey({
            currency0: Currency.wrap(b0),
            currency1: Currency.wrap(b1),
            fee: 3000, tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        (uint160 sp2, int24 tick2, , uint24 fee2) = StateLibrary.getSlot0(pm, pk2.toId());
        uint128 liq2 = StateLibrary.getLiquidity(pm, pk2.toId());

        console.log("=== Pool 2: WBTC/USDC 0.3% ===");
        console.log("  tick:", tick2);
        console.log("  sqrtPrice:", sp2);
        console.log("  liquidity:", liq2);
        console.log("  fee:", fee2);

        // Pool 3: WBTC/USDC 1%
        PoolKey memory pk3 = PoolKey({
            currency0: Currency.wrap(b0),
            currency1: Currency.wrap(b1),
            fee: 10000, tickSpacing: 200,
            hooks: IHooks(address(0))
        });
        (uint160 sp3, int24 tick3, , uint24 fee3) = StateLibrary.getSlot0(pm, pk3.toId());
        uint128 liq3 = StateLibrary.getLiquidity(pm, pk3.toId());

        console.log("=== Pool 3: WBTC/USDC 1% ===");
        console.log("  tick:", tick3);
        console.log("  sqrtPrice:", sp3);
        console.log("  liquidity:", liq3);
        console.log("  fee:", fee3);

        // Assert pools have liquidity
        assertTrue(liq1 > 0, "Pool 1 should have liquidity");
        assertTrue(liq2 > 0, "Pool 2 should have liquidity");
        assertTrue(liq3 > 0, "Pool 3 should have liquidity");
    }
}
