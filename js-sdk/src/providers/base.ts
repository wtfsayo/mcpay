import type { Account } from "viem";
import type { ExtendedPaymentRequirements, PaymentPayload, SupportedNetwork, SignerWallet } from "../x402/index.js";

// Define types locally since they may not be exported from the current structure
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: SupportedNetwork;
}

/**
 * Base interface for all payment providers
 */
export interface PaymentProvider {
  /** Unique identifier for this provider */
  readonly name: string;
  
  /** Networks supported by this provider */
  readonly supportedNetworks: SupportedNetwork[];
  
  /** Version of the provider implementation */
  readonly version: string;
  
  /**
   * Creates a payment header for the given requirements
   * @param client - The wallet client to use for signing
   * @param x402Version - The x402 protocol version
   * @param requirements - Payment requirements
   * @returns Base64 encoded payment header
   */
  createPaymentHeader(
    client: SignerWallet | Account,
    x402Version: number,
    requirements: ExtendedPaymentRequirements
  ): Promise<string>;
  
  /**
   * Verifies a payment payload against requirements
   * @param payload - The payment payload to verify
   * @param requirements - Payment requirements to verify against
   * @returns Verification response
   */
  verifyPayment(
    payload: PaymentPayload,
    requirements: ExtendedPaymentRequirements
  ): Promise<VerifyResponse>;
  
  /**
   * Settles a verified payment
   * @param payload - The payment payload to settle
   * @param requirements - Payment requirements
   * @returns Settlement response
   */
  settle(
    payload: PaymentPayload,
    requirements: ExtendedPaymentRequirements
  ): Promise<SettleResponse>;
  
  /**
   * Checks if this provider supports the given network
   * @param network - Network to check
   * @returns True if supported
   */
  supportsNetwork(network: SupportedNetwork): boolean;
  
  /**
   * Gets provider-specific configuration or capabilities
   * @returns Provider configuration object
   */
  getCapabilities(): PaymentProviderCapabilities;
}

/**
 * Capabilities and configuration for a payment provider
 */
export interface PaymentProviderCapabilities {
  /** Whether this provider supports native optimizations for its networks */
  hasNativeOptimizations: boolean;
  
  /** Whether this provider supports advanced features like batching */
  supportsBatching: boolean;
  
  /** Whether this provider has custom facilitator endpoints */
  hasCustomFacilitators: boolean;
  
  /** Maximum payment amount this provider can handle (in atomic units) */
  maxPaymentAmount?: bigint;
  
  /** Minimum payment amount this provider can handle (in atomic units) */
  minPaymentAmount?: bigint;
  
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration options for payment providers
 */
export interface PaymentProviderOptions {
  /** Enable debug logging */
  debug?: boolean;
  
  /** Custom facilitator URLs per network */
  facilitatorUrls?: Partial<Record<SupportedNetwork, string>>;
  
  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
  
  /** Timeout for payment operations in milliseconds */
  timeout?: number;
  
  /** Maximum number of retry attempts */
  maxRetries?: number;
}

/**
 * Error thrown by payment providers
 */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly network?: SupportedNetwork,
    public readonly code?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

/**
 * Base abstract class for payment providers
 */
export abstract class BasePaymentProvider implements PaymentProvider {
  protected options: PaymentProviderOptions;
  
  constructor(
    public readonly name: string,
    public readonly supportedNetworks: SupportedNetwork[],
    public readonly version: string,
    options: PaymentProviderOptions = {}
  ) {
    this.options = {
      debug: false,
      timeout: 30000,
      maxRetries: 3,
      ...options
    };
  }
  
  abstract createPaymentHeader(
    client: SignerWallet | Account,
    x402Version: number,
    requirements: ExtendedPaymentRequirements
  ): Promise<string>;
  
  abstract verifyPayment(
    payload: PaymentPayload,
    requirements: ExtendedPaymentRequirements
  ): Promise<VerifyResponse>;
  
  abstract settle(
    payload: PaymentPayload,
    requirements: ExtendedPaymentRequirements
  ): Promise<SettleResponse>;
  
  abstract getCapabilities(): PaymentProviderCapabilities;
  
  supportsNetwork(network: SupportedNetwork): boolean {
    return this.supportedNetworks.includes(network);
  }
  
  protected log(message: string, data?: unknown): void {
    if (this.options.debug) {
      console.log(`[${this.name}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
  
  protected logError(message: string, error?: Error): void {
    console.error(`[${this.name}] ERROR: ${message}`, error);
  }
  
  protected createError(
    message: string,
    network?: SupportedNetwork,
    code?: string,
    cause?: Error
  ): PaymentProviderError {
    return new PaymentProviderError(message, this.name, network, code, cause);
  }
}