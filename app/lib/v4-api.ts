import { api } from './api-client'

export interface V4Pool {
  poolId: string;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  label: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  currentTick: number;
  currentPrice: number;
  sqrtPriceX96: string;
  fee: number;
  tickSpacing: number;
  realLiquidity?: string;
  aggregatedRanges: {
    tickLower: number;
    tickUpper: number;
    totalLiquidity: string;
  }[];
  isAqua0Enabled: boolean;
}

export interface V4PoolsRegistryResponse {
    chainId: number;
    pools: V4Pool[];
    poolSwapTest?: string;
}

export async function fetchV4PoolsRegistry(chainId: number): Promise<V4PoolsRegistryResponse> {
    return await api.get<V4PoolsRegistryResponse>('v4/pools', { chainId: chainId.toString() });
}

export async function fetchV4Pools(chainId: number): Promise<V4Pool[]> {
    const data = await fetchV4PoolsRegistry(chainId);
    return data.pools || [];
}

export async function fetchV4PoolDetail(chainId: number, poolId: string): Promise<any> {
    return await api.get<any>(`v4/pools/${poolId}`, { chainId: chainId.toString() });
}

export async function fetchUserPositions(chainId: number, userAddress: string): Promise<any[]> {
  const data = await api.get<any>(`v4/lp/positions/${userAddress}`, { chainId: chainId.toString() });
  return data.positions || [];
}

export interface TickRange {
  tickLower: number;
  tickUpper: number;
  totalLiquidity: string;
  priceLower: string;
  priceUpper: string;
  isActive: boolean;
}

export interface TickDataResponse {
  poolId: string;
  chainId: number;
  currentTick: number;
  tickSpacing: number;
  ranges: TickRange[];
}

export async function fetchPoolTickData(chainId: number, poolId: string): Promise<TickDataResponse> {
  return await api.get<TickDataResponse>(`v4/pools/${poolId}/ticks`, { chainId: chainId.toString() });
}

export interface PoolFeeData {
  poolId: string;
  chainId: number;
  isAqua0Enabled: boolean;
  feeRate: number;
  aqua0Fees: { token0: string; token1: string };
  traditionalFees: {
    note: string;
    feeRate: number;
    feeGrowthGlobal0X128?: string;
    feeGrowthGlobal1X128?: string;
    poolLiquidity?: string;
  } | null;
}

export async function fetchPoolFeeData(chainId: number, poolId: string, userAddress?: string): Promise<PoolFeeData> {
  const params: Record<string, string> = { chainId: chainId.toString() };
  if (userAddress) params.user = userAddress;
  return await api.get<PoolFeeData>(`v4/pools/${poolId}/fees`, params);
}

export interface SwapQuoteApiResult {
    poolId: string;
    zeroForOne: boolean;
    amountIn: string; // raw bigint string
    totalAmountOut: string; // raw bigint string (positive = tokens user receives)
    virtualDelta0: string; // change in SharedLiquidityPool token0 balance
    virtualDelta1: string; // change in SharedLiquidityPool token1 balance
}

// POST /v4/pools/quote — exact-math on-chain swap simulation
export async function fetchSwapQuote(
    chainId: number,
    poolId: string,
    zeroForOne: boolean,
    amountInRaw: string,
): Promise<SwapQuoteApiResult> {
    return api.post<SwapQuoteApiResult>('v4/pools/quote', {
        chainId,
        poolId,
        zeroForOne,
        amountIn: amountInRaw,
    });
}
