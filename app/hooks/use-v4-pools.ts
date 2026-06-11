import { useQuery } from '@tanstack/react-query'
import { HARDCODED_POOLS } from '@/lib/pools'

export function useV4Pools(chainId: number | undefined) {
    return useQuery({
        queryKey: ['v4-pools', chainId],
        queryFn: () => Promise.resolve(HARDCODED_POOLS),
        enabled: !!chainId,
        refetchInterval: 15000,
    })
}
