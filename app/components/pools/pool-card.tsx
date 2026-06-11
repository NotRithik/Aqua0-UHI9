"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useMemo } from 'react'
import { TokenPairIcon } from '@/components/token-icon'
import type { V4Pool } from '@/lib/pools'

interface PoolCardProps {
  pool: V4Pool
  chainId?: number
}

const CHAIN_PILLS: Record<number, { name: string; logo: string }> = {
  8453: { name: 'Base', logo: '/crypto/Base.png' },
  84532: { name: 'Base Sepolia', logo: '/crypto/Base.png' },
  130: { name: 'Unichain', logo: '/crypto/Unichain.png' },
  1301: { name: 'Unichain Sepolia', logo: '/crypto/Unichain.png' },
  696969: { name: 'Local Anvil', logo: '/crypto/Base.png' },
}

const getLogo = (symbol: string) => {
  const clean = symbol.replace(/^m/, '')
  if (clean === 'WBTC') return '/crypto/BTC.png'
  return `/crypto/${clean}.png`
}

export function PoolCard({ pool, chainId = 1301 }: PoolCardProps) {
  const tokenPair = [
    { ...pool.token0, logo: getLogo(pool.token0.symbol) },
    { ...pool.token1, logo: getLogo(pool.token1.symbol) },
  ]
  const chain = CHAIN_PILLS[chainId] ?? CHAIN_PILLS[1301]

  return (
    <Link
      href={`/pools/${pool.poolId}`}
      className="group flex h-full flex-col rounded-xl border border-white/10 bg-[#0d0d0d] p-5 transition-colors hover:border-white/30"
    >
      {/* Top: pair + name */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenPairIcon tokens={tokenPair as never} size="lg" />
          <div>
            <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">
              {pool.token0.symbol} / {pool.token1.symbol}
            </h3>
            <p className="mt-0.5 text-[11px] text-white/50">
              Uniswap V4 · {(pool.fee / 10000).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Badges: strategy type (violet) + venue (aqua, pulse) */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {/* Strategy type — V4 is always concentrated liquidity */}
        <Badge label="Concentrated" tone="violet" />
        {/* Venue */}
        {pool.isAqua0Enabled ? (
          <Badge label="Hook · Aqua0" tone="aqua" pulse />
        ) : (
          <Badge label="Hook · Classic" tone="aqua" />
        )}
      </div>

      {/* Liquidity heatmap */}
      <div className="mt-4 mb-3">
        <LiquidityAtlas pool={pool} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
        <Metric label="APY" value="—" hint="Live data soon" />
        <Metric label="TVL" value="—" hint="Live data soon" />
        <Metric
          label="Price"
          value={pool.currentPrice.toPrecision(4)}
          mono
        />
      </div>

      {/* Footer: chain + open */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/70">
          <Image
            src={chain.logo}
            alt={chain.name}
            width={12}
            height={12}
            className="h-3 w-3 rounded-full"
            unoptimized
          />
          {chain.name}
        </span>
        <span className="text-[12px] text-white/60 transition-colors group-hover:text-[#7FE5E5]">
          Open →
        </span>
      </div>
    </Link>
  )
}

/* ---------- Badges ---------- */
function Badge({
  label,
  tone,
  pulse,
}: {
  label: string
  tone: 'aqua' | 'neutral' | 'dim' | 'violet' | 'sky' | 'amber'
  pulse?: boolean
}) {
  const styles = {
    aqua: 'border-[#7FE5E5]/30 bg-[#7FE5E5]/10 text-[#7FE5E5]',
    neutral: 'border-white/10 bg-white/[0.04] text-white/80',
    dim: 'border-white/10 bg-white/[0.02] text-white/50',
    violet: 'border-violet-300/30 bg-violet-300/10 text-violet-200',
    sky: 'border-sky-300/30 bg-sky-300/10 text-sky-200',
    amber: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
  }[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${styles}`}
    >
      {pulse && (
        <span className="h-1 w-1 rounded-full bg-current shadow-[0_0_4px_currentColor]" />
      )}
      {label}
    </span>
  )
}

function Metric({
  label,
  value,
  hint,
  mono,
}: {
  label: string
  value: string
  hint?: string
  mono?: boolean
}) {
  return (
    <div title={hint}>
      <p className="text-[10px] uppercase tracking-[0.1em] text-white/40">
        {label}
      </p>
      <p
        className={`mt-1 text-[14px] font-semibold text-white ${
          ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

/* ---------- Mini liquidity heatmap ----------
   For Aqua0-enabled V4 hooks: each bar is split into two stacked segments,
   representing the real seed liquidity (bottom, white) vs the virtual JIT
   liquidity drawn from the Aqua0 Shared Pool (top, aqua).
   For classic V4 pools: single-color white bars (all real liquidity).
*/
const REAL_LIQUIDITY_RATIO = 0.22 // ~22% real seed, ~78% shared (visual approx)

function LiquidityAtlas({ pool }: { pool: V4Pool }) {
  const BUCKETS = 31
  const cells = useMemo(() => {
    const ranges = pool.aggregatedRanges ?? []
    if (ranges.length === 0) {
      // Synthetic bell curve fallback so empty pools still render
      const center = Math.floor(BUCKETS / 2)
      return Array.from({ length: BUCKETS }, (_, i) => {
        const d = Math.abs(i - center)
        return Math.exp(-(d * d) / (2 * 4 * 4))
      })
    }
    const minTick = Math.min(...ranges.map((r) => r.tickLower))
    const maxTick = Math.max(...ranges.map((r) => r.tickUpper))
    const tickStep = (maxTick - minTick) / BUCKETS || 1
    const bins = new Array(BUCKETS).fill(0)
    ranges.forEach((r) => {
      const liq = Number(r.totalLiquidity) || 0
      for (let i = 0; i < BUCKETS; i++) {
        const binStart = minTick + i * tickStep
        const binEnd = binStart + tickStep
        if (binEnd >= r.tickLower && binStart <= r.tickUpper) bins[i] += liq
      }
    })
    const max = Math.max(...bins, 1)
    return bins.map((v) => v / max)
  }, [pool.aggregatedRanges])

  const isAqua0 = pool.isAqua0Enabled
  const center = Math.floor(BUCKETS / 2)

  return (
    <div>
      <div className="relative h-12">
        <div className="absolute inset-0 flex items-end gap-px">
          {cells.map((v, i) => {
            const isCenter = i === center
            const barHeight = Math.max(8, v * 100)

            if (isAqua0) {
              // Stacked: real (bottom, white) + shared (top, aqua)
              return (
                <div
                  key={i}
                  className="flex flex-1 items-end"
                  style={{ height: '100%' }}
                >
                  <div
                    className="relative w-full"
                    style={{ height: `${barHeight}%` }}
                  >
                    {/* Shared liquidity (top portion — Aqua0 JIT) */}
                    <div
                      className="absolute left-0 right-0 top-0 bg-[#7FE5E5]"
                      style={{
                        height: `${(1 - REAL_LIQUIDITY_RATIO) * 100}%`,
                        opacity: isCenter ? 0.95 : 0.35 + v * 0.45,
                      }}
                    />
                    {/* Real liquidity (bottom portion — seed deposit) */}
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-white"
                      style={{
                        height: `${REAL_LIQUIDITY_RATIO * 100}%`,
                        opacity: isCenter ? 0.9 : 0.4 + v * 0.3,
                      }}
                    />
                  </div>
                </div>
              )
            }

            // Classic V4 pool — single-color white bars
            return (
              <div
                key={i}
                className="flex flex-1 items-end"
                style={{ height: '100%' }}
              >
                <div
                  className={`w-full ${isCenter ? 'bg-[#7FE5E5]' : 'bg-white'}`}
                  style={{
                    height: `${barHeight}%`,
                    opacity: isCenter ? 0.85 : 0.15 + v * 0.5,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend — only for Aqua0 hooks to explain the two liquidity layers */}
      {isAqua0 && (
        <div className="mt-2 flex items-center gap-3 text-[9px] uppercase tracking-[0.1em] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm bg-white opacity-70" />
            Real
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm bg-[#7FE5E5]" />
            Shared · Aqua0
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------- Skeleton ---------- */
export function PoolCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-4 w-20 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
      </div>
      <div className="mt-4 mb-3 h-12 animate-pulse rounded bg-white/[0.04]" />
      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 w-8 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-12 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <div className="h-5 w-20 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-12 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  )
}
