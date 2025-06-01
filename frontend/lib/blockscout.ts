/**
 * Blockscout explorer utilities for Base Sepolia
 */

export const BLOCKSCOUT_BASE_URL = 'https://base-sepolia.blockscout.com'

/**
 * Generate a Blockscout URL for an address or transaction
 */
export const getBlockscoutUrl = (hash: string, type: 'address' | 'tx' = 'address'): string => {
  return type === 'address' 
    ? `${BLOCKSCOUT_BASE_URL}/address/${hash}`
    : `${BLOCKSCOUT_BASE_URL}/tx/${hash}`
}

/**
 * Open Blockscout in a new tab
 */
export const openBlockscout = (hash: string, type: 'address' | 'tx' = 'address'): void => {
  window.open(getBlockscoutUrl(hash, type), '_blank', 'noopener,noreferrer')
}

/**
 * Copy Blockscout URL to clipboard
 */
export const copyBlockscoutUrl = async (hash: string, type: 'address' | 'tx' = 'address'): Promise<void> => {
  try {
    await navigator.clipboard.writeText(getBlockscoutUrl(hash, type))
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
} 