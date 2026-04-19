"use client"
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { ZeroAddress, FallbackProvider, JsonRpcProvider } from "ethers"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"

export interface Network {
  name: string
  symbol: string
  chainId: number
  rpcUrl: string | string[]          // ← Now supports array for automatic fallbacks
  blockExplorerUrls: string
  explorerUrl?: string
  color: string
  logoUrl: string
  iconUrl?: string
  factoryAddresses: string[]
  factories: {
    dropcode?: string
    droplist?: string
    custom?: string
    quest?: string
    quiz?: string
  }
  tokenAddress: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
  defaultTokens?: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  }[];
}

// =============================================
// UPDATED NETWORKS WITH MULTIPLE RPC FALLBACKS
// =============================================
export const networks: Network[] = [
  {
    name: "Celo Sepolia",
    symbol: "CELO",
    chainId: 11142220,
    rpcUrl: [
      "https://sepolia.celo.org",
      "https://celo-sepolia.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-",
      "https://celo-sepolia.infura.io/v3/e9fa8c3350054dafa40019a5b604679f",
    ],
    blockExplorerUrls: "https://sepolia.celoscan.io",
    explorerUrl: "https://sepolia.celoscan.io",
    color: "#35D07F",
    logoUrl: "/celo.png",
    iconUrl: "/celo.png",
    factoryAddresses: [],
    factories: {
      droplist: "",
      dropcode: "",
      custom: "",
      quest: "",
      quiz: "",
    },
    tokenAddress: "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9", // Celo testnet token
    nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
    isTestnet: true,
  },
  {
    name: "Lisk Sepolia",
    symbol: "LSK",
    chainId: 4202,
    rpcUrl: [
      "https://rpc.sepolia-api.lisk.com",
      "https://lisk-sepolia.drpc.org",
    ],
    blockExplorerUrls: "https://sepolia-blockscout.lisk.com",
    explorerUrl: "https://sepolia-blockscout.lisk.com",
    color: "#0D4477",
    logoUrl: "/lsk.png",
    iconUrl: "/lsk.png",
    factoryAddresses: [],
    factories: {
      droplist: "",
      dropcode: "",
      custom: "",
      quest: "",
      quiz: "",
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: true,
  },
  {
    name: "Arbitrum Sepolia",
    symbol: "ARB",
    chainId: 421614,
    rpcUrl: [
      "https://sepolia-rollup.arbitrum.io/rpc",
      "https://arb-sepolia.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-",
      "https://arbitrum-sepolia.infura.io/v3/e9fa8c3350054dafa40019a5b604679f",
      "https://rpc.ankr.com/arbitrum_sepolia",
      "https://arbitrum-sepolia.drpc.org",
    ],
    blockExplorerUrls: "https://sepolia.arbiscan.io",
    explorerUrl: "https://sepolia.arbiscan.io",
    color: "#28A0F0",
    logoUrl: "/arb.jpeg",
    iconUrl: "/arb.jpeg",
    factoryAddresses: [],
    factories: {
      droplist: "",
      dropcode: "",
      custom: "",
      quest: "",
      quiz: "",
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: true,
  },
  {
    name: "Base Sepolia",
    symbol: "BASE",
    chainId: 84532,
    rpcUrl: [
      "https://sepolia.base.org",
      "https://base-sepolia.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-",
      "https://base-sepolia.infura.io/v3/e9fa8c3350054dafa40019a5b604679f",
      "https://rpc.ankr.com/base_sepolia",
      "https://base-sepolia.drpc.org",
    ],
    blockExplorerUrls: "https://sepolia.basescan.org",
    explorerUrl: "https://sepolia.basescan.org",
    color: "#0052FF",
    logoUrl: "/base.png",
    iconUrl: "/base.png",
    factoryAddresses: [],
    factories: {
      droplist: "",
      dropcode: "",
      custom: "",
      quest: "",
      quiz: "",
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    isTestnet: true,
  },
  {
    name: "BNB Testnet",
    symbol: "BNB",
    chainId: 97,
    rpcUrl: [
      "https://data-seed-prebsc-1-s1.binance.org:8545/",
      "https://data-seed-prebsc-2-s1.binance.org:8545/",
      "https://bnb-testnet.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-",
      "https://rpc.ankr.com/bsc_testnet_chapel",
      "https://bsc-testnet.drpc.org",
    ],
    blockExplorerUrls: "https://testnet.bscscan.com",
    explorerUrl: "https://testnet.bscscan.com",
    color: "#F3BA2F",
    logoUrl: "/bnb.jpg",
    iconUrl: "/bnb.jpg",
    factoryAddresses: [],
    factories: {
      droplist: "",
      dropcode: "",
      custom: "",
      quest: "",
      quiz: "",
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    isTestnet: true,
  },
  {
    name: "Solana Devnet",
    symbol: "SOL",
    chainId: 102,
    rpcUrl: ["https://api.devnet.solana.com"],
    blockExplorerUrls: "https://solscan.io/?cluster=devnet",
    color: "#14F195",
    logoUrl: "/solana.png",
    iconUrl: "/solana.png",
    factoryAddresses: [],
    factories: {
      dropcode: "",
      quest: "719GaXbsBWwskSVKZDykUMX6mur7BiCVjNSSWS7KMwtp",
      quiz: "719GaXbsBWwskSVKZDykUMX6mur7BiCVjNSSWS7KMwtp",
    },
    tokenAddress: "11111111111111111111111111111111",
    nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
    isTestnet: true,
  },
]

// =============================================
// NEW HELPER FUNCTIONS (RPC fallback support)
// =============================================

/**
 * Returns all RPC URLs for a network as an array (always safe)
 */
export function getRpcUrls(network: Network | null): string[] {
  if (!network) return []
  return Array.isArray(network.rpcUrl)
    ? network.rpcUrl.filter(Boolean)
    : [network.rpcUrl].filter(Boolean)
}

/**
 * Returns the primary (fastest) RPC URL
 */
export function getPrimaryRpcUrl(network: Network | null): string {
  return getRpcUrls(network)[0] || ""
}

/**
 * Creates an ethers FallbackProvider with automatic failover
 * (use this in your wallet hooks or contract calls for 429/rate-limit protection)
 */
export function createFallbackProvider(network: Network | null) {
  const urls = getRpcUrls(network)
  if (urls.length === 0) return null

  const providers = urls.map((url) => new JsonRpcProvider(url))
  return new FallbackProvider(providers, 1) // quorum = 1
}

interface NetworkContextType {
  network: Network | null
  networks: Network[]
  setNetwork: (network: Network) => void
  switchNetwork: (chainId: number) => Promise<void>
  getLatestFactoryAddress: (network?: Network) => string | null
  getFactoryAddress: (factoryType: 'dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz', network?: Network) => string | null
  isSwitchingNetwork: boolean
  currentChainId: number | null
  isConnecting: boolean
}

const NetworkContext = createContext<NetworkContextType>({
  network: null,
  networks: networks,
  setNetwork: () => {},
  switchNetwork: async () => {},
  getLatestFactoryAddress: () => null,
  getFactoryAddress: () => null,
  isSwitchingNetwork: false,
  currentChainId: null,
  isConnecting: false,
})

export function NetworkProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [network, setNetworkState] = useState<Network | null>(null)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  
  const { chainId: rawChainId, address, switchChain } = useWallet()
  
  // Parse chainId to number early (handle hex or decimal string)
  const parseChainId = (id: string | number | null | undefined): number | null => {
    if (!id) return null
    const idStr = String(id)
    if (idStr.startsWith('0x')) {
      const parsed = parseInt(idStr, 16)
      console.log(`[parseChainId] Hex parse: '${idStr}' -> ${parsed}`)
      return isNaN(parsed) ? null : parsed
    } else {
      const parsed = Number(idStr)
      console.log(`[parseChainId] Decimal parse: '${idStr}' -> ${parsed}`)
      return isNaN(parsed) ? null : parsed
    }
  }
  
  const currentChainId = parseChainId(rawChainId)
  
  // Use ref to always have fresh values - update synchronously on every render
  const walletRef = useRef({ address, chainId: rawChainId, switchChain })
  walletRef.current = { address, chainId: rawChainId, switchChain }

  // Debug: Log network state changes
  useEffect(() => {
    console.log(`[NetworkProvider] State:`, {
      networkName: network?.name,
      networkChainId: network?.chainId,
      rawChainId,
      parsedChainId: currentChainId,
      address,
      hasAddress: !!address,
      isSwitchingNetwork,
      isConnecting,
      walletRef: walletRef.current
    })
  }, [network, rawChainId, currentChainId, address, isSwitchingNetwork, isConnecting])

  // FIXED: Separate effect for connection state (runs when address changes, before chainId)
  useEffect(() => {
    console.log(`[NetworkProvider] Connection effect:`, { rawChainId, parsedChainId: currentChainId, address })
    if (address && currentChainId === null) {
      console.log(`[NetworkProvider] ⏳ Wallet connecting... (address ready, awaiting valid chainId)`)
      setIsConnecting(true)
    } else if (!address) {
      console.log(`[NetworkProvider] ❌ No wallet connected`)
      setIsConnecting(false)
      setNetworkState(null)
    }
  }, [address, rawChainId, currentChainId])

  // FIXED: Dedicated effect for chainId updates (triggers network set/reset)
  useEffect(() => {
    console.log(`[NetworkProvider] chainId effect:`, { rawChainId, parsedChainId: currentChainId, hasAddress: !!address, isConnecting })
    
    // If wallet is connected but no valid chainId yet, keep waiting
    if (currentChainId === null) {
      if (address) {
        console.log(`[NetworkProvider] ⏳ Waiting for valid chainId... (raw: ${rawChainId})`)
        return
      }
      // If no wallet connected, clear everything
      console.log(`[NetworkProvider] ❌ No chainId and no address`)
      setNetworkState(null)
      return
    }
    
    setIsConnecting(false) // Clear connecting state
    
    const currentNetwork = networks.find((n) => n.chainId === currentChainId)
    
    if (currentNetwork) {
      console.log(`[NetworkProvider] ✅ Setting network: ${currentNetwork.name} (parsed chainId: ${currentChainId})`)
      setNetworkState(currentNetwork)
      
      // Only show toast if this is a user-initiated change (not initial load)
      if (network && network.chainId !== currentChainId) {
        toast({
          title: "Network Changed",
          description: `Switched to ${currentNetwork.name}`,
        })
      }
    } else {
      console.log(`[NetworkProvider] ⚠️ Unsupported chainId: ${currentChainId} (raw: ${rawChainId})`)
      setNetworkState(null)
      toast({
        title: "Unsupported Network",
        description: `Chain ID ${currentChainId} is not supported. Please switch to Celo, Lisk, Arbitrum, Base, BNB .`,
        variant: "destructive",
      })
    }
  }, [rawChainId, address, network, toast, currentChainId]) // Include currentChainId for reactivity

  const getLatestFactoryAddress = (targetNetwork?: Network) => {
    const selectedNetwork = targetNetwork || network
    return selectedNetwork?.factoryAddresses[selectedNetwork.factoryAddresses.length - 1] || null
  }

  const getFactoryAddress = (factoryType: 'dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz', targetNetwork?: Network) => {
    const selectedNetwork = targetNetwork || network
    if (!selectedNetwork) return null
    return selectedNetwork.factories[factoryType] || null
  }

  const switchNetwork = useCallback(async (targetChainId: number) => {
    // Get fresh values from ref
    const { address: currentAddress, chainId: currentRawChainId, switchChain: currentSwitchChain } = walletRef.current
    
    console.log(`[NetworkProvider: switchNetwork] Called with:`, {
      targetChainId,
      currentAddress,
      currentRawChainId,
      currentParsedChainId: parseChainId(currentRawChainId),
      hasAddress: !!currentAddress,
      refValues: walletRef.current
    })
    
    if (!currentAddress) {
      console.log(`[NetworkProvider: switchNetwork] ❌ No wallet connected`)
      toast({
        title: "No Wallet Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    if (isSwitchingNetwork) {
      console.log(`[NetworkProvider: switchNetwork] ⏳ Already switching, ignoring`)
      return
    }

    const targetNetwork = networks.find((n) => n.chainId === targetChainId)
    if (!targetNetwork) {
      console.log(`[NetworkProvider: switchNetwork] ❌ Network not found: ${targetChainId}`)
      toast({
        title: "Network Not Supported",
        description: `Chain ID ${targetChainId} is not supported`,
        variant: "destructive",
      })
      return
    }
    
    // Already on target network (compare parsed)
    const currentParsed = parseChainId(currentRawChainId)
    if (currentParsed === targetChainId) {
      console.log(`[NetworkProvider: switchNetwork] ✅ Already on ${targetNetwork.name}`)
      return
    }

    try {
      setIsSwitchingNetwork(true)
      console.log(`[NetworkProvider: switchNetwork] ⏳ Switching to ${targetNetwork.name}...`)

      // Let the wallet switch and the useEffect will update the UI
      await currentSwitchChain(targetChainId)
      console.log(`[NetworkProvider: switchNetwork] ✅ Switch completed`)

      toast({
        title: "Network Switched",
        description: `Successfully switched to ${targetNetwork.name}`,
      })
    } catch (error: any) {
      console.error(`[NetworkProvider: switchNetwork] ❌ Error:`, error)
      
      toast({
        title: "Network Switch Failed",
        description: error?.message || `Could not switch to ${targetNetwork.name}`,
        variant: "destructive",
      })
    } finally {
      setIsSwitchingNetwork(false)
    }
  }, [isSwitchingNetwork, toast])

  const handleSetNetwork = useCallback((newNetwork: Network) => {
    console.log(`[NetworkProvider: handleSetNetwork] Request to switch: ${newNetwork.name}`)
    switchNetwork(newNetwork.chainId)
  }, [switchNetwork])

  return (
    <NetworkContext.Provider
      value={{
        network,
        networks,
        setNetwork: handleSetNetwork,
        switchNetwork,
        getLatestFactoryAddress,
        getFactoryAddress,
        isSwitchingNetwork,
        currentChainId,
        isConnecting,
      }}
    >
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  return useContext(NetworkContext)
}

export function getMainnetNetworks() {
  return networks.filter(network => !network.isTestnet)
}

export function getTestnetNetworks() {
  return networks.filter(network => network.isTestnet)
}

export function getNetworkByChainId(chainId: number) {
  return networks.find(network => network.chainId === chainId)
}

export function isFactoryTypeAvailable(chainId: number, factoryType: 'dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz'): boolean {
  const network = getNetworkByChainId(chainId)
  if (!network) return false
  return !!network.factories[factoryType]
}

// ✅ UPDATED TYPE HERE
export function getAvailableFactoryTypes(chainId: number): ('dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz')[] {
  const network = getNetworkByChainId(chainId)
  if (!network) return []
  
  const availableTypes: ('dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz')[] = []
  if (network.factories.dropcode) availableTypes.push('dropcode')
  if (network.factories.droplist) availableTypes.push('droplist')
  if (network.factories.custom) availableTypes.push('custom')
  if (network.factories.quest) availableTypes.push('quest')
  if (network.factories.quiz) availableTypes.push('quiz') // ✅ Included quiz
  
  return availableTypes
}