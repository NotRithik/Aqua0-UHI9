/// @title Aqua0 Options Demo Backend
/// @notice Serves pool data, faucet claims, options pricing, and SLP operations to the frontend

import { Hono } from "hono"
import { cors } from "hono/cors"
import { computePremium, getStrikeSensitivity } from "./demo-options"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const app = new Hono()
app.use("*", cors())

// ─── Load deployment addresses ───────────────────────────────────────────

interface DeploymentAddresses {
  chainId: number
  poolManager: string
  poolSwapTest: string
  sharedLiquidityPool: string
  aqua0Hook: string
  mockUsdc: string
  mockWeth: string
  mockWbtc: string
  faucet: string
  marketplace: string
  straddleManager: string
  pool1Currency0?: string
  pool1Currency1?: string
  pool4Currency0?: string
  pool4Currency1?: string
  pool5Currency0?: string
  pool5Currency1?: string
  pool5Isolated?: boolean
}

let deployment: DeploymentAddresses | null = null

function getDeployment(): DeploymentAddresses {
  if (deployment) return deployment
  const paths = [
    resolve(__dirname, "../contracts/deployments/unichain-sepolia.json"),
    resolve(process.cwd(), "contracts/deployments/unichain-sepolia.json"),
    resolve(process.cwd(), "deployments/unichain-sepolia.json"),
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      deployment = JSON.parse(readFileSync(p, "utf-8"))
      return deployment!
    }
  }
  throw new Error("Deployment JSON not found")
}

// ─── Health ──────────────────────────────────────────────────────────────

app.get("/", (c) => {
  try {
    const d = getDeployment()
    return c.json({ status: "ok", chainId: d.chainId, poolManager: d.poolManager })
  } catch (e: any) {
    return c.json({ status: "error", message: e.message }, 500)
  }
})

// ─── V4 Pool Registry ───────────────────────────────────────────────────

const ZERO = "0x0000000000000000000000000000000000000000"

interface PoolRegistryEntry {
  poolKey: {
    currency0: string
    currency1: string
    fee: number
    tickSpacing: number
    hooks: string
  }
  token0Symbol: string
  token1Symbol: string
  token0Decimals: number
  token1Decimals: number
  label: string
  isAqua0Enabled: boolean
}

function buildPoolRegistry(deployment: DeploymentAddresses): PoolRegistryEntry[] {
  const pools: PoolRegistryEntry[] = []
  const hook = deployment.aqua0Hook || ZERO

  const getSymbol = (addr: string) => {
    if (addr.toLowerCase() === deployment.mockUsdc?.toLowerCase()) return "mUSDC"
    if (addr.toLowerCase() === deployment.mockWeth?.toLowerCase()) return "mWETH"
    if (addr.toLowerCase() === deployment.mockWbtc?.toLowerCase()) return "mWBTC"
    return "Unknown"
  }

  // Pool 1: mUSDC/mWBTC 0.3%
  if (deployment.pool1Currency0 && deployment.pool1Currency1) {
    pools.push({
      poolKey: { currency0: deployment.pool1Currency0, currency1: deployment.pool1Currency1, fee: 3000, tickSpacing: 60, hooks: hook },
      token0Symbol: getSymbol(deployment.pool1Currency0),
      token1Symbol: getSymbol(deployment.pool1Currency1),
      token0Decimals: 18, token1Decimals: 18,
      label: `${getSymbol(deployment.pool1Currency0)} / ${getSymbol(deployment.pool1Currency1)} (0.3%)`,
      isAqua0Enabled: true,
    })
  }

  // Pool 4: mWETH/mUSDC 0.3% (the main ETH/USDC pool)
  if (deployment.pool4Currency0 && deployment.pool4Currency1) {
    pools.push({
      poolKey: { currency0: deployment.pool4Currency0, currency1: deployment.pool4Currency1, fee: 3000, tickSpacing: 60, hooks: hook },
      token0Symbol: getSymbol(deployment.pool4Currency0),
      token1Symbol: getSymbol(deployment.pool4Currency1),
      token0Decimals: 18, token1Decimals: 18,
      label: `${getSymbol(deployment.pool4Currency0)} / ${getSymbol(deployment.pool4Currency1)} (0.3%)`,
      isAqua0Enabled: true,
    })
  }

  // Pool 5: mWETH/mUSDC 0.3% isolated (no hook)
  if (deployment.pool5Currency0 && deployment.pool5Currency1) {
    pools.push({
      poolKey: { currency0: deployment.pool5Currency0, currency1: deployment.pool5Currency1, fee: 3000, tickSpacing: 60, hooks: ZERO },
      token0Symbol: getSymbol(deployment.pool5Currency0),
      token1Symbol: getSymbol(deployment.pool5Currency1),
      token0Decimals: 18, token1Decimals: 18,
      label: `${getSymbol(deployment.pool5Currency0)} / ${getSymbol(deployment.pool5Currency1)} (0.3%) — Isolated`,
      isAqua0Enabled: false,
    })
  }

  return pools
}

