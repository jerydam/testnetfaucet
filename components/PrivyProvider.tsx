"use client"

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { privyConfig, supportedChains } from '@/config/privy'
import { http } from 'viem'
import { createConfig } from 'wagmi'

// Create wagmi config once (SINGLE SOURCE OF TRUTH)
const wagmiConfig = createConfig({
  chains: supportedChains,
  transports: {
    [supportedChains[0].id]: http(), // Arbitrum
    [supportedChains[1].id]: http(), // Base
    [supportedChains[2].id]: http(), // Celo
    [supportedChains[3].id]: http(), // Lisk
    [supportedChains[4].id]: http(), // BSC
    
  },
})

// Create query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={privyConfig.appId}
      config={privyConfig.config}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}