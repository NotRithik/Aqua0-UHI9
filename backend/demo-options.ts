/// @title demo-options.ts
/// @notice Black-Scholes options pricing + demo scenario generator
/// @dev This computes the same numbers as the Solidity contracts but in TypeScript.
///      Used by the backend API to serve demo data to the frontend.

export interface OptionPremium {
  call: number
  put: number
  straddle: number
}

export interface DemoScenario {
  name: string
  description: string
  // SLP context
  slpLiquidityUSDC: number
  slpLiquidityWETH: number
  ethPrice: number
  poolCount: number
  poolNames: string[]
  swapVolume: number
  swapCount: number
  feeTierBps: number
  // Options params
  spotPrice: number
  strikePrice: number
  expiryDays: number
  volatility: number
  riskFreeRate: number
  amount: number
  // Outcomes
  unhedgedIL: number
  finalPrice: number
  feesEarned: number
}

export interface DemoResult {
  scenario: DemoScenario
  premiums: OptionPremium
  totalPremium: number
  optionsPayout: number
  unhedgedNet: number
  hedgedNet: number
  improvement: number
  unhedgedIL: number
}

// ─── Black-Scholes Math (TypeScript mirror of BlackScholes.sol) ──────────

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
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX / 2)
  return 0.5 * (1.0 + sign * y)
}

function blackScholesCall(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0 || S <= 0 || K <= 0) return 0
  const sqrtT = Math.sqrt(T)
  const d1 =
    (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
}

function blackScholesPut(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0 || K <= 0) return 0
  if (S <= 0) return K * Math.exp(-r * T)
  const sqrtT = Math.sqrt(T)
  const d1 =
    (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
}

// ─── Scenario Definitions ────────────────────────────────────────────────

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    name: "Crab Market + 50% Dump",
    description:
      "50 swaps back-and-forth (fees accumulate), then a massive crash",
    spotPrice: 2000,
    strikePrice: 2000,
    expiryDays: 7,
    volatility: 0.3,
    riskFreeRate: 0.05,
    amount: 3,
    unhedgedIL: -2500,
    finalPrice: 1000,
    feesEarned: 120,
  },
  {
    name: "Steady 40% Decline",
    description: "Gradual price decline over the hedging period",
    spotPrice: 2000,
    strikePrice: 2000,
    expiryDays: 7,
    volatility: 0.3,
    riskFreeRate: 0.05,
    amount: 2,
    unhedgedIL: -1800,
    finalPrice: 1200,
    feesEarned: 80,
  },
  {
    name: "Market Crash (60% Drop)",
    description: "Sudden black swan event -- extreme IL scenario",
    spotPrice: 2000,
    strikePrice: 2000,
    expiryDays: 7,
    volatility: 0.3,
    riskFreeRate: 0.05,
    amount: 8,
    unhedgedIL: -5000,
    finalPrice: 800,
    feesEarned: 50,
  },
  {
    name: "Modest 15% Volatility",
    description: "Normal market conditions -- hedge cost vs benefit",
    spotPrice: 2000,
    strikePrice: 2000,
    expiryDays: 7,
    volatility: 0.3,
    riskFreeRate: 0.05,
    amount: 1,
    unhedgedIL: -500,
    finalPrice: 1700,
    feesEarned: 200,
  },
]

// ─── Compute Functions ───────────────────────────────────────────────────

export function computePremium(
  spotPrice: number,
  strikePrice: number,
  expiryDays: number,
  volatility: number,
  riskFreeRate: number
): OptionPremium {
  const T = expiryDays / 365
  const call = blackScholesCall(spotPrice, strikePrice, T, riskFreeRate, volatility)
  const put = blackScholesPut(spotPrice, strikePrice, T, riskFreeRate, volatility)
  return {
    call: Math.round(call * 100) / 100,
    put: Math.round(put * 100) / 100,
    straddle: Math.round((call + put) * 100) / 100,
  }
}

export function computeScenarioResult(scenario: DemoScenario): DemoResult {
  const premiums = computePremium(
    scenario.spotPrice,
    scenario.strikePrice,
    scenario.expiryDays,
    scenario.volatility,
    scenario.riskFreeRate
  )

  const totalPremium = premiums.straddle * scenario.amount

  // Straddle payoff at final price
  const callPayoff = Math.max(scenario.finalPrice - scenario.strikePrice, 0)
  const putPayoff = Math.max(scenario.strikePrice - scenario.finalPrice, 0)
  const optionsPayout = (callPayoff + putPayoff) * scenario.amount

  const unhedgedNet = scenario.unhedgedIL + scenario.feesEarned
  const hedgedNet =
    scenario.unhedgedIL + optionsPayout - totalPremium + scenario.feesEarned
  const improvement = hedgedNet - unhedgedNet

  return {
    scenario,
    premiums,
    totalPremium: Math.round(totalPremium * 100) / 100,
    optionsPayout: Math.round(optionsPayout * 100) / 100,
    unhedgedNet: Math.round(unhedgedNet * 100) / 100,
    hedgedNet: Math.round(hedgedNet * 100) / 100,
    improvement: Math.round(improvement * 100) / 100,
    unhedgedIL: scenario.unhedgedIL,
  }
}

export function getAllScenarios(): DemoResult[] {
  return DEMO_SCENARIOS.map(computeScenarioResult)
}

export function getStrikeSensitivity(
  spotPrice: number,
  expiryDays: number,
  volatility: number,
  riskFreeRate: number
) {
  const strikes = [1700, 1800, 1900, 2000, 2100, 2200, 2300]
  const T = expiryDays / 365

  return strikes.map((strike) => {
    const call = blackScholesCall(spotPrice, strike, T, riskFreeRate, volatility)
    const put = blackScholesPut(spotPrice, strike, T, riskFreeRate, volatility)
    return {
      strike,
      call: Math.round(call * 100) / 100,
      put: Math.round(put * 100) / 100,
      straddle: Math.round((call + put) * 100) / 100,
    }
  })
}

// ─── CLI entry point ─────────────────────────────────────────────────────

if (require.main === module) {
  console.log("=== Aqua0 Options Demo ===\n")

  const results = getAllScenarios()
  results.forEach((r) => {
    console.log(`--- ${r.scenario.name} ---`)
    console.log(`  ${r.scenario.description}`)
    console.log(`  Premium: $${r.totalPremium}`)
    console.log(`  Payout:  $${r.optionsPayout}`)
    console.log(`  Unhedged: $${r.unhedgedNet}`)
    console.log(`  Hedged:   $${r.hedgedNet}`)
    console.log(`  Improvement: $${r.improvement}\n`)
  })

  console.log("=== Strike Sensitivity ===\n")
  const sensitivity = getStrikeSensitivity(2000, 7, 0.3, 0.05)
  console.log("Strike  | Call    | Put     | Straddle")
  console.log("--------|---------|---------|---------")
  sensitivity.forEach((s) => {
    console.log(
      `$${s.strike}  | $${s.call.toFixed(2).padStart(6)} | $${s.put.toFixed(2).padStart(6)} | $${s.straddle.toFixed(2).padStart(6)}`
    )
  })
}
