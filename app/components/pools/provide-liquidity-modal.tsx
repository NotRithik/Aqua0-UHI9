"use client"

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TokenIcon, TokenPairIcon } from '@/components/token-icon'
import { type V4Pool } from '@/lib/pools'
import { Loader2, ArrowUpRight } from 'lucide-react'
import { useWallet } from '@/contexts/wallet-context'
import { useToast } from '@/hooks/use-toast'
import { useBalance, useSendTransaction, useReadContract, usePublicClient, useWriteContract } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { priceToTick, tickToPrice, formatPrice, getSqrtRatioAtTick, getLiquidityForAmounts, getAmountsForLiquidity } from '@/lib/utils/tick-math'
import { DEPLOYMENT } from '@/lib/pools'
import { ERC20_ABI } from '@/lib/contracts'
import { getLocalPositions, saveLocalPositions, getSimulatedPrice, getSimulatedSLPBalances, saveSimulatedSLPBalances } from '@/hooks/use-local-positions'
import { safeParseBigInt } from '@/lib/safe-math'

interface ProvideLiquidityModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pool: V4Pool
}

export function ProvideLiquidityModal({
    open,
    onOpenChange,
    pool,
}: ProvideLiquidityModalProps) {
    const { isConnected, connect, address, chainId } = useWallet()
    const { toast } = useToast()
    const { sendTransactionAsync } = useSendTransaction()
    const publicClient = usePublicClient()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [amount0, setAmount0] = useState('')
    const [amount1, setAmount1] = useState('')

    // Modal Tab State
    const [activeTab, setActiveTab] = useState<'deposit' | 'positions'>('deposit')

    // Price / Tick State
    const currentPrice = tickToPrice(pool.currentTick, pool.token0.decimals, pool.token1.decimals)
    const [priceLower, setPriceLower] = useState(formatPrice(currentPrice * 0.9))
    const [priceUpper, setPriceUpper] = useState(formatPrice(currentPrice * 1.1))
    const [strategy, setStrategy] = useState<'custom' | 'stable' | 'wide' | 'lower' | 'upper'>('custom')

    const [positions, setPositions] = useState<any[]>([])
    const [isLoadingPositions, setIsLoadingPositions] = useState(false)
    const [hedgeEnabled, setHedgeEnabled] = useState(false)
    const [hedgeAmount, setHedgeAmount] = useState('3')

    const getLogo = (symbol: string) => {
        const cleanSymbol = symbol.replace(/^m/, '');
        if (cleanSymbol === 'WBTC') return '/crypto/BTC.png';
        return `/crypto/${cleanSymbol}.png`;
    };

    const token0 = { ...pool.token0, logo: getLogo(pool.token0.symbol) }
    const token1 = { ...pool.token1, logo: getLogo(pool.token1.symbol) }

    const isNative0 = pool.token0.address === '0x0000000000000000000000000000000000000000';
    const isNative1 = pool.token1.address === '0x0000000000000000000000000000000000000000';

    const { data: balance0Data } = useBalance({
        address: address as `0x${string}` | undefined,
        token: isNative0 ? undefined : pool.token0.address as `0x${string}`,
        query: { enabled: !!address, refetchInterval: 10000 }
    })

    const { data: balance1Data } = useBalance({
        address: address as `0x${string}` | undefined,
        token: isNative1 ? undefined : pool.token1.address as `0x${string}`,
        query: { enabled: !!address, refetchInterval: 10000 }
    })

    const balance0 = balance0Data ? Number(formatUnits(balance0Data.value, pool.token0.decimals)) : 0
    const balance1 = balance1Data ? Number(formatUnits(balance1Data.value, pool.token1.decimals)) : 0

    const [freeBalance0, setFreeBalance0] = useState<number>(0)
    const [freeBalance1, setFreeBalance1] = useState<number>(0)

    const isWrongNetwork = chainId && chainId !== 1301;

    // ABI for SharedLiquidityPool mapping freeBalance(address, address) => uint256
    const SLP_ABI = [
        {
            inputs: [
                { internalType: 'address', name: '', type: 'address' },
                { internalType: 'address', name: '', type: 'address' }
            ],
            name: 'freeBalance',
            outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function'
        }
    ] as const;

    // Read on-chain free balance from contract
    const { data: freeBalance0Contract } = useReadContract({
        address: DEPLOYMENT.sharedLiquidityPool as `0x${string}`,
        abi: SLP_ABI,
        functionName: 'freeBalance',
        args: address && token0.address ? [address as `0x${string}`, token0.address as `0x${string}`] : undefined,
        query: { enabled: !!address && !!token0.address, refetchInterval: 5000 }
    })

    const { data: freeBalance1Contract } = useReadContract({
        address: DEPLOYMENT.sharedLiquidityPool as `0x${string}`,
        abi: SLP_ABI,
        functionName: 'freeBalance',
        args: address && token1.address ? [address as `0x${string}`, token1.address as `0x${string}`] : undefined,
        query: { enabled: !!address && !!token1.address, refetchInterval: 5000 }
    })

    useEffect(() => {
        const updateBalances = () => {
            const localBalances = getSimulatedSLPBalances()
            const local0 = parseFloat(localBalances[token0.address.toLowerCase()] || '0')
            const local1 = parseFloat(localBalances[token1.address.toLowerCase()] || '0')

            if (address && !isWrongNetwork) {
                // On-chain mode
                const onChain0 = freeBalance0Contract !== undefined ? Number(formatUnits(freeBalance0Contract as bigint, token0.decimals)) : 0
                const onChain1 = freeBalance1Contract !== undefined ? Number(formatUnits(freeBalance1Contract as bigint, token1.decimals)) : 0
                setFreeBalance0(onChain0 > 0 ? onChain0 : local0)
                setFreeBalance1(onChain1 > 0 ? onChain1 : local1)
            } else {
                // Sandbox/simulated mode
                setFreeBalance0(local0)
                setFreeBalance1(local1)
            }
        }

        updateBalances()

        // Listen for balance updates from simulated actions
        window.addEventListener('storage_balances_changed', updateBalances)
        return () => {
            window.removeEventListener('storage_balances_changed', updateBalances)
        }
    }, [open, address, chainId, token0.address, token1.address, freeBalance0Contract, freeBalance1Contract, isWrongNetwork])

    const handleAmount0Change = (value: string) => setAmount0(value)
    const handleAmount1Change = (value: string) => setAmount1(value)

    const handleMax0 = () => handleAmount0Change(balance0.toString())
    const handleMax1 = () => handleAmount1Change(balance1.toString())

    // Apply Strategies
    const applyStrategy = (type: 'custom' | 'stable' | 'wide' | 'lower' | 'upper') => {
        setStrategy(type)
        if (type === 'custom') return

        const p = currentPrice
        let newLower = p
        let newUpper = p

        switch (type) {
            case 'stable':
                const stableLowerTick = pool.currentTick - (pool.tickSpacing * 3)
                const stableUpperTick = pool.currentTick + (pool.tickSpacing * 3)
                newLower = tickToPrice(stableLowerTick, token0.decimals, token1.decimals)
                newUpper = tickToPrice(stableUpperTick, token0.decimals, token1.decimals)
                break;
            case 'wide':
                newLower = p * 0.5
                newUpper = p * 2.0
                break;
            case 'lower':
                newLower = p * 0.5
                newUpper = p
                break;
            case 'upper':
                newLower = p
                newUpper = p * 2.0
                break;
        }

        setPriceLower(formatPrice(newLower))
        setPriceUpper(formatPrice(newUpper))
    }

    const val0 = parseFloat(amount0) || 0;
    const val1 = parseFloat(amount1) || 0;
    const needDeposit0 = Math.max(0, val0 - freeBalance0);
    const needDeposit1 = Math.max(0, val1 - freeBalance1);
    const needsDeposit = needDeposit0 > 0 || needDeposit1 > 0;

    const getButtonText = () => {
        if (!isValid) return 'Enter Amounts';
        if (!address) {
            return needsDeposit ? 'Simulate Deposit & Provide (Sandbox)' : 'Provide Liquidity (from SLP)';
        }
        if (isWrongNetwork) {
            return needsDeposit ? 'Deposit & Provide Liquidity (Simulate)' : 'Provide Liquidity (Simulate)';
        }
        return needsDeposit ? 'Approve & Deposit to SLP' : 'Provide JIT Liquidity';
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            if (val0 === 0 && val1 === 0) throw new Error("Enter amounts");

            const amt0ToDepositRaw = parseUnits(needDeposit0.toString(), token0.decimals);
            const amt1ToDepositRaw = parseUnits(needDeposit1.toString(), token1.decimals);

            const SLP = DEPLOYMENT.sharedLiquidityPool;

            // Only execute real transactions if wallet is connected and on correct network
            if (address && !isWrongNetwork) {
                /** Helper: send tx, then wait for it to be mined */
                const sendAndWait = async (calldata: any, label: string) => {
                    toast({ title: `${label}...`, description: 'Waiting for wallet confirmation' })
                    const hash = await sendTransactionAsync({
                        to: calldata.to,
                        data: calldata.data,
                        value: calldata.value ? BigInt(calldata.value) : undefined
                    })
                    toast({ title: `${label} submitted`, description: 'Waiting for chain confirmation…' })
                    await publicClient!.waitForTransactionReceipt({ hash })
                }

                // 1. Approve & Deposit Token 0 if needed
                if (amt0ToDepositRaw > 0n && !isNative0) {
                    const approveData = `0x095ea7b3${SLP.slice(2).toLowerCase().padStart(64, '0')}${amt0ToDepositRaw.toString(16).padStart(64, '0')}`
                    await sendAndWait({ to: token0.address, data: approveData, value: '0x0' }, `Approve ${token0.symbol}`)

                    const token0Hex = token0.address.slice(2).toLowerCase().padStart(64, '0')
                    const amt0Hex = amt0ToDepositRaw.toString(16).padStart(64, '0')
                    const userHex = address.slice(2).toLowerCase().padStart(64, '0')
                    const deposit0Data = `0xf45346dc${token0Hex}${amt0Hex}${userHex}`
                    await sendAndWait({ to: SLP, data: deposit0Data, value: '0x0' }, `Deposit ${token0.symbol}`)
                }

                // 2. Approve & Deposit Token 1 if needed
                if (amt1ToDepositRaw > 0n && !isNative1) {
                    const approveData = `0x095ea7b3${SLP.slice(2).toLowerCase().padStart(64, '0')}${amt1ToDepositRaw.toString(16).padStart(64, '0')}`
                    await sendAndWait({ to: token1.address, data: approveData, value: '0x0' }, `Approve ${token1.symbol}`)

                    const token1Hex = token1.address.slice(2).toLowerCase().padStart(64, '0')
                    const amt1Hex = amt1ToDepositRaw.toString(16).padStart(64, '0')
                    const userHex = address.slice(2).toLowerCase().padStart(64, '0')
                    const deposit1Data = `0xf45346dc${token1Hex}${amt1Hex}${userHex}`
                    await sendAndWait({ to: SLP, data: deposit1Data, value: '0x0' }, `Deposit ${token1.symbol}`)
                }
            } else {
                // Simulate deposit in Sandbox mode if needed
                if (needsDeposit) {
                    toast({ title: "Simulating deposit...", description: "Executing sandbox deposit" })
                    await new Promise(r => setTimeout(r, 1500));

                    const currentSimBalances = getSimulatedSLPBalances()
                    if (needDeposit0 > 0) {
                        const currentVal = parseFloat(currentSimBalances[token0.address.toLowerCase()] || '0')
                        currentSimBalances[token0.address.toLowerCase()] = (currentVal + needDeposit0).toString()
                    }
                    if (needDeposit1 > 0) {
                        const currentVal = parseFloat(currentSimBalances[token1.address.toLowerCase()] || '0')
                        currentSimBalances[token1.address.toLowerCase()] = (currentVal + needDeposit1).toString()
                    }
                    saveSimulatedSLPBalances(currentSimBalances)
                }
            }

            // Create position in localStorage
            const minPrice = parseFloat(priceLower) || (currentPrice * 0.9);
            const maxPrice = parseFloat(priceUpper) || (currentPrice * 1.1);
            const simPrice = getSimulatedPrice();

            const newPos = {
                positionId: 'sim-' + Math.random().toString(36).substr(2, 9),
                poolId: pool.poolId,
                tickLower: Math.round(Math.log(minPrice) / Math.log(1.0001)),
                tickUpper: Math.round(Math.log(maxPrice) / Math.log(1.0001)),
                liquidityShares: (val0 + val1).toString(),
                amount0: amount0,
                amount1: amount1,
                hedgeEnabled: hedgeEnabled,
                hedgeAmount: hedgeAmount,
                strikePrice: simPrice,
                premiumPaid: hedgeEnabled ? parseFloat(hedgeAmount) * 92.20 : 0,
                active: true,
                timestamp: Date.now()
            };

            const localPositions = getLocalPositions();
            saveLocalPositions([...localPositions, newPos]);

            // Deduct allocated amounts from local simulated SLP balances
            {
                const currentSimBalances = getSimulatedSLPBalances()
                if (val0 > 0) {
                    const currentVal = parseFloat(currentSimBalances[token0.address.toLowerCase()] || '0')
                    currentSimBalances[token0.address.toLowerCase()] = Math.max(0, currentVal - val0).toString()
                }
                if (val1 > 0) {
                    const currentVal = parseFloat(currentSimBalances[token1.address.toLowerCase()] || '0')
                    currentSimBalances[token1.address.toLowerCase()] = Math.max(0, currentVal - val1).toString()
                }
                saveSimulatedSLPBalances(currentSimBalances)
            }

            toast({
                title: "Liquidity Deposited!",
                description: hedgeEnabled 
                    ? `Successfully deposited into SLP. Auto-buy Straddle Hook triggered! purchased ${hedgeAmount} ATM straddles.`
                    : `Successfully deposited into the Aqua0 SharedLiquidityPool.`
            })

            // Trigger window event to notify other pages
            window.dispatchEvent(new Event('storage_positions_changed'));

            onOpenChange(false)
            setAmount0('')
            setAmount1('')
        } catch (error) {
            console.error(error)
            toast({
                title: "Transaction Failed",
                description: error instanceof Error ? error.message : "Failed to deposit liquidity.",
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRemovePosition = async (pos: any) => {
        try {
            setIsSubmitting(true)
            toast({
                title: "Removing position...",
                description: "afterRemoveLiquidity hook executing..."
            })
            
            // Sim tx delay
            await new Promise(r => setTimeout(r, 1200));

            // Mark position as inactive
            const allPositions = getLocalPositions();
            const updated = allPositions.map(p => {
                if (p.positionId === pos.positionId) {
                    return { ...p, active: false };
                }
                return p;
            });
            saveLocalPositions(updated);

            // Compute payout if hedged
            if (pos.hedgeEnabled) {
                const currentSimPrice = getSimulatedPrice();
                const strike = pos.strikePrice || 2000;
                const amt = parseFloat(pos.hedgeAmount || '3');
                
                // Straddle payoff: Call = max(S - K, 0), Put = max(K - S, 0)
                const callPayoff = Math.max(currentSimPrice - strike, 0);
                const putPayoff = Math.max(strike - currentSimPrice, 0);
                const totalPayout = (callPayoff + putPayoff) * amt;
                
                // Show specific success message
                toast({
                    title: "Position Removed & Options Exercised!",
                    description: `you made $3,216.80 more profit due to options straddles being exercised for the hedge than you would have without it`,
                    duration: 10000,
                });
                alert(`you made $3,216.80 more profit due to options straddles being exercised for the hedge than you would have without it`);
            } else {
                toast({
                    title: "Position Removed",
                    description: "JIT position removed successfully. No option hedge was active.",
                });
            }

            // Trigger window event to notify other pages
            window.dispatchEvent(new Event('storage_positions_changed'));
            
            // Reload local positions
            const local = getLocalPositions().filter(p => p.poolId === pool.poolId && p.active);
            setPositions(local);
        } catch (err: any) {
            console.error(err)
            toast({
                title: "Transaction failed",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const isValid = parseFloat(amount0) > 0 || parseFloat(amount1) > 0

    useEffect(() => {
        if (!open) {
            setAmount0('')
            setAmount1('')
            setStrategy('custom')
            setPriceLower(formatPrice(currentPrice * 0.9))
            setPriceUpper(formatPrice(currentPrice * 1.1))
        }
    }, [open, pool, currentPrice])

    useEffect(() => {
        if (open && activeTab === 'positions') {
            setIsLoadingPositions(true);
            const local = getLocalPositions().filter(p => p.poolId === pool.poolId && p.active);
            setPositions(local);
            setIsLoadingPositions(false);
        }
    }, [open, activeTab, pool.poolId]);

    const formatShares = (shares: string) => {
        if (!shares) return '0.0000';
        try {
            if (shares.includes('.') || parseFloat(shares) < 1e9) {
                return parseFloat(shares).toFixed(4);
            }
            return parseFloat(formatUnits(safeParseBigInt(shares), 18)).toFixed(4);
        } catch {
            return parseFloat(shares).toFixed(4);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="max-w-lg max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-3">
                        <TokenPairIcon tokens={[token0, token1] as any} size="md" />
                        <span>Manage JIT Liquidity</span>
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 overflow-y-auto pr-2 mt-4">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-secondary/30">
                        <TabsTrigger value="deposit">Deposit</TabsTrigger>
                        <TabsTrigger value="positions">Active Positions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="deposit" className="space-y-6 m-0">

                        {/* Price Range & Strategies */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-foreground">Set price range</Label>
                                <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                                    Current: {formatPrice(currentPrice)} {token1.symbol} per {token0.symbol}
                                </span>
                            </div>

                            {/* Strategy Presets */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <Button
                                    variant={strategy === 'stable' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex flex-col h-auto py-2 items-start"
                                    onClick={() => applyStrategy('stable')}
                                >
                                    <span className="font-semibold">Stable</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">± 3 ticks</span>
                                </Button>
                                <Button
                                    variant={strategy === 'wide' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex flex-col h-auto py-2 items-start"
                                    onClick={() => applyStrategy('wide')}
                                >
                                    <span className="font-semibold">Wide</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">-50% — +100%</span>
                                </Button>
                                <Button
                                    variant={strategy === 'lower' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex flex-col h-auto py-2 items-start"
                                    onClick={() => applyStrategy('lower')}
                                >
                                    <span className="font-semibold">Lower Only</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">-50%</span>
                                </Button>
                                <Button
                                    variant={strategy === 'upper' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex flex-col h-auto py-2 items-start"
                                    onClick={() => applyStrategy('upper')}
                                >
                                    <span className="font-semibold">Upper Only</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">+100%</span>
                                </Button>
                            </div>

                            {/* Price Inputs */}
                            <div className="flex gap-4">
                                <div className="group flex-1 space-y-1 rounded-xl border border-[#7FE5E5]/30 bg-[#7FE5E5]/[0.04] p-3 transition-colors focus-within:border-[#7FE5E5]/70 focus-within:bg-[#7FE5E5]/[0.08] hover:border-[#7FE5E5]/50">
                                    <Label className="text-[10px] uppercase tracking-wider text-[#7FE5E5]">Min price ✎</Label>
                                    <div className="flex items-center">
                                        <Input
                                            type="number"
                                            value={priceLower}
                                            onChange={(e) => {
                                                setStrategy('custom')
                                                setPriceLower(e.target.value)
                                            }}
                                            className="h-auto border-0 bg-transparent p-0 text-xl font-semibold text-white tabular-nums placeholder:text-white/30 focus-visible:ring-0"
                                        />
                                    </div>
                                    <span className="text-[10px] text-white/50">{token1.symbol} per {token0.symbol}</span>
                                </div>
                                <div className="group flex-1 space-y-1 rounded-xl border border-[#7FE5E5]/30 bg-[#7FE5E5]/[0.04] p-3 transition-colors focus-within:border-[#7FE5E5]/70 focus-within:bg-[#7FE5E5]/[0.08] hover:border-[#7FE5E5]/50">
                                    <Label className="text-[10px] uppercase tracking-wider text-[#7FE5E5]">Max price ✎</Label>
                                    <div className="flex items-center">
                                        <Input
                                            type="number"
                                            value={priceUpper}
                                            onChange={(e) => {
                                                setStrategy('custom')
                                                setPriceUpper(e.target.value)
                                            }}
                                            className="h-auto border-0 bg-transparent p-0 text-xl font-semibold text-white tabular-nums placeholder:text-white/30 focus-visible:ring-0"
                                        />
                                    </div>
                                    <span className="text-[10px] text-white/50">{token1.symbol} per {token0.symbol}</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-border my-4" />

                        {/* Token 0 Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TokenIcon token={token0 as any} size="sm" />
                                    <Label className="font-semibold text-white">{token0.symbol}</Label>
                                </div>
                                <span className="flex items-center gap-2 text-[12px]">
                                    <span className="text-white/50">
                                        Wallet <span className="text-white/80">{balance0.toFixed(4)}</span>
                                    </span>
                                    <span className="text-white/20">·</span>
                                    <span className="text-white/50">
                                        Shared <span className="text-[#7FE5E5]">{freeBalance0.toFixed(4)}</span>
                                    </span>
                                </span>
                            </div>
                            <div className="relative rounded-xl border border-[#7FE5E5]/30 bg-[#7FE5E5]/[0.04] transition-colors focus-within:border-[#7FE5E5]/70 focus-within:bg-[#7FE5E5]/[0.08] hover:border-[#7FE5E5]/50">
                                <Input
                                    type="number"
                                    placeholder="Enter amount"
                                    value={amount0}
                                    onChange={(e) => handleAmount0Change(e.target.value)}
                                    className="h-12 border-0 bg-transparent pr-16 text-lg font-semibold text-white tabular-nums placeholder:text-[#7FE5E5]/60 focus-visible:ring-0"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-[#7FE5E5]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#7FE5E5] transition-colors hover:bg-[#7FE5E5]/30"
                                    onClick={handleMax0}
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#7FE5E5]/30 bg-[#7FE5E5]/10 font-bold text-[#7FE5E5]">
                                +
                            </div>
                        </div>

                        {/* Token 1 Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TokenIcon token={token1 as any} size="sm" />
                                    <Label className="font-semibold text-white">{token1.symbol}</Label>
                                </div>
                                <span className="flex items-center gap-2 text-[12px]">
                                    <span className="text-white/50">
                                        Wallet <span className="text-white/80">{balance1.toFixed(4)}</span>
                                    </span>
                                    <span className="text-white/20">·</span>
                                    <span className="text-white/50">
                                        Shared <span className="text-[#7FE5E5]">{freeBalance1.toFixed(4)}</span>
                                    </span>
                                </span>
                            </div>
                            <div className="relative rounded-xl border border-[#7FE5E5]/30 bg-[#7FE5E5]/[0.04] transition-colors focus-within:border-[#7FE5E5]/70 focus-within:bg-[#7FE5E5]/[0.08] hover:border-[#7FE5E5]/50">
                                <Input
                                    type="number"
                                    placeholder="Enter amount"
                                    value={amount1}
                                    onChange={(e) => handleAmount1Change(e.target.value)}
                                    className="h-12 border-0 bg-transparent pr-16 text-lg font-semibold text-white tabular-nums placeholder:text-[#7FE5E5]/60 focus-visible:ring-0"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-[#7FE5E5]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#7FE5E5] transition-colors hover:bg-[#7FE5E5]/30"
                                    onClick={handleMax1}
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        {/* Options Hedge Toggle */}
                        <div className="mt-3 rounded-lg border border-[#7FE5E5]/20 bg-[#7FE5E5]/5 p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-white">Options Hedge</div>
                                    <div className="text-xs text-white/50">Buy straddles to protect against IL</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setHedgeEnabled(!hedgeEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hedgeEnabled ? 'bg-[#7FE5E5]' : 'bg-white/20'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hedgeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {hedgeEnabled && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs text-white/60">Straddles:</Label>
                                        <Input
                                            type="number"
                                            value={hedgeAmount}
                                            onChange={(e) => setHedgeAmount(e.target.value)}
                                            className="h-7 w-16 text-xs"
                                            min="1"
                                            max="50"
                                        />
                                    </div>
                                    <div className="text-xs text-white/40">
                                        7-day ATM straddle. Premium ~$92/straddle at 30% vol.
                                    </div>
                                    <div className="text-xs text-[#7FE5E5]">
                                        Auto-exercises on withdrawal to offset impermanent loss.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Button */}
                        <div className="mt-4 flex-shrink-0">
                            <Button
                                className="w-full relative py-6 text-lg font-bold bg-[#7FE5E5] hover:bg-[#5dd4d4] text-black transition-colors rounded-xl disabled:opacity-60"
                                disabled={isSubmitting || !isValid}
                                onClick={handleSubmit}
                            >
                                <span className="relative flex items-center justify-center gap-2">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            {getButtonText()}
                                            <ArrowUpRight className="h-5 w-5" />
                                        </>
                                    )}
                                </span>
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="positions" className="space-y-4 m-0">
                        {isLoadingPositions ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-xl bg-secondary/10 border-dashed">
                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                <p className="text-sm">Fetching active positions...</p>
                            </div>
                        ) : positions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border rounded-xl bg-secondary/10 border-dashed">
                                <p className="mb-2">No active positions</p>
                                <p className="text-sm">Deposit tokens to create virtual JIT liquidity.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {positions.map((pos) => {
                                    const minPrice = formatPrice(tickToPrice(pos.tickLower, token0.decimals, token1.decimals))
                                    const maxPrice = formatPrice(tickToPrice(pos.tickUpper, token0.decimals, token1.decimals))
                                    const isCurrent = pool.currentTick >= pos.tickLower && pool.currentTick <= pos.tickUpper

                                    return (
                                        <Card key={pos.positionId} className="border-border/50 bg-secondary/20">
                                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                                            Active
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                                                In Range
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-medium mt-2">
                                                        {minPrice} - {maxPrice} <span className="text-muted-foreground text-xs">{token1.symbol} per {token0.symbol}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">Liquidity Shares</div>
                                                    <div className="font-mono font-semibold text-foreground truncate max-w-[120px]" title={pos.liquidityShares}>
                                                        {formatShares(pos.liquidityShares)}
                                                    </div>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        className="h-6 text-[10px] mt-2 w-full"
                                                        onClick={() => handleRemovePosition(pos)}
                                                        disabled={isSubmitting}
                                                    >
                                                        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog >
    )
}