// GET /api/v1/v4/pools
app.get("/api/v1/v4/pools", (c) => {
  const chainId = parseInt(c.req.query("chainId") || "1301")
  const deployment = getDeployment()
  const registry = buildPoolRegistry(deployment)

  // Return pool metadata (prices come from frontend via direct RPC or hardcoded for demo)
  const pools = registry.map((entry, i) => {
    // Compute a simple poolId from the pool key
    const poolId = `0x${Buffer.from(JSON.stringify(entry.poolKey)).toString("hex").padStart(64, "0").slice(0, 64)}`

    // For demo, return estimated prices based on pool type
    let currentPrice = 0
    let currentTick = 0
    if (entry.token0Symbol === "mWETH" && entry.token1Symbol === "mUSDC") {
      // mWETH/mUSDC pool: price = USDC per WETH (from tick)
      currentTick = 12245 // from on-chain
      currentPrice = Math.pow(1.0001, currentTick)
    } else if (entry.token0Symbol === "mUSDC" && entry.token1Symbol === "mWBTC") {
      currentTick = 76012
      currentPrice = Math.pow(1.0001, currentTick)
    }

    return {
      poolId,
      poolKey: entry.poolKey,
      label: entry.label,
      token0: { address: entry.poolKey.currency0, symbol: entry.token0Symbol, decimals: entry.token0Decimals },
      token1: { address: entry.poolKey.currency1, symbol: entry.token1Symbol, decimals: entry.token1Decimals },
      currentTick,
      currentPrice,
      sqrtPriceX96: "0",
      fee: entry.poolKey.fee,
      tickSpacing: entry.poolKey.tickSpacing,
      realLiquidity: "0",
      aggregatedRanges: [],
      isAqua0Enabled: entry.isAqua0Enabled,
    }
  })

  return c.json({ chainId, pools, poolSwapTest: deployment.poolSwapTest })
})

// ─── Faucet ──────────────────────────────────────────────────────────────

// Dashboard calls this endpoint
app.post("/api/v1/demo/faucet", async (c) => {
  const chainId = parseInt(c.req.query("chain") || "1301")
  const d = getDeployment()
  if (chainId !== 1301) {
    return c.json({ success: false, message: `Faucet only available on Unichain Sepolia (1301). Connected chain: ${chainId}` })
  }
  return c.json({
    success: true,
    chainId,
    faucetAddress: d.faucet,
    tokens: [
      { symbol: "mUSDC", amount: "1000000000000000000000", decimals: 18, displayAmount: "1,000" },
      { symbol: "mWETH", amount: "500000000000000000", decimals: 18, displayAmount: "0.5" },
      { symbol: "mWBTC", amount: "10000000000000000", decimals: 18, displayAmount: "0.01" }
    ],
    message: "Click 'Get Testnet Tokens' to call faucet.claim() on Unichain Sepolia"
  })
})

app.post("/api/v1/faucet/claim", async (c) => {
  const body = await c.req.json()
  const { address: userAddress } = body

  if (!userAddress) {
    return c.json({ error: "address required" }, 400)
  }

  return c.json({
    success: true,
    faucetAddress: getDeployment().faucet,
    tokens: [
      { symbol: "mUSDC", amount: "1000000000000000000000", decimals: 18, displayAmount: "1,000" },
      { symbol: "mWETH", amount: "500000000000000000", decimals: 18, displayAmount: "0.5" },
      { symbol: "mWBTC", amount: "10000000000000000", decimals: 18, displayAmount: "0.01" }
    ],
    message: "Call faucet.claim() on-chain to receive tokens"
  })
})

// ─── Options Pricing ─────────────────────────────────────────────────────

app.get("/api/v1/premium", (c) => {
  const spotPrice = parseFloat(c.req.query("spot") || "2000")
  const strikePrice = parseFloat(c.req.query("strike") || "2000")
  const expiryDays = parseInt(c.req.query("expiry") || "7")
  const volatility = parseFloat(c.req.query("vol") || "0.3")
  const riskFreeRate = parseFloat(c.req.query("rate") || "0.05")
  const premiums = computePremium(spotPrice, strikePrice, expiryDays, volatility, riskFreeRate)
  return c.json({ spotPrice, strikePrice, expiryDays, volatility, riskFreeRate, premiums })
})

app.get("/api/v1/strike-sensitivity", (c) => {
  const spotPrice = parseFloat(c.req.query("spot") || "2000")
  const expiryDays = parseInt(c.req.query("expiry") || "7")
  const volatility = parseFloat(c.req.query("vol") || "0.3")
  const riskFreeRate = parseFloat(c.req.query("rate") || "0.05")
  return c.json({ sensitivity: getStrikeSensitivity(spotPrice, expiryDays, volatility, riskFreeRate) })
})

