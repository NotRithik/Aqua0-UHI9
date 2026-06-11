// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import "forge-std/Script.sol";
import {SimpleFaucet} from "../src/SimpleFaucet.sol";

/// @dev Deploy SimpleFaucet with the ORIGINAL deployment tokens and fund it
contract DeploySimpleFaucet is Script {
    // Original V4 pool token addresses
    address constant USDC = 0x789Bd53090A4Ed348bA1Cc0E4ADA0f140678Afc8;
    address constant WETH = 0x148bA9A0A88F70962f863482BDc6A3c5049839CB;
    address constant WBTC = 0xe46bA72dAB980A86efE82A1eFbE45dE26588E78E;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // 1. Deploy SimpleFaucet
        SimpleFaucet faucet = new SimpleFaucet();
        console.log("Faucet:", address(faucet));

        // 2. Register tokens
        faucet.registerToken(USDC, "mUSDC", 100_000e18);   // 100k USDC per claim
        faucet.registerToken(WETH, "mWETH", 50e18);        // 50 WETH per claim
        faucet.registerToken(WBTC, "mWBTC", 1e18);         // 1 WBTC per claim

        // 3. Fund the faucet with tokens from deployer
        // transfer(address,uint256) = 0xa9059cbb
        bytes4 sel = bytes4(keccak256("transfer(address,uint256)"));

        uint256 usdcFund = 1_000_000e18;   // 1M USDC
        uint256 wethFund = 50_000e18;       // 50k WETH
        uint256 wbtcFund = 500e18;          // 500 WBTC

        (bool ok1,) = USDC.call(abi.encodeWithSelector(sel, address(faucet), usdcFund));
        require(ok1, "fund USDC failed");
        console.log("Funded USDC:", usdcFund / 1e18);

        (bool ok2,) = WETH.call(abi.encodeWithSelector(sel, address(faucet), wethFund));
        require(ok2, "fund WETH failed");
        console.log("Funded WETH:", wethFund / 1e18);

        (bool ok3,) = WBTC.call(abi.encodeWithSelector(sel, address(faucet), wbtcFund));
        require(ok3, "fund WBTC failed");
        console.log("Funded WBTC:", wbtcFund / 1e18);

        vm.stopBroadcast();

        console.log("Done! Simple faucet deployed and funded.");
    }
}
