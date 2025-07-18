/**
 * Token Amount Conversion Utilities
 * 
 * This module provides precise amount conversion utilities for handling token amounts
 * across different decimal places without floating point precision issues.
 * 
 * Database Integration:
 * - Database stores amounts as NUMERIC(38,0) + token_decimals
 * - API uses string-based amounts for precision
 * - BigInt arithmetic for all calculations
 * 
 * Key Features:
 * - BigInt-based precise arithmetic
 * - Conversion between human-readable amounts and base units
 * - Support for different token decimals
 * - Database NUMERIC integration
 * - Validation and error handling
 * - Type-safe amount operations
 * 
 * Usage:
 * ```typescript
 * // Convert human-readable amount to base units (for API/DB)
 * const baseUnits = toBaseUnits("0.1", 6); // "100000" (0.1 USDC)
 * 
 * // Convert base units to human-readable amount
 * const readable = fromBaseUnits("100000", 6); // "0.1"
 * 
 * // Format for display
 * const formatted = formatAmount("100000", 6, { symbol: "USDC" }); // "0.10 USDC"
 * 
 * // Database helpers
 * const dbAmount = toDbAmount("0.1", 6); // Returns { amount_raw: "100000", token_decimals: 6 }
 * const fromDb = fromDbAmount("100000", 6); // "0.1"
 * ```
 */

export class AmountConversionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AmountConversionError';
  }
}

/**
 * Validates that a string represents a valid decimal number
 */
function validateDecimalString(amount: string): void {
  if (!amount || typeof amount !== 'string') {
    throw new AmountConversionError('Amount must be a non-empty string');
  }
  
  // Allow negative numbers, integers, and decimals
  const decimalRegex = /^-?\d+\.?\d*$/;
  if (!decimalRegex.test(amount)) {
    throw new AmountConversionError(`Invalid decimal format: ${amount}`);
  }
  
  // Check for leading zeros (except for "0" and "0.x")
  if (amount.match(/^-?0\d+/)) {
    throw new AmountConversionError(`Invalid leading zeros: ${amount}`);
  }
}

/**
 * Validates token decimals
 */
function validateDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) {
    throw new AmountConversionError(`Invalid decimals: ${decimals}. Must be integer between 0 and 77`);
  }
}

/**
 * Converts a human-readable amount to base units (atomic units)
 * 
 * @param amount - Human-readable amount as string (e.g., "0.1", "1.5")
 * @param decimals - Number of decimal places for the token (e.g., 6 for USDC, 18 for ETH)
 * @returns Base units as string (e.g., "100000" for 0.1 USDC)
 * 
 * @example
 * toBaseUnits("0.1", 6) // "100000" (0.1 USDC)
 * toBaseUnits("1.5", 18) // "1500000000000000000" (1.5 ETH)
 * toBaseUnits("100", 0) // "100" (100 of a token with 0 decimals)
 */
export function toBaseUnits(amount: string, decimals: number): string {
  validateDecimalString(amount);
  validateDecimals(decimals);
  
  try {
    // Handle negative numbers
    const isNegative = amount.startsWith('-');
    const absoluteAmount = isNegative ? amount.slice(1) : amount;
    
    // Split into integer and decimal parts
    const [integerPart = '0', decimalPart = ''] = absoluteAmount.split('.');
    
    // Validate decimal part length
    if (decimalPart.length > decimals) {
      throw new AmountConversionError(
        `Too many decimal places: ${decimalPart.length} > ${decimals}`
      );
    }
    
    // Pad decimal part to match required decimals
    const paddedDecimalPart = decimalPart.padEnd(decimals, '0');
    
    // Combine integer and decimal parts
    const fullIntegerString = integerPart + paddedDecimalPart;
    
    // Convert to BigInt and back to string to remove leading zeros
    const result = BigInt(fullIntegerString).toString();
    
    return isNegative ? `-${result}` : result;
  } catch (error) {
    if (error instanceof AmountConversionError) {
      throw error;
    }
    throw new AmountConversionError(
      `Failed to convert ${amount} to base units with ${decimals} decimals`,
      error
    );
  }
}

/**
 * Converts base units (atomic units) to human-readable amount
 * 
 * @param baseAmount - Base units as string (e.g., "100000")
 * @param decimals - Number of decimal places for the token
 * @returns Human-readable amount as string (e.g., "0.1")
 * 
 * @example
 * fromBaseUnits("100000", 6) // "0.1" (0.1 USDC)
 * fromBaseUnits("1500000000000000000", 18) // "1.5" (1.5 ETH)
 * fromBaseUnits("100", 0) // "100" (100 of a token with 0 decimals)
 */
