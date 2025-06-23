/**
 * Multi-chain blockchain explorer utilities
 * Supports different explorers for each network
 */

import { NETWORKS, type Network } from './tokens'

/**
 * Get the appropriate explorer URL for a network
 */
export const getExplorerBaseUrl = (network: Network): string => {
  const networkInfo = NETWORKS[network]
  if (!networkInfo || !networkInfo.blockExplorerUrls.length) {
    throw new Error(`No explorer configured for network: ${network}`)
  }
  return networkInfo.blockExplorerUrls[0]
}

/**
 * Generate an explorer URL for an address or transaction on any supported network
 */
export const getExplorerUrl = (
  hash: string, 
  network: Network, 
  type: 'address' | 'tx' = 'address'
): string => {
  const baseUrl = getExplorerBaseUrl(network)
  
  // Handle special case for Sei Testnet which has different URL structure
  if (network === 'sei-testnet') {
    return type === 'address' 
      ? `${baseUrl}&module=account&address=${hash}`
      : `${baseUrl}&module=tx&hash=${hash}`
  }
  
  // Standard explorer URL structure for most chains
  return type === 'address' 
    ? `${baseUrl}/address/${hash}`
    : `${baseUrl}/tx/${hash}`
}

/**
 * Open explorer in a new tab for any supported network
 */
export const openExplorer = (
  hash: string, 
  network: Network, 
  type: 'address' | 'tx' = 'address'
): void => {
  try {
    const url = getExplorerUrl(hash, network, type)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error) {
    console.error('Failed to open explorer:', error)
  }
}

/**
 * Copy explorer URL to clipboard for any supported network
 */
export const copyExplorerUrl = async (
  hash: string, 
  network: Network, 
  type: 'address' | 'tx' = 'address'
): Promise<boolean> => {
  try {
    const url = getExplorerUrl(hash, network, type)
    await navigator.clipboard.writeText(url)
    return true
  } catch (error) {
    console.error('Failed to copy explorer URL to clipboard:', error)
    return false
  }
}

/**
 * Get explorer name for a network
 */
export const getExplorerName = (network: Network): string => {
  const explorerNames: Record<Network, string> = {
    'base': 'BaseScan',
    'base-sepolia': 'BaseScan Sepolia',
    'ethereum': 'Etherscan',
    'arbitrum': 'Arbiscan',
    'optimism': 'Optimistic Etherscan',
    'polygon': 'PolygonScan',
    'sei-testnet': 'SeiTrace',
  }
  
  return explorerNames[network] || 'Explorer'
}

/**
 * Check if a network has an explorer configured
 */
export const hasExplorer = (network: Network): boolean => {
  try {
    getExplorerBaseUrl(network)
    return true
  } catch {
    return false
  }
}

/**
 * Get all supported explorer networks
 */
export const getSupportedExplorerNetworks = (): Network[] => {
  return Object.keys(NETWORKS) as Network[]
}

// Legacy compatibility - maintain old function names for existing code
export const getBlockscoutUrl = (hash: string, type: 'address' | 'tx' = 'address'): string => {
  return getExplorerUrl(hash, 'base-sepolia', type)
}

export const openBlockscout = (hash: string, type: 'address' | 'tx' = 'address'): void => {
  openExplorer(hash, 'base-sepolia', type)
}

export const copyBlockscoutUrl = async (hash: string, type: 'address' | 'tx' = 'address'): Promise<void> => {
  const success = await copyExplorerUrl(hash, 'base-sepolia', type)
  if (!success) {
    throw new Error('Failed to copy URL to clipboard')
  }
} 