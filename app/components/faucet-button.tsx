"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/contexts/wallet-context'
import { useSendTransaction, usePublicClient, useReadContract } from 'wagmi'
import { FAUCET_ADDRESS, FAUCET_ABI } from '@/lib/contracts'
import { useToast } from '@/hooks/use-toast'
import { Droplets, Check, Loader2 } from 'lucide-react'

export function FaucetButton() {
    const { isConnected, address, chainId } = useWallet()
    const { toast } = useToast()
    const { sendTransactionAsync } = useSendTransaction()
    const publicClient = usePublicClient()
    const [isClaiming, setIsClaiming] = useState(false)
    const [claimed, setClaimed] = useState(false)

    // Read last claim time
    const { data: lastClaim } = useReadContract({
        address: FAUCET_ADDRESS,
        abi: FAUCET_ABI,
        functionName: 'lastClaim',
        args: address ? [address] : undefined,
        query: { enabled: !!address && FAUCET_ADDRESS !== '0x0000000000000000000000000000000000000000' }
    })

    const cooldownActive = lastClaim && Number(lastClaim) > 0 && 
        Date.now() / 1000 < Number(lastClaim) + 60

    const handleClaim = async () => {
        if (!address || FAUCET_ADDRESS === '0x0000000000000000000000000000000000000000') {
            toast({ title: "Faucet not deployed", description: "Deploy the Faucet contract first", variant: "destructive" })
            return
        }

        if (chainId && chainId !== 1301) {
            toast({ title: "Wrong network", description: "Please switch to Unichain Sepolia (chain 1301)", variant: "destructive" })
            return
        }

        setIsClaiming(true)
        try {
            toast({ title: "Claiming tokens...", description: "Waiting for wallet confirmation" })
            
            // Encode the claim() call
            const data = '0x4e4d7a65' // claim() selector
            
            const hash = await sendTransactionAsync({
                to: FAUCET_ADDRESS,
                data: data as `0x${string}`,
            })
            
            toast({ title: "Claiming tokens...", description: "Waiting for chain confirmation..." })
            await publicClient!.waitForTransactionReceipt({ hash })
            
            toast({ title: "Tokens received!", description: "100,000 USDC + 50 WETH + 1 WBTC" })
            setClaimed(true)
            setTimeout(() => setClaimed(false), 5000)
        } catch (error: any) {
            console.error(error)
            toast({ title: "Claim failed", description: error.message || "Unknown error", variant: "destructive" })
        } finally {
            setIsClaiming(false)
        }
    }

    if (!isConnected) return null

    return (
        <Button
            onClick={handleClaim}
            disabled={isClaiming || cooldownActive}
            variant="outline"
            size="sm"
            className="gap-2"
        >
            {isClaiming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : claimed ? (
                <Check className="h-4 w-4 text-green-500" />
            ) : (
                <Droplets className="h-4 w-4" />
            )}
            {cooldownActive ? 'Cooldown...' : claimed ? 'Claimed!' : 'Get Testnet Tokens'}
        </Button>
    )
}
