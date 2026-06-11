"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { PayoffDiagram } from "./payoff-diagram"

// Black-Scholes pricing (client-side mirror of the Solidity implementation)
function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x >= 0 ? 1 : -1
  const absX = Math.abs(x)
  const t = 1.0 / (1.0 + p * absX)
  const y =
    1.0 -
    (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2)
  return 0.5 * (1.0 + sign * y)
}

function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || S <= 0 || K <= 0) return 0
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
}

function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || K <= 0) return 0
  if (S <= 0) return K * Math.exp(-r * T)
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
}

interface StraddleConfig {
  spotPrice: number
  strikePrice: number
  volatility: number
  expiryDays: number
  amount: number
}

interface StraddlePanelProps {
  onConfigChange?: (config: StraddleConfig, premiums: { call: number; put: number; total: number }) => void
}

export function StraddlePanel({ onConfigChange }: StraddlePanelProps) {
  const [spotPrice, setSpotPrice] = useState(2000)
  const [volatility, setVolatility] = useState(30)
  const [expiryDays, setExpiryDays] = useState(7)
  const [amount, setAmount] = useState(5)

  const strikePrice = spotPrice // ATM straddle
  const riskFreeRate = 0.05
  const T = expiryDays / 365

  const premiums = useMemo(() => {
    const call = blackScholesCall(spotPrice, strikePrice, T, riskFreeRate, volatility / 100)
    const put = blackScholesPut(spotPrice, strikePrice, T, riskFreeRate, volatility / 100)
    return {
      call: Math.round(call * 100) / 100,
      put: Math.round(put * 100) / 100,
      total: Math.round((call + put) * 100) / 100,
    }
  }, [spotPrice, strikePrice, T, volatility])

  const totalCost = premiums.total * amount

  const breakEvenUp = strikePrice + premiums.total
  const breakEvenDown = strikePrice - premiums.total

  // Notify parent of config changes
  useMemo(() => {
    onConfigChange?.(
      { spotPrice, strikePrice, volatility, expiryDays, amount },
      premiums
    )
  }, [spotPrice, strikePrice, volatility, expiryDays, amount, premiums])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Config Sliders */}
      <Card className="bg-slate-900/80 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Configure Straddle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Spot Price */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-400">Spot Price</label>
              <span className="text-sm font-mono text-white">${spotPrice.toLocaleString()}</span>
            </div>
            <Slider
              value={[spotPrice]}
              onValueChange={(v) => setSpotPrice(v[0])}
              min={500}
              max={5000}
              step={50}
              className="w-full"
            />
          </div>

          {/* Volatility */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-400">Annualized Volatility</label>
              <span className="text-sm font-mono text-white">{volatility}%</span>
            </div>
            <Slider
              value={[volatility]}
              onValueChange={(v) => setVolatility(v[0])}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Expiry */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-400">Days to Expiry</label>
              <span className="text-sm font-mono text-white">{expiryDays} days</span>
            </div>
            <Slider
              value={[expiryDays]}
              onValueChange={(v) => setExpiryDays(v[0])}
              min={1}
              max={365}
              step={1}
              className="w-full"
            />
          </div>

          {/* Amount */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-400">Number of Straddles</label>
              <span className="text-sm font-mono text-white">{amount}</span>
            </div>
            <Slider
              value={[amount]}
              onValueChange={(v) => setAmount(v[0])}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          {/* Premium Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Call Premium (each)</span>
              <span className="text-green-400 font-mono">${premiums.call.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Put Premium (each)</span>
              <span className="text-red-400 font-mono">${premiums.put.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex justify-between text-sm">
              <span className="text-slate-300 font-medium">Total Cost ({amount} straddles)</span>
              <span className="text-amber-400 font-mono font-bold">${totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Break-even UP</span>
              <span className="font-mono">${breakEvenUp.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Break-even DOWN</span>
              <span className="font-mono">${breakEvenDown.toFixed(0)}</span>
            </div>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Buy Straddle
          </Button>
        </CardContent>
      </Card>

      {/* Right: Payoff Diagram */}
      <Card className="bg-slate-900/80 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">P&L Payoff Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <PayoffDiagram
            strikePrice={strikePrice}
            callPremium={premiums.call}
            putPremium={premiums.put}
            currentPrice={spotPrice}
          />
        </CardContent>
      </Card>
    </div>
  )
}