export function fromBaseUnits(baseAmount: string, decimals: number): string {
  if (!baseAmount || typeof baseAmount !== 'string') {
    throw new AmountConversionError('Base amount must be a non-empty string');
  }
  
  validateDecimals(decimals);
  
  try {
    // Handle negative numbers
    const isNegative = baseAmount.startsWith('-');
    const absoluteAmount = isNegative ? baseAmount.slice(1) : baseAmount;
    
    // Validate base amount is a valid integer
    if (!/^\d+$/.test(absoluteAmount)) {
      throw new AmountConversionError(`Invalid base amount format: ${baseAmount}`);
    }
    
    // Convert to BigInt for validation
    const bigIntAmount = BigInt(absoluteAmount);
    const amountString = bigIntAmount.toString(); // This removes leading zeros
    
    if (decimals === 0) {
      return isNegative ? `-${amountString}` : amountString;
    }
    
    // Pad with leading zeros if necessary
    const paddedAmount = amountString.padStart(decimals + 1, '0');
    
    // Split into integer and decimal parts
    const integerPart = paddedAmount.slice(0, -decimals) || '0';
    const decimalPart = paddedAmount.slice(-decimals);
    
    // Remove trailing zeros from decimal part
    const trimmedDecimalPart = decimalPart.replace(/0+$/, '');
    
    // Construct result
    const result = trimmedDecimalPart 
      ? `${integerPart}.${trimmedDecimalPart}`
      : integerPart;
    
    return isNegative ? `-${result}` : result;
  } catch (error) {
    if (error instanceof AmountConversionError) {
      throw error;
    }
    throw new AmountConversionError(
      `Failed to convert ${baseAmount} from base units with ${decimals} decimals`,
      error
    );
  }
}

/**
 * Options for formatting amounts
 */
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

/**
 * Formats a base unit amount for display
 * 
 * @param baseAmount - Base units as string
 * @param decimals - Number of decimal places for the token
 * @param options - Formatting options
 * @returns Formatted amount string
 * 
 * @example
 * formatAmount("100000", 6, { symbol: "USDC" }) // "0.1 USDC"
 * formatAmount("1500000000000000000", 18, { symbol: "ETH", precision: 4 }) // "1.5 ETH"
 * formatAmount("1000000000", 6, { symbol: "USDC", compact: true }) // "1K USDC"
 */
export function formatAmount(
  baseAmount: string,
  decimals: number,
  options: FormatAmountOptions = {}
): string {
  const {
    symbol,
    precision,
    compact = false,
    minDecimals = 0,
    showSymbol = true
  } = options;
  
  try {
    // Convert to human-readable amount
    const readableAmount = fromBaseUnits(baseAmount, decimals);
    const numAmount = parseFloat(readableAmount);
    
    // Apply precision if specified
    let formatted = readableAmount;
    if (precision !== undefined) {
      formatted = numAmount.toFixed(precision);
    } else if (minDecimals > 0) {
      const currentDecimals = (readableAmount.split('.')[1] || '').length;
      if (currentDecimals < minDecimals) {
        formatted = numAmount.toFixed(minDecimals);
      }
    }
    
    // Remove trailing zeros unless minDecimals requires them
    if (precision === undefined) {
      formatted = formatted.replace(/\.?0+$/, '');
    }
    
    // Apply compact notation for large numbers
    if (compact && Math.abs(numAmount) >= 1000) {
      const suffixes = ['', 'K', 'M', 'B', 'T'];
      const tier = Math.floor(Math.log10(Math.abs(numAmount)) / 3);
      if (tier > 0 && tier < suffixes.length) {
        const scale = Math.pow(10, tier * 3);
        const scaled = numAmount / scale;
        formatted = scaled.toFixed(1).replace(/\.0$/, '') + suffixes[tier];
      }
    }
    
    // Add symbol if requested
    if (showSymbol && symbol) {
      return `${formatted} ${symbol}`;
    }
    
    return formatted;
  } catch (error) {
    if (error instanceof AmountConversionError) {
      throw error;
    }
    throw new AmountConversionError(
      `Failed to format amount ${baseAmount} with ${decimals} decimals`,
      error
    );
  }
}

