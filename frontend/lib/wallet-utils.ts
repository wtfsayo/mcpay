import { type Connector } from 'wagmi'

// Check if MetaMask is available in the browser
export function isMetaMaskAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).ethereum?.isMetaMask
}

// Check if Coinbase Wallet is available in the browser
export function isCoinbaseWalletAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).ethereum?.isCoinbaseWallet || !!(window as any).coinbaseWalletExtension
}

// Check if Porto is available in the browser
export function isPortoAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as any).ethereum?.isPorto || !!(window as any).porto
}

// Check if current connector is MetaMask
export function isMetaMaskConnector(connector?: Connector): boolean {
  if (!connector) return false
  return connector.name.toLowerCase().includes('metamask') || connector.id === 'metaMask'
}

// Check if current connector is Coinbase Wallet
export function isCoinbaseWalletConnector(connector?: Connector): boolean {
  if (!connector) return false
  return connector.name.toLowerCase().includes('coinbase') || connector.id === 'coinbaseWallet'
}

// Check if current connector is Porto
export function isPortoConnector(connector?: Connector): boolean {
  if (!connector) return false
  return connector.name.toLowerCase().includes('porto') || connector.id === 'porto'
}

// Verify MetaMask connection status
export function verifyMetaMaskConnection(
  isConnected: boolean, 
  address?: string, 
  connector?: Connector
): {
  isValid: boolean
  error?: string
  warnings: string[]
} {
  const warnings: string[] = []
  
  if (!isConnected) {
    return {
      isValid: false,
      error: 'Wallet not connected',
      warnings
    }
  }

  if (!address) {
    return {
      isValid: false,
      error: 'No wallet address found',
      warnings
    }
  }

  // Check if MetaMask is the preferred connector
  if (connector && !isMetaMaskConnector(connector)) {
    warnings.push(`Connected via ${connector.name} instead of MetaMask`)
  }

  // Check if MetaMask is available but not being used
  if (isMetaMaskAvailable() && connector && !isMetaMaskConnector(connector)) {
    warnings.push('MetaMask is available but not being used')
  }

  return {
    isValid: true,
    warnings
  }
}

// Verify wallet connection status (generic for any wallet)
export function verifyWalletConnection(
  isConnected: boolean, 
  address?: string, 
  connector?: Connector
): {
  isValid: boolean
  error?: string
  warnings: string[]
} {
  const warnings: string[] = []
  
  if (!isConnected) {
    return {
      isValid: false,
      error: 'Wallet not connected',
      warnings
    }
  }

  if (!address) {
    return {
      isValid: false,
      error: 'No wallet address found',
      warnings
    }
  }

  return {
    isValid: true,
    warnings
  }
}

// Get connection status with detailed information
export function getConnectionStatus(
  isConnected: boolean,
  address?: string,
  connector?: Connector,
  chainId?: number
): {
  status: 'disconnected' | 'connected' | 'connecting' | 'error'
  details: {
    hasAddress: boolean
    connectorName?: string
    isMetaMask: boolean
    isCoinbaseWallet: boolean
    isPorto: boolean
    chainId?: number
    address?: string
  }
  recommendations: string[]
} {
  const recommendations: string[] = []
  
  if (!isConnected) {
    return {
      status: 'disconnected',
      details: {
        hasAddress: false,
        isMetaMask: false,
        isCoinbaseWallet: false,
        isPorto: false
      },
      recommendations: ['Connect your wallet to continue']
    }
  }

  const isMetaMask = connector ? isMetaMaskConnector(connector) : false
  const isCoinbaseWallet = connector ? isCoinbaseWalletConnector(connector) : false
  const isPorto = connector ? isPortoConnector(connector) : false
  
  if (!address) {
    recommendations.push('Try reconnecting your wallet')
    return {
      status: 'error',
      details: {
        hasAddress: false,
        connectorName: connector?.name,
        isMetaMask,
        isCoinbaseWallet,
        isPorto,
        chainId
      },
      recommendations
    }
  }

  // Add recommendations based on setup
  if (isMetaMaskAvailable() && !isMetaMask && !isCoinbaseWallet && !isPorto) {
    recommendations.push('Consider using MetaMask for better compatibility')
  }
  
  if (isCoinbaseWalletAvailable() && !isMetaMask && !isCoinbaseWallet && !isPorto) {
    recommendations.push('Consider using Coinbase Wallet for enhanced features')
  }

  if (isPortoAvailable() && !isMetaMask && !isCoinbaseWallet && !isPorto) {
    recommendations.push('Consider using Porto for Web3 payments')
  }

  if (chainId !== 84532) { // Base Sepolia
    recommendations.push('Switch to Base Sepolia network for full functionality')
  }

  return {
    status: 'connected',
    details: {
      hasAddress: true,
      connectorName: connector?.name,
      isMetaMask,
      isCoinbaseWallet,
      isPorto,
      chainId,
      address
    },
    recommendations
  }
}

// MetaMask-specific network switching
export async function switchToBaseSepolia(): Promise<boolean> {
  if (!isMetaMaskAvailable()) {
    throw new Error('MetaMask not available')
  }

  try {
    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x14a34' }], // Base Sepolia chain ID in hex
    })
    return true
  } catch (error: any) {
    // Chain doesn't exist, try to add it
    if (error.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x14a34',
            chainName: 'Base Sepolia',
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          }],
        })
        return true
      } catch (addError) {
        console.error('Failed to add Base Sepolia network:', addError)
        return false
      }
    }
    console.error('Failed to switch to Base Sepolia:', error)
    return false
  }
}

// Generic network switching for supported wallets
export async function switchToBaseSepoliaGeneric(): Promise<boolean> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No wallet provider available')
  }

  try {
    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x14a34' }], // Base Sepolia chain ID in hex
    })
    return true
  } catch (error: any) {
    // Chain doesn't exist, try to add it
    if (error.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x14a34',
            chainName: 'Base Sepolia',
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          }],
        })
        return true
      } catch (addError) {
        console.error('Failed to add Base Sepolia network:', addError)
        return false
      }
    }
    console.error('Failed to switch to Base Sepolia:', error)
    return false
  }
} 