// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import "forge-std/Script.sol";
import {MintableToken} from "../src/MintableToken.sol";
import {Faucet} from "../src/Faucet.sol";

contract RedeployFaucet is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy new tokens (deployer is initial minter)
        MintableToken usdc = new MintableToken("Mock USDC", "mUSDC", 18, 1_000_000_000e18, deployer);
        MintableToken weth = new MintableToken("Mock WETH", "mWETH", 18, 10_000_000e18, deployer);
        MintableToken wbtc = new MintableToken("Mock WBTC", "mWBTC", 18, 100_000e18, deployer);

        console.log("USDC:", address(usdc));
        console.log("WETH:", address(weth));
        console.log("WBTC:", address(wbtc));

        // 2. Deploy new faucet
        Faucet faucet = new Faucet();
        console.log("Faucet:", address(faucet));

        // 3. Transfer minter role to faucet
        usdc.setMinter(address(faucet));
        weth.setMinter(address(faucet));
        wbtc.setMinter(address(faucet));

        // 4. Register tokens with new amounts
        faucet.registerToken(address(usdc), "mUSDC", 100_000e18);   // 100k USDC per claim
        faucet.registerToken(address(weth), "mWETH", 50e18);        // 50 WETH per claim
        faucet.registerToken(address(wbtc), "mWBTC", 1e18);         // 1 WBTC per claim

        vm.stopBroadcast();

        console.log("Done!");
    }
}
