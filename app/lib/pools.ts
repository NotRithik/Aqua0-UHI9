import type { Address } from 'viem'

export const DEPLOYMENT = {
  chainId: 1301,
  poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
  poolSwapTest: '0xb8065EF54Ee112898F882aad750b36675A2997AF' as Address,
  sharedLiquidityPool: '0xe166babaf979483A63E191d2536876bc00f5D45E' as Address,
  aqua0Hook: '0x11bfe6282D51BA5d4123dbe0e77E6548E87CC0C0' as Address,
  mockUsdc: '0x789Bd53090A4Ed348bA1Cc0E4ADA0f140678Afc8' as Address,
  mockWeth: '0x148bA9A0A88F70962f863482BDc6A3c5049839CB' as Address,
  mockWbtc: '0xe46bA72dAB980A86efE82A1eFbE45dE26588E78E' as Address,
  faucet: '0xBFA4fC3023149d8EE591Ca1F645d5B1d2b923e4E' as Address,
  marketplace: '0x41E06Ee7a045432AfA5B6cc0dA1de2e183d7c8A6' as Address,
  straddleManager: '0xe305aD7a0db627303bF37Be5aA5d135c48247367' as Address,
} as const

export interface HardcodedPool {
  poolId: string
  poolKey: {
    currency0: Address
    currency1: Address
    fee: number
    tickSpacing: number
    hooks: Address
  }
  label: string
  token0: { address: Address; symbol: string; decimals: number }
  token1: { address: Address; symbol: string; decimals: number }
  currentTick: number
  currentPrice: number
  sqrtPriceX96: string
  fee: number
  tickSpacing: number
  realLiquidity: string
  aggregatedRanges: { tickLower: number; tickUpper: number; totalLiquidity: string }[]
  isAqua0Enabled: boolean
}

function makePoolId(key: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string }): string {
  const parts = [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  return '0x' + parts.map(p => Buffer.from(String(p)).toString('hex')).join('').padStart(64, '0').slice(0, 64)
}

export const HARDCODED_POOLS: HardcodedPool[] = [
  {
    poolId: makePoolId({ currency0: DEPLOYMENT.mockWeth, currency1: DEPLOYMENT.mockUsdc, fee: 3000, tickSpacing: 60, hooks: DEPLOYMENT.aqua0Hook }),
    poolKey: { currency0: DEPLOYMENT.mockWeth, currency1: DEPLOYMENT.mockUsdc, fee: 3000, tickSpacing: 60, hooks: DEPLOYMENT.aqua0Hook },
    label: 'mWETH / mUSDC (0.3%)',
    token0: { address: DEPLOYMENT.mockWeth, symbol: 'mWETH', decimals: 18 },
    token1: { address: DEPLOYMENT.mockUsdc, symbol: 'mUSDC', decimals: 18 },
    currentTick: 76012,
    currentPrice: Math.pow(1.0001, 76012),
    sqrtPriceX96: '0',
    fee: 3000,
    tickSpacing: 60,
    realLiquidity: '89400000000000000000',
    aggregatedRanges: [],
    isAqua0Enabled: true,
  },
  {
    poolId: makePoolId({ currency0: DEPLOYMENT.mockUsdc, currency1: DEPLOYMENT.mockWbtc, fee: 3000, tickSpacing: 60, hooks: DEPLOYMENT.aqua0Hook }),
    poolKey: { currency0: DEPLOYMENT.mockUsdc, currency1: DEPLOYMENT.mockWbtc, fee: 3000, tickSpacing: 60, hooks: DEPLOYMENT.aqua0Hook },
    label: 'mUSDC / mWBTC (0.3%)',
    token0: { address: DEPLOYMENT.mockUsdc, symbol: 'mUSDC', decimals: 18 },
    token1: { address: DEPLOYMENT.mockWbtc, symbol: 'mWBTC', decimals: 18 },
    currentTick: 111563,
    currentPrice: Math.pow(1.0001, 111563),
    sqrtPriceX96: '0',
    fee: 3000,
    tickSpacing: 60,
    realLiquidity: '0',
    aggregatedRanges: [],
    isAqua0Enabled: true,
  },
  {
    poolId: makePoolId({ currency0: DEPLOYMENT.mockWeth, currency1: DEPLOYMENT.mockUsdc, fee: 3000, tickSpacing: 60, hooks: '0x0000000000000000000000000000000000000000' }),
    poolKey: { currency0: DEPLOYMENT.mockWeth, currency1: DEPLOYMENT.mockUsdc, fee: 3000, tickSpacing: 60, hooks: '0x0000000000000000000000000000000000000000' as Address },
    label: 'mWETH / mUSDC (0.3%) — Isolated',
    token0: { address: DEPLOYMENT.mockWeth, symbol: 'mWETH', decimals: 18 },
    token1: { address: DEPLOYMENT.mockUsdc, symbol: 'mUSDC', decimals: 18 },
    currentTick: 76012,
    currentPrice: Math.pow(1.0001, 76012),
    sqrtPriceX96: '0',
    fee: 3000,
    tickSpacing: 60,
    realLiquidity: '0',
    aggregatedRanges: [],
    isAqua0Enabled: false,
  },
]

export function getPoolById(poolId: string): HardcodedPool | undefined {
  return HARDCODED_POOLS.find(p => p.poolId === poolId)
}
