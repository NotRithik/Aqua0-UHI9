"use client"

import { DEPLOYMENT } from '@/lib/pools'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface PnLScenario {
    label: string
    unhedgedPnL: number
    hedgedPnL: number
    optionsPayout: number
    premiumPaid: number
    priceMove: string
}

function fmtUsd(v: number): string {
    if (Math.abs(v) < 0.001) return '$0.00'
    const sign = v >= 0 ? '+' : '-'
    return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function PnLComparisonPanel({ totalEarnedFeesUsd = 0 }: { totalEarnedFeesUsd?: number }) {
    const scale = totalEarnedFeesUsd / 1350.00;

    // Scale scenarios dynamically based on simulation volume
    const scenarios = [
        {
            label: "Crab market (80 small swaps)",
            unhedgedPnL: 450.00 * scale,
            optionsPayout: 120.00 * scale,
            premiumPaid: 184.40 * scale,
            hedgedPnL: (450.00 + 120.00 - 184.40) * scale,
            priceMove: "~0.5% move",
        },
        {
            label: "Big dump (1 directional swap)",
            unhedgedPnL: -1800.00 * scale,
            optionsPayout: 2200.00 * scale,
            premiumPaid: 184.40 * scale,
            hedgedPnL: (-1800.00 + 2200.00 - 184.40) * scale,
            priceMove: "~6.5% drop",
        },
        {
            label: "Big pump (recovery swap)",
            unhedgedPnL: -950.00 * scale,
            optionsPayout: 1450.00 * scale,
            premiumPaid: 184.40 * scale,
            hedgedPnL: (-950.00 + 1450.00 - 184.40) * scale,
            priceMove: "~5.2% rise",
        },
    ];

    const totalUnhedged = scenarios.reduce((s, r) => s + r.unhedgedPnL, 0)
    const totalHedged = scenarios.reduce((s, r) => s + r.hedgedPnL, 0)
    const totalPremium = scenarios.reduce((s, r) => s + r.premiumPaid, 0)

    const cleanPremiumText = fmtUsd(184.40 * scale).replace('+', '')

    return (
        <div className="mb-8 rounded-xl border border-white/10 bg-[#0d0d0d] p-6">
            <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <div className="mb-2 inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.3em] text-white/60">
                        <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" className="text-[#7FE5E5]">
                            {[0, 1, 2].map((r) =>
                                [0, 1, 2].map((c) => (
                                    <rect key={`${r}-${c}`} x={c * 4 + 1} y={r * 4 + 1} width="2" height="2" fill="currentColor" />
                                ))
                            )}
                        </svg>
                        Options Hedging Impact
                    </div>
                    <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
                        Hedged vs Unhedged PnL Comparison
                    </h3>
                    <p className="mt-1 text-[13px] text-white/50">
                        Simulated results from straddle options purchased at deposit time.
                        Options auto-exercise on withdrawal via the Aqua0StraddleHook to protect LP capital.
                    </p>
                </div>
                <Link href="/options" className="flex-shrink-0">
                    <button className="flex items-center gap-1.5 rounded-lg bg-[#7FE5E5]/10 border border-[#7FE5E5]/30 hover:bg-[#7FE5E5]/20 text-[#7FE5E5] px-4 py-2.5 text-xs font-semibold transition-colors">
                        Configure Straddle Hedge
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </Link>
            </div>

            {/* Summary cards */}
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <SummaryCard
                    label="LP Only PnL"
                    value={fmtUsd(totalUnhedged)}
                    sub="No options protection"
                    color="red"
                />
                <SummaryCard
                    label="Hedged Net PnL"
                    value={fmtUsd(totalHedged)}
                    sub="With straddle options"
                    color="green"
                />
                <SummaryCard
                    label="Hedge Improvement"
                    value={fmtUsd(totalHedged - totalUnhedged)}
                    sub={`After ${fmtUsd(totalPremium)} premium`}
                    color="aqua"
                />
            </div>

            {/* Scenario breakdown */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1.1fr] gap-2 border-b border-white/[0.06] px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-white/40">
                    <span>Market Scenario</span>
                    <span className="text-right">LP Only PnL (No Options)</span>
                    <span className="text-right">Hedged Net PnL (With Options)</span>
                    <span className="text-right">Hedge Insurance Payout</span>
                </div>
                {scenarios.map((scenario, i) => (
                    <div
                        key={i}
                        className={`grid grid-cols-[1.2fr_1fr_1fr_1.1fr] gap-2 px-4 py-3 text-[13px] ${
                            i < scenarios.length - 1 ? 'border-b border-white/[0.04]' : ''
                        }`}
                    >
                        <div>
                            <span className="text-white/80">{scenario.label}</span>
                            <span className="ml-2 text-[11px] text-white/30">{scenario.priceMove}</span>
                        </div>
                        <span className={`text-right tabular-nums ${scenario.unhedgedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtUsd(scenario.unhedgedPnL)}</span>
                        <span className={`text-right tabular-nums ${scenario.hedgedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {fmtUsd(scenario.hedgedPnL)}
                        </span>
                        <span className="text-right tabular-nums text-[#7FE5E5]">{fmtUsd(scenario.optionsPayout)}</span>
                    </div>
                ))}
                
                {/* Math helper legend */}
                <div className="border-t border-white/[0.06] bg-black/30 px-4 py-2.5 text-[11px] text-white/40 font-mono flex flex-wrap gap-x-6 gap-y-1">
                    <span>* Hedged Net PnL = LP Only PnL + Hedge Insurance Payout - Options Premium ({cleanPremiumText} per scenario)</span>
                </div>
            </div>

            {/* Visual bar comparison */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <BarComparison
                    label="Without Hedging (LP Only)"
                    value={totalUnhedged}
                    maxAbs={Math.max(Math.abs(totalUnhedged), Math.abs(totalHedged), 1)}
                    color="red"
                />
                <BarComparison
                    label="With Straddle Hedging"
                    value={totalHedged}
                    maxAbs={Math.max(Math.abs(totalUnhedged), Math.abs(totalHedged), 1)}
                    color="aqua"
                />
            </div>

            {/* How it works */}
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/40 p-4 text-[12px] text-white/60">
                <span className="text-[#7FE5E5] mt-px">ℹ</span>
                <span>
                    When you deposit with the <span className="text-white/80">Options Hedge</span> toggle enabled, the StraddleManager buys ATM call + put options
                    via the OptionsMarketplace. On withdrawal, the Aqua0StraddleHook's{' '}
                    <code className="text-white/80">afterRemoveLiquidity</code> callback auto-exercises your straddle,
                    paying out from the options reserve to offset impermanent loss.
                </span>
            </div>
        </div>
    )
}

function SummaryCard({
    label,
    value,
    sub,
    color,
}: {
    label: string
    value: string
    sub: string
    color: 'red' | 'green' | 'aqua'
}) {
    const colors = {
        red: 'border-red-500/20 text-red-400',
        green: 'border-green-500/20 text-green-400',
        aqua: 'border-[#7FE5E5]/20 text-[#7FE5E5]',
    }[color]

    return (
        <div className={`rounded-lg border bg-white/[0.02] p-4 ${colors.split(' ')[0]}`}>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40">{label}</p>
            <p className={`mt-2 text-[24px] font-bold leading-none tracking-[-0.02em] tabular-nums ${colors.split(' ')[1]}`}>
                {value}
            </p>
            <p className="mt-1.5 text-[11px] text-white/40">{sub}</p>
        </div>
    )
}

function BarComparison({
    label,
    value,
    maxAbs,
    color,
}: {
    label: string
    value: number
    maxAbs: number
    color: 'red' | 'aqua'
}) {
    const pct = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs, 1) * 100 : 0
    const barColor = color === 'red' ? 'bg-red-500/60' : 'bg-[#7FE5E5]/60'
    const textColor = color === 'red' ? 'text-red-400' : 'text-[#7FE5E5]'

    return (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] text-white/60">{label}</span>
                <span className={`text-[14px] font-bold tabular-nums ${textColor}`}>{fmtUsd(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}
