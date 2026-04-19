"use client"
import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { useDisconnect, useSwitchChain, useChainId } from 'wagmi'
import { usePrivy, useWallets, type ConnectedWallet } from '@privy-io/react-auth'

import { toast } from "sonner"

// Define a local interface that extends ConnectedWallet to include the missing fields
interface ExtendedConnectedWallet extends ConnectedWallet {
  chainType?: 'ethereum' | 'solana';
}

interface WalletContextType {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  walletType: 'embedded' | 'external' | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  disconnectExternalWallet: () => Promise<void>
  ensureCorrectNetwork: (requiredChainId: number) => Promise<boolean>
  switchChain: (newChainId: number) => Promise<void>
  refreshProvider: () => Promise<void>
}

export const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  walletType: null,
  connect: async () => {},
  disconnect: async () => {},
  disconnectExternalWallet: async () => {},
  ensureCorrectNetwork: async () => false,
  switchChain: async () => {},
  refreshProvider: async () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [walletType, setWalletType] = useState<'embedded' | 'external' | null>(null)
  const [liveChainId, setLiveChainId] = useState<number | null>(null)

  const { ready, authenticated, login, logout, user, linkWallet } = usePrivy()
  const { wallets } = useWallets()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain: wagmiSwitchChain } = useSwitchChain()
  const wagmiChainId = useChainId()

  // ✅ Fix: Compute solanaWallets with type casting
 const solanaWallets = useMemo(() => {
  // linkedAccounts has chainType, useWallets() does NOT reliably have it
  const solanaAddresses = new Set(
    (user?.linkedAccounts || [])
      .filter((acc: any) => acc.type === 'wallet' && acc.chainType === 'solana')
      .map((acc: any) => acc.address)
  )
  
  // Match back to ConnectedWallet objects (which have getEthereumProvider etc.)
  const matched = wallets.filter(w => solanaAddresses.has(w.address))
  
  // Fallback: if no match but linkedAccounts has solana wallets,
  // it means the wallet object isn't in useWallets() yet (not connected)
  if (matched.length === 0 && solanaAddresses.size > 0) {
    console.warn('[WalletProvider] Solana linkedAccounts exist but no matching ConnectedWallet found.')
    console.log('[WalletProvider] solanaAddresses:', [...solanaAddresses])
    console.log('[WalletProvider] wallets:', wallets.map(w => ({ addr: w.address, type: w.walletClientType })))
  }

  return matched
}, [wallets, user?.linkedAccounts])

