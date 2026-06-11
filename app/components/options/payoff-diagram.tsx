"use client"

import { useMemo } from "react"

interface PayoffDiagramProps {
  strikePrice: number
  callPremium: number
  putPremium: number
  currentPrice: number
  className?: string
}

export function PayoffDiagram({
  strikePrice,
  callPremium,
  putPremium,
  currentPrice,
  className = "",
}: PayoffDiagramProps) {
  const totalPremium = callPremium + putPremium

  const { callPoints, putPoints, straddlePoints, xMin, xMax, yMin, yMax } =
    useMemo(() => {
      const range = strikePrice * 0.6
      const xMin = strikePrice - range
      const xMax = strikePrice + range
      const steps = 100
      const dx = (xMax - xMin) / steps

      const callPoints: { x: number; y: number }[] = []
      const putPoints: { x: number; y: number }[] = []
      const straddlePoints: { x: number; y: number }[] = []

      let yMin = 0
      let yMax = 0

      for (let i = 0; i <= steps; i++) {
        const price = xMin + i * dx
        const callPayoff = Math.max(price - strikePrice, 0) - callPremium
        const putPayoff = Math.max(strikePrice - price, 0) - putPremium
        const straddlePayoff = callPayoff + putPayoff

        callPoints.push({ x: price, y: callPayoff })
        putPoints.push({ x: price, y: putPayoff })
        straddlePoints.push({ x: price, y: straddlePayoff })

        yMin = Math.min(yMin, callPayoff, putPayoff, straddlePayoff)
        yMax = Math.max(yMax, callPayoff, putPayoff, straddlePayoff)
      }

      const padding = (yMax - yMin) * 0.15
      return {
        callPoints,
        putPoints,
        straddlePoints,
        xMin,
        xMax,
        yMin: yMin - padding,
        yMax: yMax + padding,
      }
    }, [strikePrice, callPremium, putPremium])

  const width = 600
  const height = 350
  const padLeft = 60
  const padRight = 20
  const padTop = 20
  const padBottom = 40
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const toSvgX = (price: number) =>
    padLeft + ((price - xMin) / (xMax - xMin)) * plotW
  const toSvgY = (pnl: number) =>
    padTop + plotH - ((pnl - yMin) / (yMax - yMin)) * plotH

  const pointsToPath = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`).join(" ")

  const zeroY = toSvgY(0)

  // Breakeven points for the straddle
  const breakEvenUp = strikePrice + totalPremium
  const breakEvenDown = strikePrice - totalPremium

  // X-axis ticks
  const xTicks = useMemo(() => {
    const ticks: number[] = []
    const step = (xMax - xMin) / 6
    for (let i = 0; i <= 6; i++) {
      ticks.push(Math.round(xMin + i * step))
    }
    return ticks
  }, [xMin, xMax])

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = []
    const range = yMax - yMin
    const step = range / 5
    for (let i = 0; i <= 5; i++) {
      ticks.push(yMin + i * step)
    }
    return ticks
  }, [yMin, yMax])

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ maxHeight: "350px" }}
      >
        {/* Background */}
        <rect
          x={padLeft}
          y={padTop}
          width={plotW}
          height={plotH}
          fill="rgba(15,23,42,0.6)"
          rx="4"
        />

        {/* Zero line */}
        <line
          x1={padLeft}
          y1={zeroY}
          x2={padLeft + plotW}
          y2={zeroY}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="4,4"
        />

        {/* Profit/Loss zones */}
        <defs>
          <linearGradient id="profitZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lossZone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Straddle area fill */}
        <polygon
          points={[
            ...straddlePoints.map(
              (p) => `${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`
            ),
            `${toSvgX(straddlePoints[straddlePoints.length - 1].x).toFixed(1)},${zeroY}`,
            `${toSvgX(straddlePoints[0].x).toFixed(1)},${zeroY}`,
          ].join(" ")}
          fill={straddlePoints.some((p) => p.y > 0) ? "url(#profitZone)" : "url(#lossZone)"}
        />

        {/* Grid lines */}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={toSvgX(tick)}
              y1={padTop}
              x2={toSvgX(tick)}
              y2={padTop + plotH}
              stroke="#334155"
              strokeWidth="0.5"
            />
            <text
              x={toSvgX(tick)}
              y={height - 8}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
            >
              ${(tick / 1000).toFixed(1)}k
            </text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={padLeft}
              y1={toSvgY(tick)}
              x2={padLeft + plotW}
              y2={toSvgY(tick)}
              stroke="#334155"
              strokeWidth="0.5"
            />
            <text
              x={padLeft - 8}
              y={toSvgY(tick) + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="11"
            >
              {tick >= 0 ? "+" : ""}${(tick / 1000).toFixed(1)}k
            </text>
          </g>
        ))}

        {/* Call payoff line */}
        <polyline
          points={pointsToPath(callPoints)}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
        />

        {/* Put payoff line */}
        <polyline
          points={pointsToPath(putPoints)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        />

        {/* Straddle combined line */}
        <polyline
          points={pointsToPath(straddlePoints)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
        />

        {/* Strike price line */}
        <line
          x1={toSvgX(strikePrice)}
          y1={padTop}
          x2={toSvgX(strikePrice)}
          y2={padTop + plotH}
          stroke="#a855f7"
          strokeWidth="1.5"
          strokeDasharray="6,3"
        />
        <text
          x={toSvgX(strikePrice)}
          y={padTop - 5}
          textAnchor="middle"
          fill="#a855f7"
          fontSize="11"
          fontWeight="600"
        >
          Strike ${(strikePrice / 1000).toFixed(1)}k
        </text>

        {/* Current price marker */}
        <line
          x1={toSvgX(currentPrice)}
          y1={padTop}
          x2={toSvgX(currentPrice)}
          y2={padTop + plotH}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="3,3"
        />
        <circle
          cx={toSvgX(currentPrice)}
          cy={toSvgY(0)}
          r="5"
          fill="#f59e0b"
          stroke="#0f172a"
          strokeWidth="2"
        />
        <text
          x={toSvgX(currentPrice)}
          y={padTop - 5}
          textAnchor="middle"
          fill="#f59e0b"
          fontSize="10"
        >
          Current
        </text>

        {/* Break-even markers */}
        <circle
          cx={toSvgX(breakEvenUp)}
          cy={zeroY}
          r="4"
          fill="#22c55e"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
        <circle
          cx={toSvgX(breakEvenDown)}
          cy={zeroY}
          r="4"
          fill="#22c55e"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 justify-center text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-green-500 rounded" />
          <span className="text-slate-400">Call</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500 rounded" />
          <span className="text-slate-400">Put</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-500 rounded" />
          <span className="text-slate-400">Straddle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-purple-500 rounded border-dashed" />
          <span className="text-slate-400">Strike</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-amber-500 rounded-full" />
          <span className="text-slate-400">Current Price</span>
        </div>
      </div>
    </div>
  )
}
