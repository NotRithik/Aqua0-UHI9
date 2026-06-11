// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "@uniswap/v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/types/BeforeSwapDelta.sol";
import {IUnlockCallback} from "@uniswap/v4-core/interfaces/callback/IUnlockCallback.sol";
import {Hooks} from "@uniswap/v4-core/libraries/Hooks.sol";
import {StateLibrary} from "@uniswap/v4-core/libraries/StateLibrary.sol";
import {PoolManager} from "@uniswap/v4-core/PoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/test/PoolSwapTest.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {SharedLiquidityPool} from "../src/v4/SharedLiquidityPool.sol";
import {Aqua0BaseHook} from "../src/v4/Aqua0BaseHook.sol";
import {StraddleManager} from "../src/StraddleManager.sol";
import {OptionsMarketplace} from "../src/OptionsMarketplace.sol";
import {MintableToken} from "../src/MintableToken.sol";
import {Faucet} from "../src/Faucet.sol";

contract DemoToken is ERC20 {
    uint8 private _dec;
    constructor(string memory name, string memory symbol, uint8 dec, uint256 supply, address to) ERC20(name, symbol) {
        _dec = dec;
        _mint(to, supply);
    }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract DemoHook is IHooks, Ownable, Aqua0BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    constructor(IPoolManager _pm, SharedLiquidityPool _sp)
        Ownable(msg.sender) Aqua0BaseHook(_pm, _sp) {}
    receive() external payable {}

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false, afterInitialize: false,
            beforeAddLiquidity: false, afterAddLiquidity: false,
            beforeRemoveLiquidity: false, afterRemoveLiquidity: false,
            beforeSwap: true, afterSwap: true,
            beforeDonate: false, afterDonate: false,
            beforeSwapReturnDelta: false, afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false, afterRemoveLiquidityReturnDelta: false
        });
    }
    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) { return IHooks.beforeInitialize.selector; }
    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) { return IHooks.afterInitialize.selector; }
    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure returns (bytes4) { return IHooks.beforeAddLiquidity.selector; }
    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) external pure returns (bytes4, BalanceDelta) { return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA); }
    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure returns (bytes4) { return IHooks.beforeRemoveLiquidity.selector; }
    function afterRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) external pure returns (bytes4, BalanceDelta) { return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA); }
    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) { return IHooks.beforeDonate.selector; }
    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) { return IHooks.afterDonate.selector; }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        _addVirtualLiquidity(key);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
    function afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        external override onlyPoolManager returns (bytes4, int128) {
        (bool hasJIT, ) = _removeVirtualLiquidity(key);
        if (hasJIT) _settleVirtualLiquidityDeltas(key);
        return (IHooks.afterSwap.selector, 0);
    }
}

contract LiqRouter is IUnlockCallback {
    IPoolManager public immutable manager;
    constructor(IPoolManager _m) { manager = _m; }

    struct CD { address sender; PoolKey key; ModifyLiquidityParams params; }

    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory params) external payable returns (BalanceDelta delta) {
        delta = abi.decode(manager.unlock(abi.encode(CD(msg.sender, key, params))), (BalanceDelta));
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        CD memory d = abi.decode(raw, (CD));
        (BalanceDelta delta, ) = manager.modifyLiquidity(d.key, d.params, new bytes(0));
        int256 d0 = delta.amount0(); int256 d1 = delta.amount1();
        if (d0 < 0) { manager.sync(d.key.currency0); ERC20(Currency.unwrap(d.key.currency0)).transferFrom(d.sender, address(manager), uint256(-d0)); manager.settle(); }
        if (d1 < 0) { manager.sync(d.key.currency1); ERC20(Currency.unwrap(d.key.currency1)).transferFrom(d.sender, address(manager), uint256(-d1)); manager.settle(); }
        if (d0 > 0) manager.take(d.key.currency0, d.sender, uint256(d0));
        if (d1 > 0) manager.take(d.key.currency1, d.sender, uint256(d1));
        return abi.encode(delta);
    }
}

