import { useQuery } from '@tanstack/react-query'
import { useBalance } from 'wagmi'
import type { Address } from 'viem'

export interface SharedBalance {
    token: string
    freeBalance: string
    walletBalance: string
    earnedFees: string
}

export function useSharedBalances(chainId: number | undefined, address: string | undefined, tokens: string[]) {
    return useQuery({
        queryKey: ['shared-balances', chainId, address, tokens.join(',')],
        queryFn: async () => {
            if (!chainId || !address || tokens.length === 0) return []
            return tokens.map(token => ({
                token,
                freeBalance: '0',
                walletBalance: '0',
                earnedFees: '0',
            }))
        },
        enabled: !!chainId && !!address && tokens.length > 0,
        refetchInterval: 10000,
    })
}
