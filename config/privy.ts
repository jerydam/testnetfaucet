"use client"

import { type Chain } from 'viem'
import { arbitrum, base, lisk, celo, bsc } from 'viem/chains'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export const supportedChains: [Chain, ...Chain[]] = [
  arbitrum,
  base,
  celo,
  lisk,
  bsc,
]

// Privy configuration
export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  config: {
    appearance: {
      accentColor: '#3b82f6',
      logo: 'https://FaucetDrops.io/favicon.png',
      landingHeader: 'Join FaucetDrops',
      loginMessage: 'Connect to start your onchain journey',
      walletChainType: 'ethereum-and-solana', 
},
    loginMethods: ['email', 'wallet', 'google', 'twitter', 'discord', 'telegram', 'farcaster'] as const,
    embeddedWallets: {
      createOnLogin: 'users-without-wallets' as const,
      requireUserPasswordOnCreate: false,
      noPromptOnSignature: false,
    },
    defaultChain: celo,
    supportedChains,
    walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    // 👇 ADD SOLANA CONFIGURATION HERE 👇
   // inside your privyConfig.config object
externalWallets: {
  solana: {
    connectors: toSolanaWalletConnectors({
      shouldAutoConnect: true,
    }),
  },
},
  }
}