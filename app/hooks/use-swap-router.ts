import { useQuery } from '@tanstack/react-query'
import { DEPLOYMENT } from '@/lib/pools'

export function useSwapRouter(chainId: number | undefined) {
    return useQuery({
        queryKey: ['v4-router', chainId],
        queryFn: () => Promise.resolve(DEPLOYMENT.poolSwapTest),
        enabled: !!chainId,
    })
}
