"use client"

import { useQuery } from '@tanstack/react-query'
import { parseUnits, formatUnits } from 'viem'
import type { V4Pool } from '@/lib/pools'

export interface SwapQuoteResult {
  amountOut: string
  amountOutRaw: string
  executionPrice: number
  isExactSimulation: boolean
}

export function useSwapQuote(
  pool: V4Pool | undefined,
  tokenIn?: string,
  amountIn?: string,
  decimalsIn?: number,
  decimalsOut?: number,
) {
  const hasInputs = !!pool && !!tokenIn && !!amountIn && Number(amountIn) > 0 &&
    decimalsIn !== undefined && decimalsOut !== undefined

  return useQuery({
    queryKey: ['v4-quote', pool?.poolId, tokenIn, amountIn],
    queryFn: async (): Promise<SwapQuoteResult> => {
      const isToken0 = tokenIn!.toLowerCase() === pool!.token0.address.toLowerCase()
      const priceOf0In1 = Math.pow(1.0001, pool!.currentTick) *
        Math.pow(10, pool!.token0.decimals - pool!.token1.decimals)
      const executionPrice = isToken0 ? priceOf0In1 : (1 / priceOf0In1)
      const feeMultiplier = 1 - (pool!.fee / 1_000_000)
      const outVal = Number(amountIn) * executionPrice * feeMultiplier
      const amountOutStr = outVal.toFixed(Math.min(decimalsOut!, 6))
      const amountOutRaw = parseUnits(amountOutStr, decimalsOut!).toString()

      return {
        amountOut: amountOutStr,
        amountOutRaw,
        executionPrice,
        isExactSimulation: false,
      }
    },
    enabled: hasInputs,
    refetchInterval: 15 * 1000,
    staleTime: 5 * 1000,
  })
}