const getActiveWallet = useCallback(() => {
  if (!authenticated || wallets.length === 0) return null

  // ✅ KEY FIX: "external" means they have a connected external EVM wallet,
  // NOT just that they didn't use social login.
  const externalEvmWallet = wallets.find(
    w => w.walletClientType !== 'privy' && 
    (w as ExtendedConnectedWallet).chainType === 'ethereum'
  )
  const hasExternalEvm = !!externalEvmWallet

  if (liveChainId === 102) {
    const embeddedSolana = solanaWallets.find(w => w.walletClientType === 'privy')
    const externalSolana = solanaWallets.find(w => w.walletClientType !== 'privy')

    if (hasExternalEvm) {
      // External user: external Solana wins, fall back to embedded
      return externalSolana || embeddedSolana || solanaWallets[0]
    } else {
      // Embedded-only user: always use embedded Solana
      return embeddedSolana || solanaWallets[0]
    }
  } else {
    const embeddedEvm = wallets.find(
      w => w.walletClientType === 'privy' && 
      (w as ExtendedConnectedWallet).chainType === 'ethereum'
    )

    if (hasExternalEvm) {
      return externalEvmWallet || embeddedEvm || wallets[0]
    } else {
      return embeddedEvm || wallets[0]
    }
  }
}, [authenticated, wallets, solanaWallets, liveChainId])

  const activeWallet = getActiveWallet()
  const address = activeWallet?.address || null
  const isConnected = ready && authenticated && !!address && (liveChainId === 102 || !!signer)
  const isConnecting = !ready || (authenticated && wallets.length > 0 && !address)

  const setupProvider = useCallback(async (wallet = activeWallet) => {
    if (!wallet) {
      setProvider(null)
      setSigner(null)
      setWalletType(null)
      setLiveChainId(null)
      return
    }

    const extWallet = wallet as ExtendedConnectedWallet;

    try {
      // ✅ Fix: Use the casted wallet to check chainType
      if (extWallet.chainType === 'solana') {
        console.log('🪐 [WalletProvider] Solana wallet detected:', wallet.address)
        setProvider(null)
        setSigner(null)
        setWalletType(wallet.walletClientType === 'privy' ? 'embedded' : 'external')
        setLiveChainId(102) 
        return
      }

      // EXISTING EVM LOGIC
      const isEmbedded = wallet.walletClientType === 'privy'
      const ethereumProvider = await wallet.getEthereumProvider()
      const ethersProvider = new BrowserProvider(ethereumProvider)
      const network = await ethersProvider.getNetwork()
      const detectedChainId = Number(network.chainId)
      const ethersSigner = await ethersProvider.getSigner()

      setProvider(ethersProvider)
      setSigner(ethersSigner)
      setWalletType(isEmbedded ? 'embedded' : 'external')
      setLiveChainId(detectedChainId)
    } catch (error) {
      console.error('❌ [WalletProvider] Error setting up wallet:', error)
      setProvider(null)
      setSigner(null)
      setWalletType(null)
      setLiveChainId(null)
    }
  }, [activeWallet])

  const refreshProvider = useCallback(async () => {
    await setupProvider()
  }, [setupProvider])

  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      setupProvider()
    }
  }, [authenticated, wallets.length, activeWallet?.address, setupProvider])

  useEffect(() => {
    if (!activeWallet || (activeWallet as ExtendedConnectedWallet).chainType === 'solana') return
    let rawProvider: any = null

    const handleChainChange = async () => {
      await setupProvider()
    }

    const attach = async () => {
      try {
        rawProvider = await activeWallet.getEthereumProvider()
        rawProvider.on?.('chainChanged', handleChainChange)
        rawProvider.on?.('accountsChanged', refreshProvider)
      } catch (e) {
        console.error('[WalletProvider] Could not attach chain listener', e)
      }
    }
    attach()
    return () => {
      rawProvider?.removeListener?.('chainChanged', handleChainChange)
      rawProvider?.removeListener?.('accountsChanged', refreshProvider)
    }
  }, [activeWallet?.address, setupProvider, refreshProvider])

  // UI Protection
  useEffect(() => {
    if (ready && authenticated && wallets.length === 0) {
      const timer = setTimeout(() => {
        if (wallets.length === 0) {
          toast.error("External wallet missing. Please log in again.")
          logout()
        }
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [ready, authenticated, wallets.length, logout])

  const connect = async () => {
    try { await login() } catch { toast.error("Failed to connect wallet") }
  }

  const disconnect = async () => {
    wagmiDisconnect()
    setProvider(null)
    setSigner(null)
    setWalletType(null)
    setLiveChainId(null)
    await logout()
  }

  const disconnectExternalWallet = async () => {
    const externalWallet = wallets.find(w => w.walletClientType !== 'privy')
    if (externalWallet) {
      await externalWallet.disconnect()
      wagmiDisconnect()
    }
  }

  const switchChain = async (newChainId: number) => {
    if (!activeWallet) throw new Error("No wallet connected")
      
   if (newChainId === 102) {
  // ADD THIS TEMPORARILY
  console.log('[switchChain] user linkedAccounts:', user?.linkedAccounts)
  console.log('[switchChain] all wallets:', wallets.map(w => ({ 
    addr: w.address, 
    type: w.walletClientType,
    chainType: (w as any).chainType 
  })))
  console.log('[switchChain] solanaWallets resolved:', solanaWallets.map(w => w.address))
  
  const embeddedSolana = solanaWallets.find(w => w.walletClientType === 'privy')
  const externalSolana = solanaWallets.find(w => w.walletClientType !== 'privy')

  // ✅ KEY FIX: Determine user type by whether they have external EVM, not by
  // what wallet is currently active (which might be mid-switch state)
  const hasExternalEvm = wallets.some(
    w => w.walletClientType !== 'privy' && 
    (w as ExtendedConnectedWallet).chainType === 'ethereum'
  )

  if (!hasExternalEvm) {
  if (embeddedSolana) {
    setLiveChainId(102)
    await setupProvider(embeddedSolana)
    toast.success("Switched to Solana")
    return
  } else {
    // Check if it exists in linkedAccounts but not yet as ConnectedWallet
    const solanaInLinked = (user?.linkedAccounts || []).find(
      (acc: any) => acc.type === 'wallet' && acc.chainType === 'solana' && acc.walletClientType === 'privy'
    )
    if (solanaInLinked) {
      // Wallet exists but isn't active yet — set chain ID and let setupProvider handle it
      // Privy should auto-connect it; force a re-render
      toast.info("Loading your Solana wallet...")
      setLiveChainId(102)
      // Give Privy a moment to hydrate the wallet
      await new Promise(r => setTimeout(r, 800))
      await setupProvider()
      return
    }
    toast.error("Embedded Solana wallet not found. Try logging out and back in.")
    return
  }
} else {
    // External user → prefer external Solana
    if (externalSolana) {
      setLiveChainId(102)
      await setupProvider(externalSolana)
      toast.success("Switched to Solana")
      return
    } else {
      // Has external EVM but no external Solana yet → prompt to link
      toast.info("Please link your Solana wallet (Phantom, Solflare) to use this network.")
      linkWallet()
      return
    }
  }
}
    // 🌐 SWITCHING FROM SOLANA BACK TO EVM
    let evmWalletToSwitch = activeWallet;

    if ((activeWallet as ExtendedConnectedWallet).chainType === 'solana') {
       const isCurrentlyEmbedded = activeWallet.walletClientType === 'privy'
       const evmWallets = wallets.filter(w => (w as ExtendedConnectedWallet).chainType === 'ethereum')
       
       // Match external -> external, or embedded -> embedded
       const exactMatchEvm = evmWallets.find(w => isCurrentlyEmbedded ? w.walletClientType === 'privy' : w.walletClientType !== 'privy')
       evmWalletToSwitch = exactMatchEvm || evmWallets[0]

       if (!evmWalletToSwitch) {
          toast.error("Please connect an EVM wallet first.")
          return
       }
       
       // Update internal state instantly
       setLiveChainId(newChainId)
       await setupProvider(evmWalletToSwitch)
    }

    // Process the actual EVM provider network request
    const hexChainId = `0x${newChainId.toString(16)}`
    try {
      const rawProvider = await evmWalletToSwitch.getEthereumProvider()

      try {
        await rawProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        })
      } catch (switchErr: any) {
        if (switchErr.code === 4902 || switchErr.message?.includes("Unrecognized chain ID")) {
          await wagmiSwitchChain({ chainId: newChainId })
        } else {
          throw switchErr
        }
      }

      // Verify the chain actually switched on mobile/external providers
      let confirmed = false
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 500))
        try {
          const ethProvider = new BrowserProvider(rawProvider)
          const network = await ethProvider.getNetwork()
          if (Number(network.chainId) === newChainId) {
            confirmed = true
            break
          }
        } catch {}
      }

      if (!confirmed) {
        toast.warning("Network may not have switched — please verify in your wallet")
      }

      await setupProvider(evmWalletToSwitch)
      toast.success("Network switched")

    } catch (error: any) {
      if (error?.code === 4001 || error?.message?.includes("rejected")) {
        toast.error("Network switch cancelled")
      } else {
        toast.error("Failed to switch network — try switching manually in your wallet")
      }
      throw error
    }
  }

  const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
    if (!isConnected) {
      await connect()
      return false
    }
    const currentChain = liveChainId ?? wagmiChainId
    if (currentChain !== requiredChainId) {
      await switchChain(requiredChainId)
      return true
    }
    return true
  }

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId: liveChainId ?? wagmiChainId ?? null,
        isConnected,
        isConnecting,
        walletType,
        connect,
        disconnect,
        disconnectExternalWallet,
        ensureCorrectNetwork,
        switchChain,
        refreshProvider,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}