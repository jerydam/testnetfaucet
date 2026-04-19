"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { ZeroAddress } from "ethers"
import { toast } from "sonner"

export interface Network {
  name: string
  chainId: bigint
  rpcUrl: string
  blockExplorerUrls: string
  explorerUrl?: string
  color: string
  factoryAddress: string
  tokenAddress: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
}

interface NetworkContextType {
  network: Network | null
  networks: Network[]
  setNetwork: (network: Network) => void
  switchNetwork: (chainId: number) => Promise<void>
}

const networks: Network[] = [
  {
    name: "Celo Sepolia",
    chainId: BigInt(11142220),
    rpcUrl: "https://forno.celo-sepolia.celo-testnet.org",
    blockExplorerUrls: "https://sepolia.celoscan.io",
    explorerUrl: "https://sepolia.celoscan.io",
    color: "#35D07F",
    factoryAddress: "", // Deploy and fill in
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "Celo",
      symbol: "CELO",
      decimals: 18,
    },
    isTestnet: true,
  },
  {
    name: "Lisk Sepolia",
    chainId: BigInt(4202),
    rpcUrl: "https://rpc.sepolia-api.lisk.com",
    blockExplorerUrls: "https://sepolia-blockscout.lisk.com",
    explorerUrl: "https://sepolia-blockscout.lisk.com",
    color: "#0D4477",
    factoryAddress: "", // Deploy and fill in
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    isTestnet: true,
  },
  {
    name: "Arbitrum Sepolia",
    chainId: BigInt(421614),
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorerUrls: "https://sepolia.arbiscan.io",
    explorerUrl: "https://sepolia.arbiscan.io",
    color: "#28A0F0",
    factoryAddress: "", // Deploy and fill in
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    isTestnet: true,
  },
  {
    name: "Base Sepolia",
    chainId: BigInt(84532),
    rpcUrl: "https://sepolia.base.org",
    blockExplorerUrls: "https://sepolia.basescan.org",
    explorerUrl: "https://sepolia.basescan.org",
    color: "#0052FF",
    factoryAddress: "", // Deploy and fill in
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    isTestnet: true,
  },
]

const NetworkContext = createContext<NetworkContextType>({
  network: null,
  networks: networks,
  setNetwork: () => { },
  switchNetwork: async () => { },
})

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<Network | null>(networks[0])
  const [currentChainId, setCurrentChainId] = useState<bigint | null>(null)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)

  useEffect(() => {
    const detectCurrentChain = async () => {
      if (typeof window === "undefined" || !window.ethereum) return
      try {
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
        const chainId = BigInt(chainIdHex)
        setCurrentChainId(chainId)
        const detectedNetwork = networks.find((n) => n.chainId === chainId)
        if (detectedNetwork) setNetwork(detectedNetwork)
      } catch (error) {
        console.error("Error detecting chain:", error)
      }
    }

    detectCurrentChain()

    if (window.ethereum) {
      const handleChainChanged = (chainIdHex: string) => {
        try {
          const chainId = BigInt(chainIdHex)
          setCurrentChainId(chainId)
          const detectedNetwork = networks.find((n) => n.chainId === chainId)
          if (detectedNetwork) {
            setNetwork(detectedNetwork)
          } else {
            toast.error(
              "Unsupported network. Please switch to Celo Alfajores, Lisk Sepolia, Arbitrum Sepolia, or Base Sepolia."
            )
          }
          window.location.reload()
        } catch (error) {
          console.error("Error handling chain change:", error)
        }
      }

      window.ethereum.on("chainChanged", handleChainChanged)
      return () => {
        if (window.ethereum?.removeListener)
          window.ethereum.removeListener("chainChanged", handleChainChanged)
      }
    }
  }, [])

  const switchNetwork = async (chainId: number) => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("No Ethereum provider found. Please install MetaMask or a similar wallet.")
      return
    }
    if (isSwitchingNetwork) return

    const targetNetwork = networks.find((n) => n.chainId === BigInt(chainId))
    if (!targetNetwork) {
      toast.error(
        "Unsupported network. Please switch to Celo Alfajores, Lisk Sepolia, Arbitrum Sepolia, or Base Sepolia."
      )
      return
    }

    try {
      setIsSwitchingNetwork(true)
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
      setNetwork(targetNetwork)
      setCurrentChainId(BigInt(chainId))
      window.location.reload()
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${chainId.toString(16)}`,
                chainName: targetNetwork.name,
                nativeCurrency: targetNetwork.nativeCurrency,
                rpcUrls: [targetNetwork.rpcUrl],
                blockExplorerUrls: [targetNetwork.blockExplorerUrls],
              },
            ],
          })
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          })
          setNetwork(targetNetwork)
          setCurrentChainId(BigInt(chainId))
          window.location.reload()
        } catch (addError: any) {
          toast.error(`Could not add ${targetNetwork.name}: ${addError.message}`)
        }
      } else {
        toast.error(`Could not switch to ${targetNetwork.name}: ${error.message}`)
      }
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  const handleSetNetwork = (newNetwork: Network) => {
    setNetwork(newNetwork)
    switchNetwork(Number(newNetwork.chainId))
  }

  return (
    <NetworkContext.Provider value={{ network, networks, setNetwork: handleSetNetwork, switchNetwork }}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  return useContext(NetworkContext)
}