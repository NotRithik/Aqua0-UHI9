// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {SharedLiquidityPool} from "../src/v4/SharedLiquidityPool.sol";
import {Aqua0StraddleHook} from "../src/v4/Aqua0StraddleHook.sol";
import {StraddleManager} from "../src/StraddleManager.sol";
import {OptionsMarketplace} from "../src/OptionsMarketplace.sol";

contract DeployStraddle is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy OptionsMarketplace with mock USDC
        // address mockUSDC = vm.envAddress("MOCK_USDC");
        // OptionsMarketplace marketplace = new OptionsMarketplace(mockUSDC);

        // 2. Deploy StraddleManager
        // StraddleManager straddleManager = new StraddleManager(address(marketplace));

        // 3. Deploy SharedLiquidityPool
        // SharedLiquidityPool sharedPool = new SharedLiquidityPool(msg.sender);

        // 4. Deploy Aqua0StraddleHook (requires CREATE2 + HookMiner for valid address bits)
        // Aqua0StraddleHook hook = new Aqua0StraddleHook(
        //     IPoolManager(vm.envAddress("POOL_MANAGER")),
        //     sharedPool,
        //     straddleManager,
        //     marketplace
        // );

        // 5. Fund marketplace reserve
        // IERC20(mockUSDC).approve(address(marketplace), 100_000e18);
        // marketplace.fundReserve(100_000e18);

        vm.stopBroadcast();
    }
}