/**
 * Adds two amounts in base units
 * 
 * @param amount1 - First amount in base units
 * @param amount2 - Second amount in base units
 * @returns Sum in base units
 */
export function addAmounts(amount1: string, amount2: string): string {
  try {
    const bigInt1 = BigInt(amount1);
    const bigInt2 = BigInt(amount2);
    return (bigInt1 + bigInt2).toString();
  } catch (error) {
    throw new AmountConversionError(
      `Failed to add amounts ${amount1} + ${amount2}`,
      error
    );
  }
}

/**
 * Subtracts two amounts in base units
 * 
 * @param amount1 - Amount to subtract from (base units)
 * @param amount2 - Amount to subtract (base units)
 * @returns Difference in base units
 */
export function subtractAmounts(amount1: string, amount2: string): string {
  try {
    const bigInt1 = BigInt(amount1);
    const bigInt2 = BigInt(amount2);
    return (bigInt1 - bigInt2).toString();
  } catch (error) {
    throw new AmountConversionError(
      `Failed to subtract amounts ${amount1} - ${amount2}`,
      error
    );
  }
}

/**
 * Compares two amounts in base units
 * 
 * @param amount1 - First amount in base units
 * @param amount2 - Second amount in base units
 * @returns -1 if amount1 < amount2, 0 if equal, 1 if amount1 > amount2
 */
export function compareAmounts(amount1: string, amount2: string): number {
  try {
    const bigInt1 = BigInt(amount1);
    const bigInt2 = BigInt(amount2);
    
    if (bigInt1 < bigInt2) return -1;
    if (bigInt1 > bigInt2) return 1;
    return 0;
  } catch (error) {
    throw new AmountConversionError(
      `Failed to compare amounts ${amount1} and ${amount2}`,
      error
    );
  }
}

/**
 * Checks if an amount is zero
 * 
 * @param amount - Amount in base units
 * @returns True if amount is zero
 */
export function isZeroAmount(amount: string): boolean {
  try {
    return BigInt(amount) === BigInt(0);
  } catch (error) {
    throw new AmountConversionError(`Failed to check if amount ${amount} is zero`, error);
  }
}

/**
 * Validates that an amount string represents a valid base unit amount
 * 
 * @param amount - Amount to validate
 * @returns True if valid
 * @throws AmountConversionError if invalid
 */
export function validateBaseAmount(amount: string): boolean {
  if (!amount || typeof amount !== 'string') {
    throw new AmountConversionError('Amount must be a non-empty string');
  }
  
  // Allow negative numbers
  const regex = /^-?\d+$/;
  if (!regex.test(amount)) {
    throw new AmountConversionError(`Invalid base amount format: ${amount}`);
  }
  
  try {
    BigInt(amount); // This will throw if the string is not a valid integer
    return true;
  } catch (error) {
    throw new AmountConversionError(`Invalid base amount: ${amount}`, error);
  }
}

/**
 * Safely parses a user input amount and converts to base units
 * Handles various input formats and provides clear error messages
 * 
 * @param input - User input string
 * @param decimals - Token decimals
 * @returns Base units as string
 */
export function parseUserAmount(input: string, decimals: number): string {
  if (!input || typeof input !== 'string') {
    throw new AmountConversionError('Please enter an amount');
  }
  
  // Trim whitespace
  const trimmed = input.trim();
  
  // Remove common prefixes/suffixes
  let cleaned = trimmed;
  if (cleaned.startsWith('$')) {
    cleaned = cleaned.slice(1);
  }
  
  // Convert comma separators to dots for international users
  cleaned = cleaned.replace(/,/g, '.');
  
  // Validate and convert
  return toBaseUnits(cleaned, decimals);
}

// Export common token decimals for convenience
export const COMMON_DECIMALS = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WETH: 18,
  DAI: 18,
  WBTC: 8,
  BTC: 8,
} as const;

// =============================================================================
// DATABASE INTEGRATION HELPERS
// =============================================================================

/**
 * Database amount record structure
 */
export interface DbAmountRecord {
  amount_raw: string;
  token_decimals: number;
}

/**
 * Converts a human-readable amount to database format
 * 
 * @param humanAmount - Human-readable amount string
 * @param decimals - Token decimals
 * @returns Database record with amount_raw and token_decimals
 * 
 * @example
 * toDbAmount("0.1", 6) // { amount_raw: "100000", token_decimals: 6 }
 */