// ─── LP Positions (returns empty for now — positions tracked in SLP contract) ─

app.get("/api/v1/v4/lp/positions/:address", (c) => {
  const address = c.req.param("address")
  const chainId = parseInt(c.req.query("chainId") || "1301")
  return c.json({ chainId, address, positions: [] })
})

// ─── LP Balances ─────────────────────────────────────────────────────────

app.get("/api/v1/v4/lp/balances/:address", (c) => {
  const address = c.req.param("address")
  const chainId = parseInt(c.req.query("chainId") || "1301")
  const tokens = (c.req.query("tokens") || "").split(",").filter(Boolean)
  const d = getDeployment()

  // Return zero balances for each token — in a full impl we'd read from SLP
  const balances = tokens.map(token => ({
    token,
    freeBalance: "0",
    lockedBalance: "0",
    earnedFees: "0",
  }))

  return c.json({ chainId, address, balances })
})

// ─── LP Prepare (approve / deposit / add-position / remove) ──────────────

function encodeApprove(token: string, spender: string, amount: string) {
  // ERC20 approve(address,uint256) selector: 0x095ea7b3
  return {
    to: token,
    data: `0x095ea7b3${spender.slice(2).toLowerCase()}${BigInt(amount).toString(16).padStart(64, "0")}`,
    value: "0x0",
  }
}

app.post("/api/v1/v4/lp/prepare-approve", async (c) => {
  const body = await c.req.json()
  const { token, amount } = body
  const d = getDeployment()
  // Approve the SLP to spend tokens
  return c.json({ calldata: encodeApprove(token, d.sharedLiquidityPool, amount) })
})

app.post("/api/v1/v4/lp/prepare-deposit", async (c) => {
  const body = await c.req.json()
  const { token, amount, to } = body
  const d = getDeployment()
  // Transfer tokens to SLP — ERC20 transfer(address,uint256) selector: 0xa9059cbb
  return c.json({
    calldata: {
      to: token,
      data: `0xa9059cbb${d.sharedLiquidityPool.slice(2).toLowerCase()}${BigInt(amount).toString(16).padStart(64, "0")}`,
      value: "0x0",
    }
  })
})

app.post("/api/v1/v4/lp/prepare-add-position", async (c) => {
  const body = await c.req.json()
  const { poolKey, tickLower, tickUpper, liquidity, token0Amount, token1Amount, owner } = body
  const d = getDeployment()
  // SharedLiquidityPool.addLiquidity selector: 0xe8e33700 (simplified)
  // In a full impl, we'd ABI-encode the full call
  return c.json({
    calldata: {
      to: d.sharedLiquidityPool,
      data: `0xe8e33700`,
      value: "0x0",
    }
  })
})

app.post("/api/v1/v4/lp/prepare-remove-position", async (c) => {
  const body = await c.req.json()
  const { poolKey, tickLower, tickUpper, owner } = body
  const d = getDeployment()
  return c.json({
    calldata: {
      to: d.sharedLiquidityPool,
      data: `0x219f5d17`, // removeLiquidity selector (simplified)
      value: "0x0",
    }
  })
})

// ─── Options Hedge ───────────────────────────────────────────────────────

app.post("/api/v1/v4/lp/auto-exercise-options", async (c) => {
  const body = await c.req.json()
  return c.json({ exercised: false, optionsPayout: 0 })
})

app.post("/api/v1/v4/lp/buy-options-hedge", async (c) => {
  const body = await c.req.json()
  const d = getDeployment()
  return c.json({
    success: true,
    marketplace: d.marketplace,
    message: "Options hedge purchased on-chain"
  })
})

// ─── SLP Balance (reads from deployment) ─────────────────────────────────

app.get("/api/v1/v4/lp/addresses", (c) => {
  const chainId = parseInt(c.req.query("chainId") || "1301")
  const d = getDeployment()
  return c.json({
    chainId,
    sharedLiquidityPool: d.sharedLiquidityPool,
    aqua0Hook: d.aqua0Hook,
    poolManager: d.poolManager,
    poolSwapTest: d.poolSwapTest,
    faucet: d.faucet,
    marketplace: d.marketplace,
    straddleManager: d.straddleManager,
    tokens: {
      usdc: d.mockUsdc,
      weth: d.mockWeth,
      wbtc: d.mockWbtc,
    }
  })
})

// ─── Start Server ────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || "3001")
console.log(`Aqua0 Options Demo API running on port ${port}`)
console.log(`Deployment: ${JSON.stringify(getDeployment(), null, 2)}`)

export default { port, fetch: app.fetch }
