import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@/contexts/wallet-context'
import { getLocalPositions } from './use-local-positions'
import { parseUnits } from 'viem'
import { safeParseBigInt } from '@/lib/safe-math'

export interface UserPosition {
    positionId: string;
    poolId: string;
    tickLower: number;
    tickUpper: number;
    liquidityShares: string;
    active: boolean;
}

export function useUserPositions(chainId: number) {
    const { address } = useWallet();

    return useQuery({
        queryKey: ['v4UserPositions', chainId, address],
        queryFn: async () => {
            if (!address) return [];
            // Map our local positions (active only)
            const local = getLocalPositions().filter(p => p.active);
            return local.map(p => {
                const rawShares = p.liquidityShares || '0';
                let wadShares: bigint;
                try {
                    const parsedVal = Number(rawShares);
                    if (!isNaN(parsedVal) && parsedVal >= 1e9) {
                        wadShares = safeParseBigInt(rawShares);
                    } else {
                        wadShares = parseUnits(rawShares, 18);
                    }
                } catch {
                    wadShares = parseUnits(rawShares, 18);
                }

                return {
                    positionId: p.positionId,
                    poolId: p.poolId,
                    tickLower: p.tickLower,
                    tickUpper: p.tickUpper,
                    liquidityShares: wadShares.toString(),
                    active: p.active
                };
            }) as UserPosition[];
        },
        enabled: !!address && !!chainId,
    });
}

