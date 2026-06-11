"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface HedgeComparisonProps {
  unhedgedIL: number
  optionsPayout: number
  premiumPaid: number
  feesEarned: number
  className?: string
}

export function HedgeComparison({
  unhedgedIL,
  optionsPayout,
  premiumPaid,
  feesEarned,
  className = "",
}: HedgeComparisonProps) {
  const hedgedNet = unhedgedIL + optionsPayout + feesEarned - premiumPaid
  const unhedgedNet = unhedgedIL + feesEarned
  const improvement = hedgedNet - unhedgedNet

  const formatCurrency = (value: number) => {
    const sign = value >= 0 ? "+" : ""
    return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const maxBar = Math.max(Math.abs(unhedgedNet), Math.abs(hedgedNet), 1)

  return (
    <Card className={`bg-slate-900/80 border-slate-700/50 ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg text-white">Hedge Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Side by side bars */}
        <div className="space-y-4">
          {/* Unhedged */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">Without Hedge</span>
              <span className={`font-mono font-bold ${unhedgedNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(unhedgedNet)}
              </span>
            </div>
            <div className="h-8 bg-slate-800 rounded overflow-hidden relative">
              <div
                className={`h-full rounded transition-all duration-500 ${
                  unhedgedNet >= 0 ? "bg-green-600/60" : "bg-red-600/60"
                }`}
                style={{ width: `${Math.min(100, (Math.abs(unhedgedNet) / maxBar) * 100)}%` }}
              />
              <div className="absolute inset-0 flex items-center px-3 text-xs text-white/70">
                IL: {formatCurrency(unhedgedIL)} + Fees: {formatCurrency(feesEarned)}
              </div>
            </div>
          </div>

          {/* Hedged */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-400">With Hedge</span>
              <span className={`font-mono font-bold ${hedgedNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(hedgedNet)}
              </span>
            </div>
            <div className="h-8 bg-slate-800 rounded overflow-hidden relative">
              <div
                className={`h-full rounded transition-all duration-500 ${
                  hedgedNet >= 0 ? "bg-blue-600/60" : "bg-orange-600/60"
                }`}
                style={{ width: `${Math.min(100, (Math.abs(hedgedNet) / maxBar) * 100)}%` }}
              />
              <div className="absolute inset-0 flex items-center px-3 text-xs text-white/70">
                IL: {formatCurrency(unhedgedIL)} + Options: {formatCurrency(optionsPayout)} - Premium: {formatCurrency(premiumPaid)} + Fees: {formatCurrency(feesEarned)}
              </div>
            </div>
          </div>
        </div>

        {/* Improvement badge */}
        <div
          className={`flex items-center justify-center p-4 rounded-lg ${
            improvement >= 0
              ? "bg-green-500/10 border border-green-500/30"
              : "bg-red-500/10 border border-red-500/30"
          }`}
        >
          <div className="text-center">
            <div className="text-xs text-slate-400 mb-1">Hedge Improvement</div>
            <div
              className={`text-2xl font-bold font-mono ${
                improvement >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {formatCurrency(improvement)}
            </div>
          </div>
        </div>

        {/* Breakdown table */}
        <div className="bg-slate-800/50 rounded-lg p-4">
          <table className="w-full text-sm">
            <tbody className="space-y-1">
              <tr>
                <td className="text-slate-400 py-1">Impermanent Loss</td>
                <td className="text-right font-mono text-red-400 py-1">{formatCurrency(unhedgedIL)}</td>
              </tr>
              <tr>
                <td className="text-slate-400 py-1">Options Payout</td>
                <td className="text-right font-mono text-green-400 py-1">{formatCurrency(optionsPayout)}</td>
              </tr>
              <tr>
                <td className="text-slate-400 py-1">Premium Paid</td>
                <td className="text-right font-mono text-amber-400 py-1">{formatCurrency(-premiumPaid)}</td>
              </tr>
              <tr>
                <td className="text-slate-400 py-1">Fees Earned</td>
                <td className="text-right font-mono text-green-400 py-1">{formatCurrency(feesEarned)}</td>
              </tr>
              <tr className="border-t border-slate-700">
                <td className="text-white font-medium py-2">Net Result (Hedged)</td>
                <td className={`text-right font-mono font-bold py-2 ${hedgedNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatCurrency(hedgedNet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
