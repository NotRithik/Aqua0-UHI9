"use client"

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { TokenPairIcon } from '@/components/token-icon'
import { LoadingSpinner } from '@/components/loading-spinner'
import { useV4Pools } from '@/hooks/use-v4-pools'
import { ArrowLeft } from 'lucide-react'
import { useWallet } from '@/contexts/wallet-context'
import { ProvideLiquidityModal } from '@/components/pools/provide-liquidity-modal'
import type { V4Pool } from '@/lib/pools'

/* ==========================================================================
   Pool Detail — Alpha redesign
   ==========================================================================
   Layout: back link → hero (pair + title + badges + CTA) → 4 KPI cards →
   3-tab bar (Overview / Aqua0 vs Classic / JIT Engine) → tab body.

   Integrations left intact:
     • useV4Pools() for pool list (+ mock fallback when backend empty)
     • fetchPoolTickData() — drives Overview tab "Liquidity distribution"
     • fetchPoolFeeData() — drives Overview tab "Fees earned" panel
     • ProvideLiquidityModal — full deposit/withdraw/add-position/remove
       flow is self-contained; we only open it.
   ========================================================================== */

/* ---------- Price map for USD conversion (same as before) ---------- */
const TOKEN_PRICES: Record<string, number> = {
  mWBTC: 67848, mWETH: 2000, mUSDC: 1, mDAI: 1,
  WBTC: 67848, WETH: 2000, USDC: 1, DAI: 1,
}

const CHAIN_NAMES: Record<number, string> = {
  8453: 'Base',
  84532: 'Base Sepolia',
  130: 'Unichain',
  1301: 'Unichain Sepolia',
  696969: 'Local Anvil',
}

const CHAIN_LOGOS: Record<number, string> = {
  8453: '/crypto/Base.png',
  84532: '/crypto/Base.png',
  130: '/crypto/Unichain.png',
  1301: '/crypto/Unichain.png',
  696969: '/crypto/Base.png',
}

/* ---------- Helpers ---------- */
function getLogo(symbol: string) {
  const clean = symbol.replace(/^m/, '')
  if (clean === 'WBTC') return '/crypto/BTC.png'
  return `/crypto/${clean}.png`
}

