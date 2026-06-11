/**
 * Mock demo data — shown anywhere in the alpha when the backend returns
 * nothing for the active chain. This gives the UI three tangible examples
 * of the product's three venue types:
 *
 *   • SwapVM constant-product strategy  (mWETH / mUSDC)
 *   • SwapVM stable-swap strategy       (mUSDC / mDAI)
 *   • Aqua0 V4 Hook, concentrated       (mWBTC / mUSDC)
 *
 * The mocks are imported by both the pools marketplace (`app/page.tsx`)
 * and the pool detail page (`app/pools/[id]/page.tsx`) so a user clicking
 * "Open →" on a mock card lands on a working detail view.
 *
 * Delete this file once real backend data is flowing end-to-end.
 */

import type { Chain, Strategy, Token } from "./types"
import type { V4Pool } from "./v4-api"

// ---------- Mock tokens ----------
export const MOCK_TOKEN_ETH: Token = {
  symbol: "mWETH",
  name: "Mock Wrapped Ether",
  logo: "/crypto/ETH.png",
  decimals: 18,
  address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
}

export const MOCK_TOKEN_USDC: Token = {
  symbol: "mUSDC",
  name: "Mock USDC",
  logo: "/crypto/USDC.png",
  decimals: 6,
  address: "0x1111111111111111111111111111111111111111",
}

export const MOCK_TOKEN_DAI: Token = {
  symbol: "mDAI",
  name: "Mock DAI",
  logo: "/crypto/DAI.png",
  decimals: 18,
  address: "0x2222222222222222222222222222222222222222",
}

export const MOCK_TOKEN_WBTC: Token = {
  symbol: "mWBTC",
  name: "Mock Wrapped Bitcoin",
  logo: "/crypto/BTC.png",
  decimals: 8,
  address: "0x3333333333333333333333333333333333333333",
}

// ---------- Mock chain ----------
export const MOCK_UNICHAIN_CHAIN: Chain = {
  id: "unichain",
  name: "Unichain Sepolia",
  logo: "/crypto/Unichain.png",
  color: "#FF007A",
}

// ---------- Mock arrays used as fallbacks when the backend is empty/down ----------
export const MOCK_TOKENS: Token[] = [
  MOCK_TOKEN_ETH,
  MOCK_TOKEN_USDC,
  MOCK_TOKEN_DAI,
  MOCK_TOKEN_WBTC,
]

export const MOCK_CHAINS: Chain[] = [MOCK_UNICHAIN_CHAIN]

// ---------- Mock SwapVM strategies ----------
export const MOCK_STRATEGIES: Strategy[] = [
  {
    id: "demo-cp-weth-usdc",
    name: "Constant Product",
    type: "constant-product",
    tokenPair: [MOCK_TOKEN_ETH, MOCK_TOKEN_USDC],
    apy: 24.7,
    tvl: 1_250_000,
    riskLevel: "medium",
    supportedChains: [MOCK_UNICHAIN_CHAIN],
    feeTier: 0.3,
    createdAt: "2026-02-15T00:00:00Z",
  },
  {
    id: "demo-ss-usdc-dai",
    name: "Stable Swap",
    type: "stable-swap",
    tokenPair: [MOCK_TOKEN_USDC, MOCK_TOKEN_DAI],
    apy: 8.3,
    tvl: 4_800_000,
    riskLevel: "low",
    supportedChains: [MOCK_UNICHAIN_CHAIN],
    feeTier: 0.05,
    createdAt: "2026-02-20T00:00:00Z",
  },
]

// ---------- Mock V4 Hook pool (Aqua0-enabled, concentrated) ----------
export const MOCK_POOL_ID =
  "0xdemodemodemodemodemodemodemodemodemodemodemodemodemodemodemodemo"

export const MOCK_POOLS: V4Pool[] = [
  {
    poolId: MOCK_POOL_ID,
    poolKey: {
      currency0: MOCK_TOKEN_WBTC.address,
      currency1: MOCK_TOKEN_USDC.address,
      fee: 3000,
      tickSpacing: 60,
      hooks: "0xaqua0aqua0aqua0aqua0aqua0aqua0aqua0aqua0",
    },
    label: "mWBTC / mUSDC · 0.30%",
    token0: {
      address: MOCK_TOKEN_WBTC.address,
      symbol: MOCK_TOKEN_WBTC.symbol,
      decimals: MOCK_TOKEN_WBTC.decimals,
    },
    token1: {
      address: MOCK_TOKEN_USDC.address,
      symbol: MOCK_TOKEN_USDC.symbol,
      decimals: MOCK_TOKEN_USDC.decimals,
    },
    currentTick: 100000,
    currentPrice: 67848,
    sqrtPriceX96: "0",
    fee: 3000,
    tickSpacing: 60,
    // Bell-curve so the LiquidityAtlas / LiquidityCurve renders nicely
    aggregatedRanges: [
      { tickLower: 96000, tickUpper: 97000, totalLiquidity: "200000000000000" },
      { tickLower: 97000, tickUpper: 98000, totalLiquidity: "500000000000000" },
      { tickLower: 98000, tickUpper: 99000, totalLiquidity: "1200000000000000" },
      { tickLower: 99000, tickUpper: 100000, totalLiquidity: "2500000000000000" },
      { tickLower: 100000, tickUpper: 101000, totalLiquidity: "2500000000000000" },
      { tickLower: 101000, tickUpper: 102000, totalLiquidity: "1200000000000000" },
      { tickLower: 102000, tickUpper: 103000, totalLiquidity: "500000000000000" },
      { tickLower: 103000, tickUpper: 104000, totalLiquidity: "200000000000000" },
    ],
    isAqua0Enabled: true,
  },
]

/** Helper: true if a given poolId matches a mock pool. */
export function isMockPoolId(poolId: string): boolean {
  return MOCK_POOLS.some((p) => p.poolId === poolId)
}

/** Helper: return the mock pool for a given id, or undefined. */
export function getMockPool(poolId: string): V4Pool | undefined {
  return MOCK_POOLS.find((p) => p.poolId === poolId)
}
