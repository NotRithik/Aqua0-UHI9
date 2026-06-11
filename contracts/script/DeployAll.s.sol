// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/test/PoolSwapTest.sol";

import {MintableToken} from "../src/MintableToken.sol";
import {Faucet} from "../src/Faucet.sol";
import {SharedLiquidityPool} from "../src/v4/SharedLiquidityPool.sol";
import {OptionsMarketplace} from "../src/OptionsMarketplace.sol";
import {StraddleManager} from "../src/StraddleManager.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy PoolManager
        PoolManager pm = new PoolManager(deployer);
        PoolSwapTest swapRouter = new PoolSwapTest(pm);

        // 2. Deploy tokens (deployer is initial minter)
        MintableToken usdc = new MintableToken("Mock USDC", "mUSDC", 18, 100_000_000e18, deployer);
        MintableToken weth = new MintableToken("Mock WETH", "mWETH", 18, 1_000_000e18, deployer);
        MintableToken wbtc = new MintableToken("Mock WBTC", "mWBTC", 18, 100_000e18, deployer);

        // 3. Deploy Aqua0 contracts (while deployer is still minter)
        SharedLiquidityPool sharedPool = new SharedLiquidityPool(deployer);
        OptionsMarketplace marketplace = new OptionsMarketplace(address(usdc));
        usdc.mint(address(marketplace), 10_000_000e18); // Fund marketplace reserve
        StraddleManager straddleManager = new StraddleManager(address(marketplace));

        // 4. Deploy Faucet and transfer minter role
        Faucet faucet = new Faucet();
        usdc.setMinter(address(faucet));
        weth.setMinter(address(faucet));
        wbtc.setMinter(address(faucet));
        faucet.registerToken(address(usdc), "mUSDC", 1000e18);
        faucet.registerToken(address(weth), "mWETH", 5e17);
        faucet.registerToken(address(wbtc), "mWBTC", 1e16);

        vm.stopBroadcast();

        console.log("=== DEPLOYED TO UNICHAIN SEPOLIA ===");
        console.log("PoolManager:", address(pm));
        console.log("SwapRouter:", address(swapRouter));
        console.log("USDC:", address(usdc));
        console.log("WETH:", address(weth));
        console.log("WBTC:", address(wbtc));
        console.log("Faucet:", address(faucet));
        console.log("SharedPool:", address(sharedPool));
        console.log("Marketplace:", address(marketplace));
        console.log("StraddleManager:", address(straddleManager));
    }
}