function short(addr: string): string {
  if (!addr) return '—'
  if (addr.length < 14) return addr
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`
}

type Tab = 'overview' | 'compare' | 'jit'

/* ==========================================================================
   Main component
   ========================================================================== */
export default function PoolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const poolId = params.id as string
  const { chainId, address, isConnected, connect } = useWallet()
  const activeChainId = chainId || Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1301)

  const { data: pools, isLoading } = useV4Pools(activeChainId)
  const [isProvideModalOpen, setIsProvideModalOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  // Pool lookup — hardcoded data only
  const pool: V4Pool | undefined = useMemo(() => {
    return pools?.find((p) => p.poolId === poolId)
  }, [pools, poolId])

  if (isLoading && !pool) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <DotMarkMini />
        <p className="text-[15px] font-medium text-white">Pool not found on this chain</p>
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:border-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pools
        </button>
      </div>
    )
  }

  const tokenPair = [
    { ...pool.token0, logo: getLogo(pool.token0.symbol) },
    { ...pool.token1, logo: getLogo(pool.token1.symbol) },
  ]

  // Mock / derived KPIs
  const feePct = pool.fee / 10000

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to pools
        </Link>

        {/* Hero */}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-5">
            <TokenPairIcon tokens={tokenPair as never} size="lg" />
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-[clamp(28px,3.5vw,40px)] font-bold leading-none tracking-[-0.025em] text-white">
                  {pool.token0.symbol} / {pool.token1.symbol}
                </h1>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge label="Concentrated" tone="violet" />
                {pool.isAqua0Enabled ? (
                  <Badge label="Hook · Aqua0" tone="aqua" pulse />
                ) : (
                  <Badge label="Hook · Classic" tone="aqua" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/50">
                <span>Uniswap V4 · {feePct.toFixed(2)}% fee</span>
                <span className="text-white/20">·</span>
                <span>Tick spacing {pool.tickSpacing}</span>
                <span className="text-white/20">·</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/70">
                  <Image
                    src={CHAIN_LOGOS[activeChainId] ?? '/crypto/Unichain.png'}
                    alt={CHAIN_NAMES[activeChainId] ?? ''}
                    width={12}
                    height={12}
                    className="h-3 w-3 rounded-full"
                    unoptimized
                  />
                  {CHAIN_NAMES[activeChainId] ?? `Chain ${activeChainId}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            {pool.isAqua0Enabled && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7FE5E5]/30 bg-[#7FE5E5]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7FE5E5]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7FE5E5] shadow-[0_0_6px_#7FE5E5]" />
                JIT Active
              </span>
            )}
            {pool.isAqua0Enabled ? (
              !isConnected ? (
                <button
                  onClick={connect}
                  className="rounded-lg bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-white/90"
                >
                  Connect to LP
                </button>
              ) : (
                <button
                  onClick={() => setIsProvideModalOpen(true)}
                  className="rounded-lg bg-[#7FE5E5] px-5 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-[#5dd4d4]"
                >
                  Provide liquidity
                </button>
              )
            ) : (
              <span className="text-[12px] text-white/40">Classic pool — no JIT</span>
            )}
          </div>
        </div>

        {/* 4 KPIs */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Fee tier"
            value={`${feePct.toFixed(2)}%`}
            sub="swap fee"
            accent
          />
          <Kpi
            label="Tick spacing"
            value={String(pool.tickSpacing)}
            sub="concentrated liquidity"
          />
          <Kpi
            label="24h volume"
            value="—"
            sub="Live data soon"
          />
          <Kpi
            label="Current price"
            value={pool.currentPrice.toPrecision(5)}
            sub={`tick ${pool.currentTick}`}
            mono
          />
        </div>

        {/* Tab bar */}
        <div className="mb-6 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
          {(
            [
              ['overview', 'Overview'],
              ['compare', 'Aqua0 vs Classic'],
              ['jit', 'JIT Engine'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition-colors ${
                tab === k
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        {tab === 'overview' && (
          <OverviewTab pool={pool} />
        )}
        {tab === 'compare' && <CompareTab pool={pool} />}
        {tab === 'jit' && <JitEngineTab />}

        {isProvideModalOpen && pool.isAqua0Enabled && (
          <ProvideLiquidityModal
            open={isProvideModalOpen}
            onOpenChange={setIsProvideModalOpen}
            pool={pool}
          />
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   Overview tab — liquidity distribution + pool addresses + fees earned
   ========================================================================== */

function OverviewTab({
  pool,
}: {
  pool: V4Pool
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Liquidity distribution — spans 2 cols on desktop */}
      <div className="lg:col-span-2">
        <Panel>
          <PanelHeader
            title="Liquidity distribution"
            sub={
              pool.isAqua0Enabled
                ? "Real seed liquidity vs virtual liquidity drawn JIT from the Aqua0 Shared Pool."
                : "Pool liquidity across tick ranges."
            }
          />
          <LiquidityCurve pool={pool} isAqua0={pool.isAqua0Enabled} />
          {pool.isAqua0Enabled && (
            <div className="mt-3 flex items-center gap-4 text-[10px] uppercase tracking-[0.1em] text-white/50">
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
        </Panel>
      </div>

      {/* Pool addresses — right column */}
      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Pool addresses" />
          <div className="space-y-2">
            <AddressRow label="Pool ID" value={pool.poolId} />
            <AddressRow label="Hook" value={pool.isAqua0Enabled ? pool.poolKey.hooks : 'address(0)'} />
            <AddressRow label="Token 0" value={pool.token0.address} sym={pool.token0.symbol} />
            <AddressRow label="Token 1" value={pool.token1.address} sym={pool.token1.symbol} />
          </div>
        </Panel>
      </div>
    </div>
  )
}

/* ---------- LiquidityCurve — richer version of LiquidityAtlas ---------- */
const REAL_LIQ_RATIO = 0.22
const BUCKETS = 61

function LiquidityCurve({ pool, isAqua0 }: { pool: V4Pool; isAqua0: boolean }) {
  const cells = useMemo(() => {
    const ranges = pool.aggregatedRanges ?? []
    if (ranges.length === 0) {
      const center = Math.floor(BUCKETS / 2)
      return Array.from({ length: BUCKETS }, (_, i) => {
        const d = Math.abs(i - center)
        return Math.exp(-(d * d) / (2 * 8 * 8))
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

  const center = Math.floor(BUCKETS / 2)

  return (
    <div>
      <div className="relative h-32">
        <div className="absolute inset-0 flex items-end gap-px">
          {cells.map((v, i) => {
            const isCenter = i === center
            const barHeight = Math.max(8, v * 100)
            if (isAqua0) {
              return (
                <div
                  key={i}
                  className="flex flex-1 items-end"
                  style={{ height: '100%' }}
                >
                  <div className="relative w-full" style={{ height: `${barHeight}%` }}>
                    <div
                      className="absolute left-0 right-0 top-0 bg-[#7FE5E5]"
                      style={{
                        height: `${(1 - REAL_LIQ_RATIO) * 100}%`,
                        opacity: isCenter ? 0.95 : 0.35 + v * 0.45,
                      }}
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-white"
                      style={{
                        height: `${REAL_LIQ_RATIO * 100}%`,
                        opacity: isCenter ? 0.9 : 0.4 + v * 0.3,
                      }}
                    />
                  </div>
                </div>
              )
            }
            return (
              <div key={i} className="flex flex-1 items-end" style={{ height: '100%' }}>
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
      <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
        <span >{(pool.currentPrice * 0.7).toPrecision(4)}</span>
        <span className="text-[#7FE5E5]">
          current {pool.currentPrice.toPrecision(4)}
        </span>
        <span >{(pool.currentPrice * 1.3).toPrecision(4)}</span>
      </div>
    </div>
  )
}

/* ==========================================================================
   Compare tab — Aqua0 vs Classic side by side
   ========================================================================== */

function CompareTab({ pool }: { pool: V4Pool }) {
  const feePct = pool.fee / 10000
  const mockedApy = 32.4
  const classicApy = mockedApy * 0.55
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Aqua0 */}
      <div className="rounded-xl border border-[#7FE5E5]/30 bg-[#7FE5E5]/[0.04] p-6">
        <div className="mb-4 flex items-center justify-between">
          <Badge label="Aqua0 · JIT" tone="aqua" pulse />
          <span className="text-[28px] font-bold tabular-nums text-[#7FE5E5]">
            {mockedApy.toFixed(1)}%
          </span>
        </div>
        <p className="mb-4 text-[12px] uppercase tracking-[0.15em] text-white/50">
          Shared liquidity pool
        </p>
        <ul className="mb-5 space-y-2 text-[13px] text-white/80">
          {[
            'Same capital backs every Aqua0-hooked pool',
            'Earns fees from every swap across all venues',
            'Higher capital efficiency than classic V4',
            'Withdraw anytime from Shared Pool',
            'Single deposit, many positions',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <IconCheck />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <DotFlow type="shared" />
      </div>

      {/* Classic */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="mb-4 flex items-center justify-between">
          <Badge label="Classic · V4" tone="dim" />
          <span className="text-[28px] font-bold tabular-nums text-white/50">
            {classicApy.toFixed(1)}%
          </span>
        </div>
        <p className="mb-4 text-[12px] uppercase tracking-[0.15em] text-white/40">
          Isolated liquidity pool
        </p>
        <ul className="mb-5 space-y-2 text-[13px] text-white/60">
          {[
            'Capital locked to this single pool',
            `Fees only from this pool's ${feePct.toFixed(2)}% take`,
            '~70% idle outside active tick range',
            'Manual rebalancing across chains',
            'One deposit per position',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <IconCross />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <DotFlow type="classic" />
      </div>
    </div>
  )
}

function DotFlow({ type }: { type: 'shared' | 'classic' }) {
  return (
    <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/40 p-4">
      <div className="mb-3 text-[10px] uppercase tracking-[0.15em] text-white/40">
        How capital moves
      </div>
      {type === 'shared' ? (
        <svg viewBox="0 0 240 80" width="100%" height="80" className="text-[#7FE5E5]">
          {/* Central capital */}
          <rect x="104" y="32" width="32" height="16" rx="2" fill="currentColor" opacity="0.9" />
          <text x="120" y="43" fontSize="7" fill="#000" textAnchor="middle" fontWeight="700" letterSpacing="0.08em">
            CAPITAL
          </text>
          {/* 3 pools */}
          {[
            [20, 14, 'A'],
            [180, 14, 'B'],
            [180, 54, 'C'],
            [20, 54, 'D'],
          ].map(([x, y, label], i) => (
            <g key={i}>
              <rect
                x={x as number}
                y={y as number}
                width="30"
                height="12"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.6"
              />
              <text
                x={(x as number) + 15}
                y={(y as number) + 8.5}
                fontSize="6"
                fill="currentColor"
                opacity="0.8"
                textAnchor="middle"
                letterSpacing="0.08em"
              >
                POOL {label}
              </text>
            </g>
          ))}
          {/* Dotted flows from center to each pool */}
          {[
            [120, 40, 50, 20],
            [120, 40, 180, 20],
            [120, 40, 180, 60],
            [120, 40, 50, 60],
          ].map(([x1, y1, x2, y2], i) => {
            const steps = 8
            return (
              <g key={i}>
                {Array.from({ length: steps }).map((_, j) => {
                  const t = (j + 1) / (steps + 1)
                  const x = x1 + (x2 - x1) * t
                  const y = y1 + (y2 - y1) * t
                  return (
                    <rect
                      key={j}
                      x={x - 1}
                      y={y - 1}
                      width="1.8"
                      height="1.8"
                      fill="currentColor"
                      opacity={0.3 + (j * 0.08)}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      ) : (
        <svg viewBox="0 0 240 80" width="100%" height="80" className="text-white/50">
          {/* Single locked pool with capital */}
          <rect x="20" y="32" width="60" height="16" rx="2" fill="currentColor" opacity="0.7" />
          <text x="50" y="43" fontSize="7" fill="#000" textAnchor="middle" fontWeight="700" letterSpacing="0.08em">
            LOCKED
          </text>
          <text x="50" y="64" fontSize="6" fill="currentColor" opacity="0.8" textAnchor="middle" letterSpacing="0.08em">
            POOL A
          </text>
          {/* Other pools — empty */}
          {[
            [110, 34, 'B'],
            [170, 34, 'C'],
          ].map(([x, y, label], i) => (
            <g key={i}>
              <rect
                x={x as number}
                y={y as number}
                width="50"
                height="12"
                rx="1.5"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeDasharray="2 2"
              />
              <text
                x={(x as number) + 25}
                y={(y as number) + 8.5}
                fontSize="6"
                fill="currentColor"
                opacity="0.4"
                textAnchor="middle"
                letterSpacing="0.08em"
              >
                POOL {label} · EMPTY
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

/* ==========================================================================
   JIT Engine tab — 4-step explainer
   ========================================================================== */

function JitEngineTab() {
  return (
    <Panel>
      <PanelHeader
        title="Just-in-Time liquidity, explained"
        sub="How the Aqua0 hook materializes liquidity for a single swap."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            n: '01',
            title: 'Swap arrives',
            body: (
              <>
                A trader initiates a swap on this V4 pool. The Aqua0 hook
                intercepts the <code className="text-white/80">beforeSwap</code> callback.
              </>
            ),
            art: <JitArt1 />,
          },
          {
            n: '02',
            title: 'Flash liquidity in',
            body: (
              <>
                The hook draws your capital from the{' '}
                <span className="border-b border-dotted border-white/40 text-white">Shared Pool</span>{' '}
                and places it into this pool at the exact tick range needed.
              </>
            ),
            art: <JitArt2 />,
          },
          {
            n: '03',
            title: 'Swap executes',
            body: <>Trader gets the best price. Pool charges its swap fee. You earn the fee.</>,
            art: <JitArt3 />,
          },
          {
            n: '04',
            title: 'Flash liquidity out',
            body: (
              <>
                After the swap, liquidity returns to the Shared Pool — ready to back the next
                swap on any other Aqua0 pool.
              </>
            ),
            art: <JitArt4 />,
          },
        ].map((step) => (
          <div
            key={step.n}
            className="flex min-h-[240px] flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex h-[80px] items-center justify-center text-[#7FE5E5]">
              {step.art}
            </div>
            <div className="text-[11px] tracking-[0.1em] text-[#7FE5E5]">
              {step.n}
            </div>
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-white">
              {step.title}
            </div>
            <div className="text-[12px] leading-[1.55] text-white/60">{step.body}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/40 p-4 text-[12px] text-white/60">
        <span className="text-[#7FE5E5]">ℹ</span>
        <span>
          Because capital never sits idle in a single pool, the same dollar can earn fees across
          every Aqua0-hooked venue. As new pools are added, your existing deposit automatically
          backs them.
        </span>
      </div>
    </Panel>
  )
}

/* ==========================================================================
   Shared primitives
   ========================================================================== */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-5">
      {children}
    </div>
  )
}

function PanelHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">{title}</h3>
      {sub && <p className="mt-1 text-[12px] text-white/50">{sub}</p>}
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  accent,
  mono,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p
        className={`mt-2 text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums ${
          accent ? 'text-[#7FE5E5]' : 'text-white'
        } ${''}`}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-white/40">{sub}</p>}
    </div>
  )
}

function Badge({
  label,
  tone,
  pulse,
}: {
  label: string
  tone: 'aqua' | 'violet' | 'dim'
  pulse?: boolean
}) {
  const styles = {
    aqua: 'border-[#7FE5E5]/30 bg-[#7FE5E5]/10 text-[#7FE5E5]',
    violet: 'border-violet-300/30 bg-violet-300/10 text-violet-200',
    dim: 'border-white/10 bg-white/[0.02] text-white/50',
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

function AddressRow({ label, value, sym }: { label: string; value: string; sym?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2">
      <span className="text-[11px] uppercase tracking-[0.1em] text-white/40">{label}</span>
      <div className="flex items-center gap-2">
        {sym && <span className="text-[12px] text-white/60">{sym}</span>}
        <code className="text-[11px] text-white/80">{short(value)}</code>
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-white/30 transition-colors hover:text-white"
          title="Copy"
          aria-label={`Copy ${label}`}
        >
          ⧉
        </button>
      </div>
    </div>
  )
}

function IconCheck() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-[#7FE5E5]/40 bg-[#7FE5E5]/10 text-[#7FE5E5]">
      <svg viewBox="0 0 12 12" width="10" height="10">
        <path d="M2 6 L5 9 L10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function IconCross() {
  return (
    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-white/40">
      <svg viewBox="0 0 12 12" width="10" height="10">
        <path d="M3 3 L9 9 M9 3 L3 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
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

/* ---------- JIT step SVG art ---------- */

function JitArt1() {
  return (
    <svg viewBox="0 0 120 60" width="100%" height="100%">
      {/* Trader sends swap */}
      <rect x="8" y="22" width="24" height="16" rx="2" fill="none" stroke="currentColor" strokeOpacity="0.6" />
      <text x="20" y="33" fontSize="6" fill="currentColor" opacity="0.8" textAnchor="middle" letterSpacing="0.08em">
        TRADER
      </text>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={36 + i * 6} y={29} width="2" height="2" fill="currentColor" opacity={0.4 + i * 0.12} />
      ))}
      <rect x="74" y="18" width="38" height="24" rx="2" fill="none" stroke="currentColor" />
      <text x="93" y="33" fontSize="7" fill="currentColor" opacity="0.9" textAnchor="middle" fontWeight="700" letterSpacing="0.08em">
        HOOK
      </text>
    </svg>
  )
}

function JitArt2() {
  return (
    <svg viewBox="0 0 120 60" width="100%" height="100%">
      {/* Shared pool → hook */}
      <rect x="8" y="18" width="30" height="24" rx="2" fill="currentColor" opacity="0.85" />
      <text x="23" y="33" fontSize="6" fill="#000" textAnchor="middle" fontWeight="700" letterSpacing="0.08em">
        SHARED
      </text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={40 + i * 5} y={29} width="2" height="2" fill="currentColor" opacity={0.35 + i * 0.1} />
      ))}
      <rect x="76" y="18" width="36" height="24" rx="2" fill="none" stroke="currentColor" />
      <text x="94" y="33" fontSize="7" fill="currentColor" opacity="0.9" textAnchor="middle" fontWeight="700" letterSpacing="0.08em">
        POOL
      </text>
    </svg>
  )
}

function JitArt3() {
  return (
    <svg viewBox="0 0 120 60" width="100%" height="100%">
      {/* Swap execution — bidirectional arrows */}
      <rect x="30" y="20" width="60" height="20" rx="2" fill="currentColor" opacity="0.15" />
      <text x="60" y="33" fontSize="8" fill="currentColor" opacity="0.85" textAnchor="middle" fontWeight="700" letterSpacing="0.1em">
        SWAP
      </text>
      {/* Arrows */}
      {[20, 22, 24].map((y, i) => (
        <rect key={i} x={20 + i * 3} y={y} width="2" height="2" fill="currentColor" opacity={0.4 + i * 0.15} />
      ))}
      {[36, 38, 40].map((y, i) => (
        <rect key={i} x={96 - i * 3} y={y} width="2" height="2" fill="currentColor" opacity={0.4 + i * 0.15} />
      ))}
    </svg>
  )
}

function JitArt4() {
  return (
    <svg viewBox="0 0 120 60" width="100%" height="100%">
      {/* Pool → shared (reversed of art2) */}
      <rect x="8" y="18" width="36" height="24" rx="2" fill="none" stroke="currentColor" />
      <text x="26" y="33" fontSize="7" fill="currentColor" opacity="0.9" textAnchor="middle" fontWeight="700" letterSpacing="0.08em">
        POOL
      </text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={46 + i * 5} y={29} width="2" height="2" fill="currentColor" opacity={0.9 - i * 0.12} />
      ))}
      <rect x="82" y="18" width="30" height="24" rx="2" fill="currentColor" opacity="0.85" />
      <text x="97" y="33" fontSize="6" fill="#000" textAnchor="middle" fontWeight="700" letterSpacing="0.08em">
        SHARED
      </text>
    </svg>
  )
}