export function toDbAmount(humanAmount: string, decimals: number): DbAmountRecord {
  return {
    amount_raw: toBaseUnits(humanAmount, decimals),
    token_decimals: decimals
  };
}

/**
 * Converts database amount record to human-readable amount
 * 
 * @param amountRaw - Base units from database (string or NUMERIC)
 * @param tokenDecimals - Token decimals from database
 * @returns Human-readable amount string
 * 
 * @example
 * fromDbAmount("100000", 6) // "0.1"
 */
export function fromDbAmount(amountRaw: string | number, tokenDecimals: number): string {
  const baseUnits = typeof amountRaw === 'number' ? amountRaw.toString() : amountRaw;
  return fromBaseUnits(baseUnits, tokenDecimals);
}

/**
 * Formats a database amount record for display
 * 
 * @param amountRaw - Base units from database
 * @param tokenDecimals - Token decimals from database
 * @param options - Formatting options
 * @returns Formatted display string
 * 
 * @example
 * formatDbAmount("100000", 6, { symbol: "USDC" }) // "0.1 USDC"
 */
export function formatDbAmount(
  amountRaw: string | number,
  tokenDecimals: number,
  options: FormatAmountOptions = {}
): string {
  const baseUnits = typeof amountRaw === 'number' ? amountRaw.toString() : amountRaw;
  return formatAmount(baseUnits, tokenDecimals, options);
}

/**
 * Validates a database amount record
 * 
 * @param record - Database amount record to validate
 * @returns True if valid
 * @throws AmountConversionError if invalid
 */
export function validateDbAmount(record: DbAmountRecord): boolean {
  validateBaseAmount(record.amount_raw);
  validateDecimals(record.token_decimals);
  return true;
}

/**
 * Aggregates multiple database amounts (same currency only)
 * 
 * @param amounts - Array of database amount records (must have same decimals)
 * @returns Aggregated amount in same format
 * 
 * @example
 * aggregateDbAmounts([
 *   { amount_raw: "100000", token_decimals: 6 },
 *   { amount_raw: "200000", token_decimals: 6 }
 * ]) // { amount_raw: "300000", token_decimals: 6 }
 */
export function aggregateDbAmounts(amounts: DbAmountRecord[]): DbAmountRecord {
  if (amounts.length === 0) {
    throw new AmountConversionError('Cannot aggregate empty array of amounts');
  }
  
  const firstDecimals = amounts[0].token_decimals;
  
  // Validate all amounts have same decimals
  for (const amount of amounts) {
    if (amount.token_decimals !== firstDecimals) {
      throw new AmountConversionError(
        `Cannot aggregate amounts with different decimals: ${firstDecimals} vs ${amount.token_decimals}`
      );
    }
    validateDbAmount(amount);
  }
  
  // Sum all amounts
  let total = BigInt(0);
  for (const amount of amounts) {
    total += BigInt(amount.amount_raw);
  }
  
  return {
    amount_raw: total.toString(),
    token_decimals: firstDecimals
  };
}

/**
 * Converts legacy decimal amount to new database format
 * Useful for migrations from old decimal(18,8) format
 * 
 * @param legacyAmount - Old decimal amount (could be number or string)
 * @param assumedDecimals - Token decimals to assume for conversion
 * @returns Database amount record
 * 
 * @example
 * migrateLegacyAmount("0.10000000", 6) // { amount_raw: "100000", token_decimals: 6 }
 */
export function migrateLegacyAmount(
  legacyAmount: string | number,
  assumedDecimals: number
): DbAmountRecord {
  const humanAmount = typeof legacyAmount === 'number' 
    ? legacyAmount.toString() 
    : legacyAmount;
  
  return toDbAmount(humanAmount, assumedDecimals);
} 

/**
 * Multi-Currency Revenue Operations
 * Format: { "[CURRENCY]-[DECIMALS]": "amount_in_base_units" }
 * Example: { "USDC-6": "1000000", "ETH-18": "500000000000000000" }
 */

export type RevenueByCurrency = Record<string, string>;

/**
 * Create a currency key for revenue tracking
 */
export function createCurrencyKey(currency: string, decimals: number): string {
  return `${currency}-${decimals}`;
}

/**
 * Parse a currency key back to currency and decimals
 */
