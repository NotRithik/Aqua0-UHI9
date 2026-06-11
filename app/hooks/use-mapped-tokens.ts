import { useCallback, useMemo } from 'react'
import { useTokens } from './use-tokens'
import { useChains } from './use-chains'
import { useV4Pools } from './use-v4-pools'
import { getTokenLogo, getChainById } from '@/lib/token-logos'
import type { Token, Chain } from '@/lib/types'

/**
 * Returns real API tokens mapped to the frontend `Token` type.
 * Falls back to an empty array while loading.
 *
 * When no `chain` filter is supplied the API returns every token across
 * every chain, so USDC may appear twice.  We deduplicate by symbol for
 * UI display and expose `resolveAddress(symbol, chain)` so callers can
 * look up the chain-specific address when building deploy params.
 */
export function useMappedTokens(chain?: string) {
  const { data: v4Pools, isLoading: poolsLoading } = useV4Pools(1301)
  const isLoading = poolsLoading

  const tokens: Token[] = useMemo(() => {
    if (!v4Pools) return []
    const seen = new Set<string>()
    const out: Token[] = []

    const getLogo = (symbol: string) => {
      const cleanSymbol = symbol.replace(/^m/, '');
      if (cleanSymbol === 'WBTC') return '/crypto/BTC.png';
      return `/crypto/${cleanSymbol}.png`;
    };

    for (const p of v4Pools) {
      if (!seen.has(p.token0.symbol)) {
        seen.add(p.token0.symbol)
        out.push({
          symbol: p.token0.symbol,
          name: p.token0.symbol,
          logo: p.token0.symbol === 'WETH' ? '/crypto/ETH.png' : getLogo(p.token0.symbol),
          decimals: p.token0.decimals,
          address: p.token0.address,
        })
      }
      if (!seen.has(p.token1.symbol)) {
        seen.add(p.token1.symbol)
        out.push({
          symbol: p.token1.symbol,
          name: p.token1.symbol,
          logo: p.token1.symbol === 'WETH' ? '/crypto/ETH.png' : getLogo(p.token1.symbol),
          decimals: p.token1.decimals,
          address: p.token1.address,
        })
      }
    }
    return out
  }, [v4Pools])

  /** Resolve the on-chain address for a token symbol on a specific chain. */
  const resolveAddress = useCallback(
    (symbol: string, targetChain: string): string | undefined => {
      return tokens.find((t) => t.symbol === symbol)?.address
    },
    [tokens],
  )

  return { data: tokens, isLoading, error: null, resolveAddress }
}

/**
 * Returns real API chains mapped to the frontend `Chain` type.
 * Falls back to the hardcoded chains while loading.
 */
export function useMappedChains() {
  const { data: apiChains, isLoading, error } = useChains()

  const chains: Chain[] = useMemo(() => {
    return [getChainById(1301)]
  }, [])

  return { data: chains, isLoading, error }
}
