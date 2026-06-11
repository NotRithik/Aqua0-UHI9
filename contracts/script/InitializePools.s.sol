// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/types/Currency.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/types/PoolOperation.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";
import {BalanceDelta} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";

contract SetupRouter is IUnlockCallback {
    IPoolManager public immutable manager;
    constructor(IPoolManager _manager) { manager = _manager; }

    struct CallbackData { address sender; PoolKey key; ModifyLiquidityParams params; }

    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params)
        external payable returns (BalanceDelta delta) {
        delta = abi.decode(manager.unlock(abi.encode(CallbackData(msg.sender, key, params))), (BalanceDelta));
    }

    function settle(Currency currency, address sender, uint256 amount) internal {
        if (Currency.unwrap(currency) == address(0)) { manager.settle{value: amount}(); }
        else { manager.sync(currency); ERC20(Currency.unwrap(currency)).transferFrom(sender, address(manager), amount); manager.settle(); }
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        CallbackData memory d = abi.decode(rawData, (CallbackData));
        (BalanceDelta delta, ) = manager.modifyLiquidity(d.key, d.params, new bytes(0));
        int256 d0 = delta.amount0(); int256 d1 = delta.amount1();
        if (d0 < 0) settle(d.key.currency0, d.sender, uint256(-d0));
        if (d1 < 0) settle(d.key.currency1, d.sender, uint256(-d1));
        if (d0 > 0) manager.take(d.key.currency0, d.sender, uint256(d0));
        if (d1 > 0) manager.take(d.key.currency1, d.sender, uint256(d1));
        return abi.encode(delta);
    }
}

contract InitializePools is Script {
    // sqrt(2000) * 2^96 for USDC/WETH pool
    uint160 constant SQRT_PRICE_2000 = 3543191142285914205922034323200;
    // sqrt(60000) * 2^96 for USDC/WBTC pool
    uint160 constant SQRT_PRICE_60000 = 20636906163351982855239162986496;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Load deployment addresses
        string memory json = vm.readFile("deployments/unichain-sepolia.json");
        address poolManagerAddr = vm.parseJsonAddress(json, ".poolManager");
        address usdcAddr = vm.parseJsonAddress(json, ".mockUsdc");
        address wethAddr = vm.parseJsonAddress(json, ".mockWeth");
        address wbtcAddr = vm.parseJsonAddress(json, ".mockWbtc");

        IPoolManager pm = IPoolManager(poolManagerAddr);
        SetupRouter router = new SetupRouter(pm);

        // Approve tokens
        vm.startBroadcast(deployerKey);

        ERC20(usdcAddr).approve(address(router), type(uint256).max);
        ERC20(wethAddr).approve(address(router), type(uint256).max);
        ERC20(wbtcAddr).approve(address(router), type(uint256).max);

        // Pool 1: WETH/USDC at $2000 (0.3% fee)
        address e0 = usdcAddr < wethAddr ? usdcAddr : wethAddr;
        address e1 = usdcAddr < wethAddr ? wethAddr : usdcAddr;
        PoolKey memory poolETH = PoolKey({
            currency0: Currency.wrap(e0),
            currency1: Currency.wrap(e1),
            fee: 3000, tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        uint160 sqrtPriceETH = usdcAddr < wethAddr ? SQRT_PRICE_2000 : 1771595571142957102961017;
        pm.initialize(poolETH, sqrtPriceETH);

        BalanceDelta delta1 = router.modifyLiquidity(poolETH, ModifyLiquidityParams({
            tickLower: -887220, tickUpper: 887220,
            liquidityDelta: int256(2236067977499789696), salt: 0
        }));
        console.log("Pool 1 (WETH/USDC) initialized + liquidity added");

        // Pool 2: WBTC/USDC at $60000 (0.3% fee)
        address b0 = usdcAddr < wbtcAddr ? usdcAddr : wbtcAddr;
        address b1 = usdcAddr < wbtcAddr ? wbtcAddr : usdcAddr;
        PoolKey memory poolWBTC = PoolKey({
            currency0: Currency.wrap(b0),
            currency1: Currency.wrap(b1),
            fee: 3000, tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        uint160 sqrtPriceWBTC = usdcAddr < wbtcAddr ? SQRT_PRICE_60000 : 304166050470486642314444800;
        pm.initialize(poolWBTC, sqrtPriceWBTC);

        BalanceDelta delta2 = router.modifyLiquidity(poolWBTC, ModifyLiquidityParams({
            tickLower: -887220, tickUpper: 887220,
            liquidityDelta: int256(383911529458636890), salt: 0
        }));
        console.log("Pool 2 (WBTC/USDC 0.3%) initialized + liquidity added");

        // Pool 3: WBTC/USDC at $60000 (1% fee)
        PoolKey memory poolWBTC2 = PoolKey({
            currency0: Currency.wrap(b0),
            currency1: Currency.wrap(b1),
            fee: 10000, tickSpacing: 200,
            hooks: IHooks(address(0))
        });
        pm.initialize(poolWBTC2, SQRT_PRICE_60000);

        BalanceDelta delta3 = router.modifyLiquidity(poolWBTC2, ModifyLiquidityParams({
            tickLower: -887200, tickUpper: 887200,
            liquidityDelta: int256(191955764729318445), salt: 0
        }));
        console.log("Pool 3 (WBTC/USDC 1%) initialized + liquidity added");

        vm.stopBroadcast();
        console.log("=== All 3 pools initialized on Unichain Sepolia ===");
    }
}
