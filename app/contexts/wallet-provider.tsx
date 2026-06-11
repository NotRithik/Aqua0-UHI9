'use client'

import { type ReactNode, useEffect } from 'react'
import { PrivyProvider, usePrivy, useLogin, useLogout } from '@privy-io/react-auth'
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAccount, useSwitchChain } from 'wagmi'
import { config } from '@/lib/wagmi'
import { unichainSepolia } from 'viem/chains'
import { WalletContext } from './wallet-context'
import type { WalletContextType } from './wallet-context'

const queryClient = new QueryClient()
const REQUIRED_CHAIN_ID = 1301 // Unichain Sepolia

function WalletContextInner({ children }: { children: ReactNode }) {
  const { authenticated, ready, user } = usePrivy()
  const { address, chainId } = useAccount()
  const { login } = useLogin()
  const { logout } = useLogout()
  const { switchChain } = useSwitchChain()

  // Auto-switch to Unichain Sepolia if user is on wrong chain
  useEffect(() => {
    if (authenticated && address && chainId && chainId !== REQUIRED_CHAIN_ID) {
      console.log(`Wallet on chain ${chainId}, switching to Unichain Sepolia (${REQUIRED_CHAIN_ID})`)
      switchChain({ chainId: REQUIRED_CHAIN_ID }).catch((err) => {
        console.error('Failed to switch chain:', err)
      })
    }
  }, [authenticated, address, chainId, switchChain])

  const email = user?.email?.address ?? null

  const value: WalletContextType = {
    isConnected: authenticated && !!address,
    address: address ?? null,
    chainId,
    connect: () => login(),
    disconnect: () => logout(),
    isConnecting: !ready,
    email,
    isAuthenticated: authenticated,
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        appearance: {
          theme: 'dark',
          accentColor: '#dc2626',
          walletChainType: 'ethereum-only',
        },
        supportedChains: [unichainSepolia],
        defaultChain: unichainSepolia,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <SmartWalletsProvider>
            <WalletContextInner>
              {children}
            </WalletContextInner>
          </SmartWalletsProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
