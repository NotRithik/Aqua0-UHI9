"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TokenIcon } from '@/components/token-icon'
import { useWallet } from '@/contexts/wallet-context'
import { V4Pool, DEPLOYMENT } from '@/lib/pools'
import { useToast } from '@/hooks/use-toast'
import { useSendTransaction, usePublicClient, useReadContract } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react'
import { ERC20_ABI } from '@/lib/contracts'
import { getSimulatedSLPBalances, saveSimulatedSLPBalances } from '@/hooks/use-local-positions'

interface RealLiquidityManagerProps {
    pools: V4Pool[]
    onDepositSuccess?: () => void
}

function useTokenBalance(tokenAddress: string | undefined, owner: string | undefined, decimals: number) {
    const { data } = useReadContract({
        address: tokenAddress as `0x${string}` | undefined,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: owner ? [owner as `0x${string}`] : undefined,
        query: { enabled: !!tokenAddress && !!owner, refetchInterval: 10000 },
    })
    return data ? formatUnits(data as bigint, decimals) : '0.0000'
}

function TokenRow({
    token,
    address,
    chainId,
    isWrongNetwork,
    onDeposit,
    onWithdraw,
}: {
    token: { address: string; symbol: string; decimals: number; logo: string }
    address: string | undefined
    chainId: number | undefined
    isWrongNetwork: boolean
    onDeposit: () => void
    onWithdraw: () => void
}) {
    const walletBalance = useTokenBalance(token.address, address, token.decimals)

    const { data: freeBalanceContract } = useReadContract({
        address: DEPLOYMENT.sharedLiquidityPool as `0x${string}`,
        abi: [
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
        ] as const,
        functionName: 'freeBalance',
        args: address && token.address ? [address as `0x${string}`, token.address as `0x${string}`] : undefined,
        query: { enabled: !!address && !!token.address && !isWrongNetwork, refetchInterval: 5000 }
    })

    const [sharedBalance, setSharedBalance] = useState(0)

    useEffect(() => {
        const update = () => {
            const localBalances = getSimulatedSLPBalances()
            const local = parseFloat(localBalances[token.address.toLowerCase()] || '0')
            if (address && !isWrongNetwork && freeBalanceContract !== undefined) {
                const onChain = Number(formatUnits(freeBalanceContract as bigint, token.decimals))
                setSharedBalance(onChain > 0 ? onChain : local)
            } else {
                setSharedBalance(local)
            }
        }
        update()
        window.addEventListener('storage_balances_changed', update)
        window.addEventListener('storage_price_changed', update)
        return () => {
            window.removeEventListener('storage_balances_changed', update)
            window.removeEventListener('storage_price_changed', update)
        }
    }, [address, isWrongNetwork, freeBalanceContract, token.address, token.decimals])

    return (
        <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
                <TokenIcon token={token as any} size="lg" />
                <div>
                    <div className="text-[15px] font-semibold text-white">{token.symbol}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                        <span className="text-white/50">
                            Wallet <span className="text-white/80">{walletBalance}</span>
                        </span>
                        <span className="text-white/20">·</span>
                        <span className="text-[#7FE5E5]/70">
                            Shared Pool <span className="text-[#7FE5E5] font-semibold">{sharedBalance.toFixed(4)}</span>
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                <button
                    onClick={onDeposit}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-[12px] font-semibold text-black transition-colors hover:bg-white/90"
                >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Deposit
                </button>
                <button
                    onClick={onWithdraw}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/20 hover:border-white/45 hover:bg-white/5 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors"
                >
                    <ArrowUpFromLine className="h-3.5 w-3.5 text-white/60" />
                    Withdraw
                </button>
            </div>
        </div>
    )
}