export function parseCurrencyKey(key: string): { currency: string; decimals: number } {
  const parts = key.split('-');
  if (parts.length !== 2) {
    throw new AmountConversionError(`Invalid currency key format: ${key}. Expected format: CURRENCY-DECIMALS`);
  }
  const decimals = parseInt(parts[1], 10);
  if (isNaN(decimals)) {
    throw new AmountConversionError(`Invalid decimals in currency key: ${key}`);
  }
  return { currency: parts[0], decimals };
}

/**
 * Add revenue to a multi-currency revenue object
 */
export function addRevenueToCurrency(
  existingRevenue: RevenueByCurrency | null | undefined,
  currency: string,
  decimals: number,
  amountRaw: string
): RevenueByCurrency {
  const revenue = existingRevenue || {};
  const key = createCurrencyKey(currency, decimals);
  const existingAmount = revenue[key] || '0';
  const newAmount = addAmounts(existingAmount, amountRaw);
  
  return {
    ...revenue,
    [key]: newAmount
  };
}

/**
 * Merge multiple multi-currency revenue objects
 */
export function mergeRevenueByCurrency(
  ...revenues: (RevenueByCurrency | null | undefined)[]
): RevenueByCurrency {
  const result: RevenueByCurrency = {};
  
  for (const revenue of revenues) {
    if (!revenue) continue;
    
    for (const [key, amount] of Object.entries(revenue)) {
      const existingAmount = result[key] || '0';
      result[key] = addAmounts(existingAmount, amount);
    }
  }
  
  return result;
}

/**
 * Format multi-currency revenue for display
 */
export function formatRevenueByCurrency(
  revenue: RevenueByCurrency | null | undefined,
  options?: {
    maxCurrencies?: number;
    showZeroAmounts?: boolean;
  }
): Array<{ currency: string; amount: string; formattedAmount: string }> {
  if (!revenue) return [];
  
  const { maxCurrencies = 10, showZeroAmounts = false } = options || {};
  
  const formatted = Object.entries(revenue)
    .map(([key, amountRaw]) => {
      const { currency, decimals } = parseCurrencyKey(key);
      const amount = fromBaseUnits(amountRaw, decimals);
      const formattedAmount = formatAmount(amountRaw, decimals, {
        showSymbol: true,
        symbol: currency
      });
      
      return { currency, amount, formattedAmount };
    })
    .filter(item => showZeroAmounts || parseFloat(item.amount) > 0)
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)) // Sort by amount descending
    .slice(0, maxCurrencies);
  
  return formatted;
}

/**
 * Get total revenue for a specific currency
 */
export function getRevenueByCurrency(
  revenue: RevenueByCurrency | null | undefined,
  currency: string,
  decimals: number
): string {
  if (!revenue) return '0';
  const key = createCurrencyKey(currency, decimals);
  return revenue[key] || '0';
}

/**
 * Check if revenue object has any non-zero amounts
 */
export function hasRevenue(revenue: RevenueByCurrency | null | undefined): boolean {
  if (!revenue) return false;
  return Object.values(revenue).some(amount => parseFloat(amount) > 0);
}

/**
 * Convert old single-currency revenue to multi-currency format
 * Used for migration/backward compatibility
 */
export function migrateSingleCurrencyRevenue(
  totalRevenueRaw: string,
  currency: string,
  decimals: number
): RevenueByCurrency {
  if (parseFloat(totalRevenueRaw) === 0) return {};
  
  const key = createCurrencyKey(currency, decimals);
  return { [key]: totalRevenueRaw };
}

/**
 * Calculate total value in a reference currency (for rough comparisons)
 * Note: This requires external price data and should be used carefully
 */
export function calculateTotalValueInReferenceCurrency(
  revenue: RevenueByCurrency | null | undefined,
  priceData: Record<string, number>, // { "USDC": 1.0, "ETH": 2500.0 }
  referenceCurrency = 'USD'
): { totalValue: number; breakdown: Array<{ currency: string; value: number; amount: string }> } {
  if (!revenue) return { totalValue: 0, breakdown: [] };
  
  let totalValue = 0;
  const breakdown: Array<{ currency: string; value: number; amount: string }> = [];
  
  for (const [key, amountRaw] of Object.entries(revenue)) {
    const { currency, decimals } = parseCurrencyKey(key);
    const amount = fromBaseUnits(amountRaw, decimals);
    const price = priceData[currency] || 0;
    const value = parseFloat(amount) * price;
    
    totalValue += value;
    breakdown.push({ currency, value, amount });
  }
  
  return { totalValue, breakdown };
} 