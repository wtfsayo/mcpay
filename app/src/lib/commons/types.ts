/**
 * Shared Type Definitions for MCPay Commons
 * 
 * This file contains all the shared types used across the token registry,
 * amount utilities, and blockchain configurations.
 */

// =============================================================================
// BLOCKCHAIN & NETWORK TYPES
// =============================================================================

export type Network = 'base-sepolia' | 'sei-testnet';
export type BlockchainArchitecture = 'evm' | 'solana' | 'near' | 'cosmos' | 'bitcoin';
export type TokenCategory = 'stablecoin' | 'utility' | 'defi' | 'meme' | 'governance' | 'wrapped';
export type StablecoinSymbol = 'USDC' | 'USDT' | 'DAI' | 'BUSD' | 'FRAX' | 'TUSD' | 'USDP';

// Generic address type that can handle different address formats
export type BlockchainAddress = string;

// =============================================================================
// TOKEN TYPES
// =============================================================================

export interface TokenInfo {
  symbol: string;
  name: string;
  network: Network;
  decimals: number;
  category: TokenCategory;
  logoUri?: string;
  coingeckoId?: string;
  isStablecoin: boolean;
  isNative: boolean;
  chainId: number;
  tags: string[];
  description?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  // Payment-specific metadata
  popularityScore: number; // 1-100, higher = more popular for payments
  liquidityTier: 'high' | 'medium' | 'low';
  recommendedForPayments: boolean;
  // Data source verification
  verified: boolean;
  verificationSource?: string;
}

export interface NetworkInfo {
  name: string;
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  iconUrl?: string;
  isTestnet: boolean;
}

// =============================================================================
// AMOUNT TYPES
// =============================================================================

export interface FormatAmountOptions {
  /** Token symbol to display (e.g., "USDC", "ETH") */
  symbol?: string;
  /** Maximum number of decimal places to show */
  precision?: number;
  /** Whether to use compact notation for large numbers (K, M, B, T) */
  compact?: boolean;
  /** Minimum number of decimal places to show (pads with zeros) */
  minDecimals?: number;
  /** Whether to show the symbol */
  showSymbol?: boolean;
}

export interface DbAmountRecord {
  amount_raw: string;
  token_decimals: number;
}

export type RevenueByCurrency = Record<string, string>;

// =============================================================================
// BALANCE TRACKING TYPES
// =============================================================================

export interface StablecoinConfig {
  symbol: StablecoinSymbol;
  name: string;
  decimals: number;
  coingeckoId?: string;
  isPegged: boolean;
  pegTarget?: number;
}

export interface StablecoinBalance {
  address: BlockchainAddress;
  chain: string;
  chainId: string | number;
  chainName: string;
  architecture: BlockchainArchitecture;
  isTestnet: boolean;
  stablecoin: StablecoinSymbol;
  stablecoinName: string;
  tokenIdentifier: string;
  balance: bigint;
  formattedBalance: string;
  decimals: number;
  priceUsd: number;
  fiatValue: number;
}

export interface StablecoinBalanceError {
  address: BlockchainAddress;
  chain: string;
  chainId: string | number;
  chainName: string;
  architecture: BlockchainArchitecture;
  isTestnet: boolean;
  stablecoin: StablecoinSymbol;
  tokenIdentifier: string;
  error: string;
}

// =============================================================================
// CHAIN CONFIGURATION TYPES
// =============================================================================

export interface EVMTokenConfig {
  address: string;
  symbol: StablecoinSymbol;
}

export interface SolanaTokenConfig {
  mint: string;
  symbol: StablecoinSymbol;
}

export interface NearTokenConfig {
  contract: string;
  symbol: StablecoinSymbol;
}

export interface BaseChainConfig {
  chainId: string | number;
  name: string;
  architecture: BlockchainArchitecture;
  rpcUrl: string;
  isTestnet: boolean;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
}

export interface EVMChainConfig extends BaseChainConfig {
  architecture: 'evm';
  chainId: number;
  stablecoins: EVMTokenConfig[];
}

export interface SolanaChainConfig extends BaseChainConfig {
  architecture: 'solana';
  chainId: string;
  stablecoins: SolanaTokenConfig[];
}

export interface NearChainConfig extends BaseChainConfig {
  architecture: 'near';
  chainId: string;
  stablecoins: NearTokenConfig[];
}

export type ChainConfig = EVMChainConfig | SolanaChainConfig | NearChainConfig;

// =============================================================================
// PRICE PROVIDER TYPES
// =============================================================================

export interface PriceProvider {
  getPrice(symbol: StablecoinSymbol): Promise<number>;
  getPrices(symbols: StablecoinSymbol[]): Promise<Record<StablecoinSymbol, number>>;
}

// =============================================================================
// COMMON DECIMALS
// =============================================================================

export const COMMON_DECIMALS = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WETH: 18,
  DAI: 18,
  WBTC: 8,
  BTC: 8,
} as const; 