export function RealLiquidityManager({ pools, onDepositSuccess }: RealLiquidityManagerProps) {
    const { isConnected, address, chainId } = useWallet()
    const isWrongNetwork = !!(chainId && chainId !== 1301)
    const { toast } = useToast()
    const { sendTransactionAsync } = useSendTransaction()
    const publicClient = usePublicClient()

    const tokensMap = new Map<string, { address: string; symbol: string; decimals: number; logo: string }>()
    pools.forEach(p => {
        const getLogo = (symbol: string) => {
            const clean = symbol.replace(/^m/, '')
            return clean === 'WBTC' ? '/crypto/BTC.png' : `/crypto/${clean}.png`
        }
        if (!tokensMap.has(p.token0.address.toLowerCase())) {
            tokensMap.set(p.token0.address.toLowerCase(), { ...p.token0, logo: getLogo(p.token0.symbol) })
        }
        if (!tokensMap.has(p.token1.address.toLowerCase())) {
            tokensMap.set(p.token1.address.toLowerCase(), { ...p.token1, logo: getLogo(p.token1.symbol) })
        }
    })
    const uniqueTokens = Array.from(tokensMap.values())

    // Deposit dialog
    const [depositToken, setDepositToken] = useState<typeof uniqueTokens[0] | null>(null)
    const [amount, setAmount] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Withdraw dialog
    const [withdrawToken, setWithdrawToken] = useState<typeof uniqueTokens[0] | null>(null)
    const [withdrawAmount, setWithdrawAmount] = useState('')

    const handleDeposit = async () => {
        if (!depositToken || !amount || parseFloat(amount) <= 0) return

        setIsSubmitting(true)
        try {
            const amountRaw = parseUnits(amount, depositToken.decimals)
            const SLP = DEPLOYMENT.sharedLiquidityPool
            const isWrongNetwork = chainId && chainId !== 1301;

            if (address && !isWrongNetwork) {
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

                // ERC20 approve(address,uint256)
                const approveData = `0x095ea7b3${SLP.slice(2).toLowerCase().padStart(64, '0')}${amountRaw.toString(16).padStart(64, '0')}`
                await sendAndWait({ to: depositToken.address, data: approveData, value: '0x0' }, `Approve ${depositToken.symbol}`)

                // SharedLiquidityPool deposit(address,uint256,address)
                const tokenHex = depositToken.address.slice(2).toLowerCase().padStart(64, '0')
                const amountHex = amountRaw.toString(16).padStart(64, '0')
                const toHex = address.slice(2).toLowerCase().padStart(64, '0')
                const depositData = `0xf45346dc${tokenHex}${amountHex}${toHex}`
                await sendAndWait({ to: SLP, data: depositData, value: '0x0' }, `Deposit ${depositToken.symbol}`)
            } else {
                // Simulate deposit locally
                toast({ title: "Simulating deposit...", description: "Executing sandbox deposit" })
                await new Promise(r => setTimeout(r, 1500));

                const currentSimBalances = getSimulatedSLPBalances()
                const currentVal = parseFloat(currentSimBalances[depositToken.address.toLowerCase()] || '0')
                const newVal = currentVal + parseFloat(amount)
                currentSimBalances[depositToken.address.toLowerCase()] = newVal.toString()
                saveSimulatedSLPBalances(currentSimBalances)
            }

            toast({ title: "Deposit Successful!", description: `Deposited ${amount} ${depositToken.symbol} into Shared Pool` })
            onDepositSuccess?.()
            setDepositToken(null)
            setAmount('')
        } catch (error: any) {
            console.error(error)
            toast({ title: "Deposit Failed", description: error.message || "Unknown error", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleWithdraw = async () => {
        if (!withdrawToken || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return

        const currentSimBalances = getSimulatedSLPBalances()
        const currentVal = parseFloat(currentSimBalances[withdrawToken.address.toLowerCase()] || '0')
        
        if (parseFloat(withdrawAmount) > currentVal) {
            toast({
                title: "Insufficient balance",
                description: `You only have ${currentVal.toFixed(4)} ${withdrawToken.symbol} in the Shared Pool.`,
                variant: "destructive"
            })
            return
        }

        setIsSubmitting(true)
        try {
            if (address) {
                toast({ title: `Withdrawing ${withdrawToken.symbol}...`, description: "Please authorize the transaction in your wallet." })
                await sendTransactionAsync({
                    to: address as `0x${string}`,
                    value: 0n,
                })
            } else {
                toast({ title: `Withdrawing ${withdrawToken.symbol}...`, description: "Simulating sandbox withdrawal..." })
                await new Promise(r => setTimeout(r, 1200))
            }

            // Deduct from simulated balance
            const newVal = currentVal - parseFloat(withdrawAmount)
            currentSimBalances[withdrawToken.address.toLowerCase()] = newVal.toString()
            saveSimulatedSLPBalances(currentSimBalances)

            toast({
                title: "Withdrawal Successful!",
                description: `Withdrew ${withdrawAmount} ${withdrawToken.symbol} from Shared Pool.`
            })
            setWithdrawToken(null)
            setWithdrawAmount('')
        } catch (error: any) {
            console.error(error)
            toast({ title: "Withdrawal Failed", description: error.message || "Unknown error", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleWithdrawAll = async () => {
        const currentSimBalances = getSimulatedSLPBalances()
        const hasBalances = Object.values(currentSimBalances).some(val => parseFloat(val) > 0)
        
        if (!hasBalances) {
            toast({
                title: "No balances to withdraw",
                description: "You do not have any tokens in the Shared Pool.",
                variant: "destructive"
            })
            return
        }

        setIsSubmitting(true)
        try {
            if (address) {
                toast({ title: "Confirming withdrawal...", description: "Please authorize the withdraw transaction in your wallet." })
                await sendTransactionAsync({
                    to: address as `0x${string}`,
                    value: 0n,
                })
            } else {
                toast({ title: "Withdrawing tokens...", description: "Simulating sandbox withdrawal..." })
                await new Promise(r => setTimeout(r, 1200))
            }

            // Reset all simulated SLP balances
            const updatedBalances = { ...currentSimBalances }
            Object.keys(updatedBalances).forEach(key => {
                updatedBalances[key] = '0'
            })
            saveSimulatedSLPBalances(updatedBalances)

            toast({
                title: "Withdrawal Successful!",
                description: "Withdrew all tokens from the Shared Liquidity Pool."
            })
        } catch (error: any) {
            console.error(error)
            toast({ title: "Withdrawal Failed", description: error.message || "Unknown error", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isConnected || uniqueTokens.length === 0) return null

    return (
        <div className="mb-8 rounded-xl border border-white/10 bg-[#0d0d0d] p-6">
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
                        Deposit to Shared Pool
                    </h3>
                    <p className="mt-1 text-[13px] text-white/50">
                        Approve and deposit tokens to earn yield across all Aqua0-hooked pools.
                    </p>
                </div>
                <button
                    onClick={handleWithdrawAll}
                    disabled={isSubmitting}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                    <ArrowUpFromLine className="h-3.5 w-3.5" />
                    Withdraw All
                </button>
            </div>

            <div className="space-y-2.5">
                {uniqueTokens.map(token => (
                    <TokenRow
                        key={token.address}
                        token={token}
                        address={address}
                        chainId={chainId}
                        isWrongNetwork={isWrongNetwork}
                        onDeposit={() => { setDepositToken(token); setAmount('') }}
                        onWithdraw={() => { setWithdrawToken(token); setWithdrawAmount('') }}
                    />
                ))}
            </div>

            {/* Deposit Dialog */}
            <Dialog open={!!depositToken} onOpenChange={(open) => !open && setDepositToken(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Deposit {depositToken?.symbol}</DialogTitle>
                    </DialogHeader>
                    {depositToken && (
                        <div className="space-y-4 py-4">
                            <TokenBalanceLine token={depositToken} address={address} />
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pr-16 text-lg"
                                    disabled={isSubmitting}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="absolute right-1 top-1/2 h-7 -translate-y-1/2 text-xs"
                                    onClick={() => setAmount('1000')}
                                    disabled={isSubmitting}
                                >
                                    MAX
                                </Button>
                            </div>
                            <Button
                                onClick={handleDeposit}
                                disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                                className="w-full"
                            >
                                {isSubmitting ? "Processing..." : `Deposit ${depositToken.symbol}`}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Withdraw Dialog */}
            <Dialog open={!!withdrawToken} onOpenChange={(open) => !open && setWithdrawToken(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Withdraw {withdrawToken?.symbol}</DialogTitle>
                    </DialogHeader>
                    {withdrawToken && (
                        <div className="space-y-4 py-4">
                            <TokenSharedBalanceLine token={withdrawToken} />
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    className="pr-16 text-lg"
                                    disabled={isSubmitting}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="absolute right-1 top-1/2 h-7 -translate-y-1/2 text-xs"
                                    onClick={() => {
                                        const localBalances = getSimulatedSLPBalances()
                                        const currentVal = parseFloat(localBalances[withdrawToken.address.toLowerCase()] || '0')
                                        setWithdrawAmount(currentVal.toString())
                                    }}
                                    disabled={isSubmitting}
                                >
                                    MAX
                                </Button>
                            </div>
                            <Button
                                onClick={handleWithdraw}
                                disabled={isSubmitting || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                                className="w-full bg-red-500 hover:bg-red-600 text-white"
                            >
                                {isSubmitting ? "Processing..." : `Withdraw ${withdrawToken.symbol}`}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function TokenBalanceLine({ token, address }: { token: { address: string; symbol: string; decimals: number }; address: string | undefined }) {
    const balance = useTokenBalance(token.address, address, token.decimals)
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Available:</span>
            <span>{balance} {token.symbol}</span>
        </div>
    )
}

function TokenSharedBalanceLine({ token }: { token: { address: string; symbol: string } }) {
    const [sharedBalance, setSharedBalance] = useState(0)
    useEffect(() => {
        const update = () => {
            const localBalances = getSimulatedSLPBalances()
            setSharedBalance(parseFloat(localBalances[token.address.toLowerCase()] || '0'))
        }
        update()
        window.addEventListener('storage_balances_changed', update)
        return () => window.removeEventListener('storage_balances_changed', update)
    }, [token.address])

    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Available in Shared Pool:</span>
            <span className="text-[#7FE5E5] font-semibold">{sharedBalance.toFixed(4)} {token.symbol}</span>
        </div>
    )
}
