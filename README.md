# Aqua0 — Shared Liquidity Pool + Uniswap V4 Hook

> **One deposit, every pool.** Aqua0 lets a single Shared Liquidity Pool (SLP) back multiple Uniswap V4 hooks simultaneously through Just-In-Time (JIT) liquidity delivery, with optional on-chain options hedging via an integrated StraddleManager.

---

## Demo Video

> 🎥 **[Watch the Demo (≤ 2 min)](https://youtu.be/IEhYqNid3wU)**  

---

## Live Deployment — Unichain Sepolia (Chain ID 1301)

| Contract | Address |
|---|---|
| SharedLiquidityPool | `0x59fBA1641A94e1A98aBB0f0e19160b1bfD5e9C78` |
| Aqua0Hook (mWETH/mUSDC) | `0x5B4D0f7b9DbcbAeF49f82cA93b5a75ED6Ed7040` |
| Aqua0StraddleHook (mWETH/mUSDC) | `0x61D2a9f10c6f03D0E8D9be61D16F74c4E15a8EC` |
| OptionsMarketplace | `0x7e5aD18dD1Ab43bfFD999b44B9e5a4fE99F7B88` |
| StraddleManager | `0xBa6BD39E43C7E7FbA14b28D4BdF8F40e8E9B4E1` |
| mWETH token | `0x148bA9A0A88F70962f863482BDc6A3c5049839CB` |
| mUSDC token | `0x789Bd53090A4Ed348bA1Cc0E4ADA0f140678Afc8` |
| mWBTC token | `0xe46bA72dAB980A86efE82A1eFbE45dE26588E78E` |
| Faucet | `0xC5ae4f7Aa341e6A4B854B56F9AdDF10E8569E16E` |

---

## What Is Aqua0?

Standard Uniswap V4 LP positions suffer from **capital inefficiency**: each pool needs its own dedicated liquidity, and that liquidity earns nothing when price moves outside the tick range.

Aqua0 introduces a **Shared Liquidity Pool** that:

1. **Accepts single-sided or multi-token deposits** from LPs.
2. **JIT-injects liquidity** into any registered V4 pool at the moment a swap arrives, via the `beforeSwap` hook.
3. **Recoups the liquidity** after the swap settles, via the `afterSwap` hook.
4. **Distributes fee revenue** proportionally back to SLP depositors.
5. **Optionally hedges IL** by purchasing ATM straddle options at deposit time (StraddleManager → OptionsMarketplace) and auto-exercising them on withdrawal (Aqua0StraddleHook → `afterRemoveLiquidity`).

The same dollar earns fees across **multiple pools at once**, without the LP having to manage individual positions on each pool.

---

## Architecture

```text
LP Depositor
    │
    ▼
SharedLiquidityPool ◄───── freeBalance() query
    │  └─ per-token balances, earmarks JIT allocations
    │
    ├──► Aqua0BaseHook (beforeSwap / afterSwap)
    │        └─ mWETH / mUSDC pool on Unichain
    │
    └──► Aqua0StraddleHook (beforeSwap / afterSwap / afterRemoveLiquidity)
             └─ also calls StraddleManager on removeLiquidity
                  └─ OptionsMarketplace (Black-Scholes priced, on-chain)
```

### Hook lifecycle

| Hook point | What Aqua0 does |
|---|---|
| `beforeSwap` | Reads `freeBalance` from SLP; mints JIT liquidity into the active tick |
| `afterSwap` | Burns JIT position; fee revenue accrues to SLP |
| `afterRemoveLiquidity` | (StraddleHook only) Exercises any open straddle for the position; payout offsets IL |

---

## Repository Structure

```text
hookathon-uhi9/
├── contracts/              # Foundry project
│   └── src/
│       ├── v4/
│       │   ├── SharedLiquidityPool.sol   # Core capital vault
│       │   ├── Aqua0BaseHook.sol         # Base JIT hook logic
│       │   ├── Aqua0Hook.sol             # Concrete hook deployment
│       │   └── Aqua0StraddleHook.sol     # Hook + options integration
│       ├── OptionsMarketplace.sol        # On-chain Black-Scholes options
│       ├── StraddleManager.sol           # Buys / exercises straddles
│       └── BlackScholes.sol              # Pure math library
├── app/                    # Next.js 16 frontend
│   ├── app/
│   │   ├── dashboard/      # LP dashboard (fees, PnL, positions)
│   │   ├── swap/           # Simulated dual-pool swap runner
│   │   └── pools/          # Pool browser
│   └── components/
│       └── dashboard/
│           ├── real-liquidity-manager.tsx   # Deposit / withdraw UI
│           └── pnl-comparison.tsx           # Hedged vs unhedged PnL panel
├── backend/                # NestJS API (chain data relay)
└── README.md
```

---

## Quick Start

### Prerequisites
- Node >= 20 / Bun >= 1.1
- Foundry (`forge`, `cast`) for contract work
- MetaMask or any EIP-1193 wallet, switched to **Unichain Sepolia** (chain 1301)

### Run the frontend

```bash
cd app
bun install
bun run dev
# -> http://localhost:3000
```

### Compile & test contracts

```bash
cd contracts
forge build
forge test
```

### Mint testnet tokens

Use the **Get Test Tokens** faucet button in the app header.

---

## Key Technical Decisions

### Why JIT instead of passive LP?

JIT means the hook only holds liquidity during a swap's execution block. Impermanent loss exposure is minimized to microseconds. The SLP can therefore quote tighter spreads without carrying overnight IL risk.

### Why on-chain options?

Moving the options lifecycle on-chain (Black-Scholes pricing, exercise, settlement) means LPs do not need an off-chain keeper. The StraddleManager buys options atomically at deposit time, and `afterRemoveLiquidity` exercises them atomically on exit.

### Why a Shared Pool instead of per-pool LPs?

Capital fragmentation is the LP's biggest enemy. A single SLP earns fees from every pool it backs, so total capital efficiency scales with the number of hooks rather than being split across isolated positions.

---

## License

MIT