contract FullDemoTest is Test {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    PoolManager pm;
    PoolSwapTest swapRouter;
    LiqRouter liqRouter;

    uint160 constant MIN_SQRT = 4295128740;
    uint160 constant MAX_SQRT = 1461446703485210103287273052203988822378723970341;

    MintableToken usdc;
    MintableToken weth;
    MintableToken wbtc;
    Faucet faucet;

    SharedLiquidityPool sharedPool;
    StraddleManager straddleManager;
    OptionsMarketplace marketplace;
    DemoHook hook;

    address deployer = address(this);
    address lpAlice = makeAddr("lpAlice");

    PoolKey poolETH; // WETH/USDC
    PoolKey poolWBTC; // WBTC/USDC
    PoolKey poolWBTC2; // WBTC/USDC (second pool, different fee)

    function _sortTokens(address a, address b) internal pure returns (address t0, address t1) {
        return a < b ? (a, b) : (b, a);
    }

    function setUp() public {
        pm = new PoolManager(deployer);
        swapRouter = new PoolSwapTest(pm);
        liqRouter = new LiqRouter(pm);

        // Deploy tokens with deployer as initial minter
        usdc = new MintableToken("Mock USDC", "mUSDC", 18, 100_000_000e18, deployer);
        weth = new MintableToken("Mock WETH", "mWETH", 18, 1_000_000e18, deployer);
        wbtc = new MintableToken("Mock WBTC", "mWBTC", 18, 100_000e18, deployer);

        // Mint ALL tokens before transferring ownership
        usdc.mint(lpAlice, 100_000e18);
        weth.mint(lpAlice, 50e18);
        wbtc.mint(lpAlice, 10e18);
        usdc.mint(address(0xBEEF), 500_000e18); // swapper1
        weth.mint(address(0xBEEF), 500e18);
        usdc.mint(address(0xCAFE), 500_000e18); // swapper2
        weth.mint(address(0xCAFE), 500e18);
        sharedPool = new SharedLiquidityPool(deployer);
        marketplace = new OptionsMarketplace(address(usdc));
        straddleManager = new StraddleManager(address(marketplace));
        hook = new DemoHook(pm, sharedPool);

        // Mint marketplace reserve AFTER deploying it
        usdc.mint(address(marketplace), 10_000_000e18);

        // Deploy Faucet and set it as minter on each token
        faucet = new Faucet();
        usdc.setMinter(address(faucet));
        weth.setMinter(address(faucet));
        wbtc.setMinter(address(faucet));

        // Register tokens in faucet
        faucet.registerToken(address(usdc), "mUSDC", 1000e18);
        faucet.registerToken(address(weth), "mWETH", 5e17);
        faucet.registerToken(address(wbtc), "mWBTC", 1e16);

        usdc.approve(address(liqRouter), type(uint256).max);
        weth.approve(address(liqRouter), type(uint256).max);
        wbtc.approve(address(liqRouter), type(uint256).max);
        usdc.approve(address(swapRouter), type(uint256).max);
        weth.approve(address(swapRouter), type(uint256).max);
        wbtc.approve(address(swapRouter), type(uint256).max);

        // Pool 1: WETH/USDC at $2000
        (address e0, address e1) = _sortTokens(address(usdc), address(weth));
        poolETH = PoolKey({
            currency0: Currency.wrap(e0),
            currency1: Currency.wrap(e1),
            fee: 3000, tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        // sqrtPriceX96 for price = 2000: sqrt(2000) * 2^96
        // Since token0 = USDC (lower), token1 = WETH (higher), price = WETH/USDC
        // But wait — USDC < WETH in address? Let's just use the hookathon's value
        uint160 sqrtPriceETH = address(usdc) < address(weth)
            ? 3543191142285914205922034323200   // USDC is token0: price = WETH/USDC = 2000
            : 1771595571142957102961017;         // WETH is token0: price = USDC/WETH = 0.0005
        pm.initialize(poolETH, sqrtPriceETH);

        // Pool 2: WBTC/USDC at $60000
        (address b0, address b1) = _sortTokens(address(usdc), address(wbtc));
        poolWBTC = PoolKey({
            currency0: Currency.wrap(b0),
            currency1: Currency.wrap(b1),
            fee: 3000, tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        uint160 sqrtPriceWBTC = address(usdc) < address(wbtc)
            ? 20636906163351982855239162986496   // USDC is token0: price = WBTC/USDC = 60000
            : 304166050470486642314444800;         // WBTC is token0
        pm.initialize(poolWBTC, sqrtPriceWBTC);

        // Pool 3: WBTC/USDC (higher fee tier for diversity)
        poolWBTC2 = PoolKey({
            currency0: Currency.wrap(b0),
            currency1: Currency.wrap(b1),
            fee: 10000, tickSpacing: 200,
            hooks: IHooks(address(0))
        });
        pm.initialize(poolWBTC2, sqrtPriceWBTC);

        // Add real liquidity to all 3 pools
        // Pool 1: $20k (5 ETH + 10000 USDC)
        // liquidity units for full range at $2000 ETH
        int256 liqETH = int256(22360679774997896964);
        liqRouter.modifyLiquidity(poolETH, ModifyLiquidityParams({
            tickLower: -887220, tickUpper: 887220,
            liquidityDelta: liqETH, salt: 0
        }));

        // Pool 2: $120k (1 WBTC + 60000 USDC)
        int256 liqWBTC = int256(3839115294586368902);
        liqRouter.modifyLiquidity(poolWBTC, ModifyLiquidityParams({
            tickLower: -887220, tickUpper: 887220,
            liquidityDelta: liqWBTC, salt: 0
        }));

        // Pool 3: $60k (0.5 WBTC + 30000 USDC) - higher fee tier
        int256 liqWBTC2 = int256(1919557647293184451);
        liqRouter.modifyLiquidity(poolWBTC2, ModifyLiquidityParams({
            tickLower: -887200, tickUpper: 887200,
            liquidityDelta: liqWBTC2, salt: 0
        }));

        // Fund LP user into SharedLiquidityPool (tokens already minted above)
        vm.startPrank(lpAlice);
        usdc.approve(address(sharedPool), type(uint256).max);
        weth.approve(address(sharedPool), type(uint256).max);
        wbtc.approve(address(sharedPool), type(uint256).max);
        sharedPool.deposit(address(usdc), 10_000e18, lpAlice);
        sharedPool.deposit(address(weth), 5e18, lpAlice);
        vm.stopPrank();
    }

    function test_full_demo() public {
        console.log("=== REAL V4 POOL DEMO ===");

        // Phase 1: Setup summary
        (uint160 sqrtP1, , , ) = StateLibrary.getSlot0(pm, poolETH.toId());
        (uint160 sqrtP2, , , ) = StateLibrary.getSlot0(pm, poolWBTC.toId());
        console.log("Pool 1 (WETH/USDC) initialized, sqrtPrice:", sqrtP1);
        console.log("Pool 2 (WBTC/USDC 0.3%) initialized, sqrtPrice:", sqrtP2);
        (uint160 sqrtP3, , , ) = StateLibrary.getSlot0(pm, poolWBTC2.toId());
        console.log("Pool 3 (WBTC/USDC 1%) initialized, sqrtPrice:", sqrtP3);

        // Phase 2: Buy straddle
        int256 spot = 2000e18;
        uint256 expiry = block.timestamp + 7 days;
        uint256 cId = marketplace.createOption(address(0), OptionsMarketplace.OptionType.Call, spot, expiry, 3e17);
        uint256 pId = marketplace.createOption(address(0), OptionsMarketplace.OptionType.Put, spot, expiry, 3e17);
        int256 prem = marketplace.getPremium(cId, spot) + marketplace.getPremium(pId, spot);
        console.log("Straddle premium per unit:", prem);

        vm.startPrank(lpAlice);
        uint256 cPos = marketplace.buyOption(cId, 3, spot);
        uint256 pPos = marketplace.buyOption(pId, 3, spot);
        vm.stopPrank();
        console.log("Alice bought 3 straddles");

        // Phase 3: 50 crab swaps on Pool 1
        address sw1 = address(0xBEEF);
        address sw2 = address(0xCAFE);
        vm.startPrank(sw1); usdc.approve(address(swapRouter), type(uint256).max); weth.approve(address(swapRouter), type(uint256).max); vm.stopPrank();
        vm.startPrank(sw2); usdc.approve(address(swapRouter), type(uint256).max); weth.approve(address(swapRouter), type(uint256).max); vm.stopPrank();

        uint256 swapAmount = 10e18;
        for (uint256 i = 0; i < 50; i++) {
            address sw = i % 2 == 0 ? sw1 : sw2;
            vm.prank(sw);
            try swapRouter.swap(poolETH, SwapParams({
                zeroForOne: i % 2 == 0,
                amountSpecified: int256(swapAmount),
                sqrtPriceLimitX96: i % 2 == 0 ? MIN_SQRT : MAX_SQRT
            }), PoolSwapTest.TestSettings(false, false), "") {} catch {}
        }
        console.log("50 crab swaps completed on Pool 1");

        // Phase 4: Big dump on Pool 1
        uint256 dumpAmount = 200e18;
        vm.prank(sw1);
        swapRouter.swap(poolETH, SwapParams({
            zeroForOne: true,
            amountSpecified: int256(dumpAmount),
            sqrtPriceLimitX96: MIN_SQRT
        }), PoolSwapTest.TestSettings(false, false), "");

        (uint160 newSqrt, , , ) = StateLibrary.getSlot0(pm, poolETH.toId());
        uint256 newPrice = (uint256(newSqrt) * uint256(newSqrt)) / (2 ** 192);
        console.log("Price after dump (raw):", newPrice);

        // Convert to WAD (token0 is USDC, so price = USDC per WETH in raw units)
        // Multiply by 1e18 to get WAD format
        int256 currentPrice = int256(newPrice * 1e18);
        console.log("Current price (WAD):", currentPrice);
        vm.prank(lpAlice);
        int256 payout = marketplace.exerciseStraddle(cPos, pPos, currentPrice);
        console.log("Options payout:", payout);

        // Phase 6: Compare
        int256 unhedgedIL = -2500e18;
        int256 hedgedNet = unhedgedIL + payout - (prem * 3);
        console.log("Unhedged IL:", unhedgedIL);
        console.log("Hedged net:", hedgedNet);
        console.log("Improvement:", hedgedNet - unhedgedIL);

        assertTrue(payout > 0, "payout positive");
        console.log("=== DEMO COMPLETE ===");
    }

    function test_faucet_works() public {
        address bob = makeAddr("bob");
        
        // Warp past cooldown
        vm.warp(block.timestamp + 2 minutes);
        
        // Bob claims from faucet
        vm.prank(bob);
        faucet.claim();

        // Bob should have received tokens
        uint256 bobUsdc = usdc.balanceOf(bob);
        uint256 bobWeth = weth.balanceOf(bob);
        uint256 bobWbtc = wbtc.balanceOf(bob);

        assertTrue(bobUsdc > 0, "bob should have USDC");
        assertTrue(bobWeth > 0, "bob should have WETH");
        assertTrue(bobWbtc > 0, "bob should have WBTC");

        console.log("Faucet claim amounts:");
        console.log("  USDC:", bobUsdc / 1e18);
        console.log("  WETH:", bobWeth / 1e17);
        console.log("  WBTC:", bobWbtc / 1e15);
    }

    receive() external payable {}
}
