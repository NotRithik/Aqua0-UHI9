"use client"

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useWallet } from '@/contexts/wallet-context'
import { useSendTransaction } from 'wagmi'
import { ArrowDownUp, Loader2, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

export default function SwapPage() {
  const { toast } = useToast()
  const { isConnected, address } = useWallet()
  const { sendTransactionAsync } = useSendTransaction()
  
  const [isSimulating, setIsSimulating] = useState(false)
  const [simStep, setSimStep] = useState(0)
  const [simComplete, setSimComplete] = useState(false)

  const handleRunSwaps = async () => {
    setIsSimulating(true)
    setSimComplete(false)
    setSimStep(0)
    
    // Trigger real wallet transaction signature if connected
    if (isConnected && address) {
      try {
        toast({
          title: "Confirm transaction...",
          description: "Please authorize the swap batch transaction in your wallet."
        })
        
        // Safe 0-value transaction to user's own address to trigger signing popup
        await sendTransactionAsync({
          to: address as `0x${string}`,
          value: 0n,
        })
        
        toast({
          title: "Batch authorized!",
          description: "Executing simulated swaps series..."
        })
      } catch (error: any) {
        console.error("Wallet transaction rejected:", error)
        toast({
          title: "Authorization Rejected",
          description: "You must confirm the wallet transaction to run the swaps.",
          variant: "destructive"
        })
        setIsSimulating(false)
        return
      }
    } else {
      // In sandbox mode, show a small visual wait before starting
      toast({
        title: "Starting sandbox simulation...",
        description: "Executing swaps series..."
      })
      await new Promise(r => setTimeout(r, 1000))
    }

    // Simulate 50 swaps progress step-by-step
    for (let i = 1; i <= 50; i++) {
      setSimStep(i)
      await new Promise(r => setTimeout(r, 60)) // Fast progression for presentation
    }
    
    setIsSimulating(false)
    setSimComplete(true)
    
    // Update simulated fees in localStorage
    const currentFees = parseFloat(localStorage.getItem('aqua0_simulated_earned_fees') || '0.00')
    const newFees = currentFees + 1350.00
    localStorage.setItem('aqua0_simulated_earned_fees', newFees.toFixed(2))
    
    // Dispatch event to notify other pages of changes
    window.dispatchEvent(new Event('storage_positions_changed'))
    
    toast({
      title: "50 Swaps Completed successfully!",
      description: "Generated $1,350.00 in swap fees for the Shared Liquidity Pool (SLP).",
    })
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[520px] px-4 py-12 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2.5 text-[11px] uppercase tracking-[0.3em] text-white/60">
              <DotMarkMini />
              Swap
            </div>
            <p className="text-[13px] text-white/50">
              Trade on Unichain Sepolia
            </p>
          </div>
        </div>

        {/* Swap Card with Unichain pink aura behind */}
        <div className="relative">
          {/* Pink aura — uses Unichain brand color #FF007A */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: '130%',
                height: '120%',
                background:
                  'radial-gradient(ellipse at center, rgba(255,0,122,0.45) 0%, rgba(255,0,122,0.18) 35%, transparent 70%)',
                filter: 'blur(72px)',
              }}
            />
          </div>

          {/* Inner card */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 space-y-4">
            
            {/* Simulated Dual Pool Route explanation */}
            <div className="rounded-xl border border-[#7FE5E5]/20 bg-[#7FE5E5]/[0.02] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7FE5E5] flex items-center gap-1.5 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7FE5E5] animate-ping" />
                Simulated Route (Dual Pool JIT)
              </div>
              <p className="text-[12px] text-white/60 mb-2 leading-relaxed">
                Executing a batch of 50 swaps across both pools connected to the Shared Liquidity Pool (SLP) to showcase JIT liquidity volume:
              </p>
              <div className="space-y-1 text-[11px] font-mono text-white/80">
                <div className="flex justify-between">
                  <span>• 25 swaps on mWETH / mUSDC</span>
                  <span className="text-[#7FE5E5] font-semibold">$240,000 vol</span>
                </div>
                <div className="flex justify-between">
                  <span>• 25 swaps on mUSDC / mWBTC</span>
                  <span className="text-[#7FE5E5] font-semibold">$210,000 vol</span>
                </div>
              </div>
            </div>

            {/* You pay (Locked to 4.50 mWETH per individual swap) */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
                  You pay
                </span>
                <span className="text-[11px] text-white/40">Locked (Individual Swap Size)</span>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  value="4.50"
                  disabled
                  className="h-auto flex-1 border-0 bg-transparent p-0 text-[28px] font-medium text-white/60 tabular-nums focus-visible:ring-0 cursor-not-allowed"
                />
                {/* Token Selector Display */}
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-1.5 text-sm font-semibold text-white">
                  <Image
                    src="/crypto/WETH.png"
                    alt="mWETH"
                    width={18}
                    height={18}
                    className="h-4.5 w-4.5 rounded-full"
                    unoptimized
                  />
                  <span>mWETH</span>
                </div>
              </div>
            </div>

            {/* Flip button */}
            <div className="relative -my-1.5 flex justify-center">
              <div
                className="rounded-lg border border-white/10 bg-[#0d0d0d] p-2 text-white/40 cursor-not-allowed"
              >
                <ArrowDownUp className="h-4 w-4" />
              </div>
            </div>

            {/* You receive (Locked to 9,000.00 mUSDC per individual swap) */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
                  You receive
                </span>
                <span className="text-[11px] text-white/40">Locked (Individual Swap Size)</span>
              </div>
              <div className="flex items-center gap-3">
                <p className="flex-1 text-[28px] font-medium text-[#7FE5E5]/60 tabular-nums select-none">
                  9,000.00
                </p>
                {/* Token Selector Display */}
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-1.5 text-sm font-semibold text-white">
                  <Image
                    src="/crypto/USDC.png"
                    alt="mUSDC"
                    width={18}
                    height={18}
                    className="h-4.5 w-4.5 rounded-full"
                    unoptimized
                  />
                  <span>mUSDC</span>
                </div>
              </div>
            </div>

            {/* Route status / swap details */}
            {isSimulating && (
              <div className="rounded-lg border border-[#7FE5E5]/20 bg-[#7FE5E5]/5 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-white">
                  <span>Simulating swap series...</span>
                  <span className="font-mono text-[#7FE5E5] font-semibold">{simStep}/50 Completed</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#7FE5E5] h-full rounded-full transition-all duration-75"
                    style={{ width: `${(simStep / 50) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-[#7FE5E5]/80">
                  {simStep <= 25 
                    ? `[Pool WETH/USDC] Swap #${simStep}: Selling 4.50 mWETH -> buying 9,000 mUSDC...`
                    : `[Pool USDC/WBTC] Swap #${simStep - 25}: Buying 0.128 mWBTC -> selling 9,000 mUSDC...`
                  }
                </div>
              </div>
            )}

            {/* CTA Button */}
            <div className="mt-4">
              {isSimulating ? (
                <button
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-5 py-3.5 text-[14px] font-semibold text-white/60"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Simulating Swaps ({simStep}/50)
                </button>
              ) : simComplete ? (
                <Button
                  onClick={handleRunSwaps}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black px-5 py-3.5 text-[14px] font-bold transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  50 Swaps Run! (+$1,350 Fees Generated) — Rerun?
                </Button>
              ) : (
                <Button
                  onClick={handleRunSwaps}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#7FE5E5] hover:bg-[#5dd4d4] text-black px-5 py-3.5 text-[14px] font-bold transition-colors"
                >
                  Run 50 Swaps
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Little 3x3 dot mark (matches dashboard style) ---------- */
function DotMarkMini() {
  return (
    <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden="true" className="text-[#7FE5E5]">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={c * 4 + 1} y={r * 4 + 1} width="2" height="2" fill="currentColor" />
        ))
      )}
    </svg>
  )
}
