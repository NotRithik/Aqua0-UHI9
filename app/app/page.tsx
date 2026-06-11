"use client"

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PoolCard, PoolCardSkeleton } from '@/components/pools/pool-card'
import { useV4Pools } from '@/hooks/use-v4-pools'
import { useWallet } from '@/contexts/wallet-context'
import type { V4Pool } from '@/lib/pools'

const CHAIN_NAMES: Record<number, string> = {
  1301: 'Unichain Sepolia',
}

const CHAIN_PILLS: Record<number, { name: string; logo: string }> = {
  1301: { name: 'Unichain Sepolia', logo: '/crypto/Unichain.png' },
}

export default function PoolsMarketplacePage() {
  const { chainId } = useWallet()
  const activeChainId = chainId || 1301
  const { data: pools, isLoading: isLoadingPools } = useV4Pools(activeChainId)

  const aqua0Pools = useMemo(() => {
    return (pools || []).filter(p => p.isAqua0Enabled)
  }, [pools])

  const chainName = CHAIN_NAMES[activeChainId] ?? `Chain ${activeChainId}`

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.3em] text-white/60">
              <DotMarkMini />
              Explore
            </div>
            <h1 className="text-[clamp(32px,4.5vw,52px)] font-bold leading-none tracking-[-0.025em] text-white">
              Shared liquidity pools
            </h1>
            <p className="mt-4 max-w-[640px] text-[14px] leading-[1.55] text-white/60">
              One deposit, many pools. Your capital earns fees across every
              Aqua0-hooked Uniswap V4 pool — deployed on{' '}
              <span className="border-b border-dotted border-white/40 text-white">
                Unichain Sepolia
              </span>.
            </p>
          </div>
        </div>

        {/* Subbar */}
        <div className="mb-5 mt-10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-white/60">
            <span>
              <span className="font-semibold text-white">{aqua0Pools.length}</span>{' '}
              Aqua0 hook {aqua0Pools.length === 1 ? 'pool' : 'pools'}
            </span>
            <span className="text-white/20">·</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/70">
              <Image
                src={CHAIN_PILLS[activeChainId]?.logo ?? '/crypto/Unichain.png'}
                alt={chainName}
                width={12}
                height={12}
                className="h-3 w-3 rounded-full"
                unoptimized
              />
              {chainName}
            </span>
          </div>
        </div>

        {/* Grid */}
        {isLoadingPools && aqua0Pools.length === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <PoolCardSkeleton key={i} />
            ))}
          </div>
        ) : aqua0Pools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[15px] font-medium text-white">No pools found</p>
            <p className="mt-2 text-[13px] text-white/50">Connect to Unichain Sepolia to see available pools.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {aqua0Pools.map((pool) => (
              <PoolCard
                key={`pool-${pool.poolId}`}
                pool={pool}
                chainId={activeChainId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DotMarkMini() {
  return (
    <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" className="text-[#7FE5E5]">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={c * 4 + 1} y={r * 4 + 1} width="2" height="2" fill="currentColor" />
        )),
      )}
    </svg>
  )
}
