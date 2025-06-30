import type { PaymentPayload, SupportedPaymentRequirements } from "../types.js";
import type { SupportedNetwork } from "../types.js";

/**
 * Backend payment provider interface
 */
export interface BackendPaymentProvider {
  readonly name: string;
  readonly supportedNetworks: SupportedNetwork[];
  
  /**
   * Verifies a payment using this provider's backend logic
   */
  verifyPayment(payload: PaymentPayload, requirements: SupportedPaymentRequirements): Promise<{
    isValid: boolean;
    invalidReason?: string;
    payer?: string;
  }>;
  
  /**
   * Settles a payment using this provider's backend logic
   */
  settle(payload: PaymentPayload, requirements: SupportedPaymentRequirements): Promise<{
    success: boolean;
    errorReason?: string;
    payer?: string;
    transaction: string;
    network: SupportedNetwork;
  }>;
}

/**
 * Original x402 backend provider using facilitators
 */
export class X402BackendProvider implements BackendPaymentProvider {
  readonly name = 'x402-facilitator';
  readonly supportedNetworks: SupportedNetwork[] = [
    'base-sepolia',
    'base',
    'avalanche-fuji',
    'avalanche',
    'iotex'
  ];

  async verifyPayment(
    payload: PaymentPayload,
    requirements: SupportedPaymentRequirements
  ) {
    // Use existing facilitator-based verification
    const { useFacilitator } = await import("../types.js");
    
    // Get facilitator URL for this network
    const facilitatorUrl = this.getFacilitatorUrl(requirements.network);
    const facilitator = useFacilitator({ url: facilitatorUrl });
    
    try {
      const response = await facilitator.verify(payload, requirements as any);
      return {
        isValid: response.isValid,
        invalidReason: response.invalidReason,
        payer: response.payer
      };
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Verification failed: ${(error as Error).message}`
      };
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: SupportedPaymentRequirements
  ) {
    // Use existing facilitator-based settlement
    const { useFacilitator } = await import("../types.js");
    
    const facilitatorUrl = this.getFacilitatorUrl(requirements.network);
    const facilitator = useFacilitator({ url: facilitatorUrl });
    
    try {
      const response = await facilitator.settle(payload, requirements as any);
      return {
        success: response.success,
        errorReason: response.errorReason,
        payer: response.payer,
        transaction: response.transaction,
        network: response.network
      };
    } catch (error) {
      return {
        success: false,
        errorReason: `Settlement failed: ${(error as Error).message}`,
        payer: undefined,
        transaction: '',
        network: requirements.network
      };
    }
  }

  private getFacilitatorUrl(network: SupportedNetwork): string {
    // Use environment-based facilitator URLs
    const facilitatorUrls: Partial<Record<SupportedNetwork, string>> = {
      "base-sepolia": process.env.BASE_SEPOLIA_FACILITATOR_URL || "https://x402.org/facilitator",
      "sei-testnet": process.env.SEI_TESTNET_FACILITATOR_URL || "https://6y3cdqj5s3.execute-api.us-west-2.amazonaws.com/prod",
    };
    
    return facilitatorUrls[network] || process.env.FACILITATOR_URL || "https://x402.org/facilitator";
  }
}

/**
 * Sei x402 backend provider (placeholder for @sei-js/x402 integration)
 */
export class SeiBackendProvider implements BackendPaymentProvider {
  readonly name = 'sei-x402';
  readonly supportedNetworks: SupportedNetwork[] = ['sei-testnet'];

  async verifyPayment(
    payload: PaymentPayload,
    requirements: SupportedPaymentRequirements
  ) {
    // TODO: Replace with actual @sei-js/x402 backend verification
    // For now, this is a placeholder implementation
    
    try {
      // Placeholder Sei-specific verification logic
      const isValid = this.validateSeiPayment(payload, requirements);
      
      if (!isValid) {
        return {
          isValid: false,
          invalidReason: 'Invalid Sei payment structure'
        };
      }

      return {
        isValid: true,
        payer: payload.payload.authorization.from
      };
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `Sei verification error: ${(error as Error).message}`
      };
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: SupportedPaymentRequirements
  ) {
    // TODO: Replace with actual @sei-js/x402 backend settlement
    
    try {
      // Placeholder Sei-specific settlement logic
      const transactionId = `sei_backend_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        payer: payload.payload.authorization.from,
        transaction: transactionId,
        network: requirements.network
      };
    } catch (error) {
      return {
        success: false,
        errorReason: `Sei settlement error: ${(error as Error).message}`,
        payer: undefined,
        transaction: '',
        network: requirements.network
      };
    }
  }

  private validateSeiPayment(
    payload: PaymentPayload,
    requirements: SupportedPaymentRequirements
  ): boolean {
    // Placeholder Sei-specific validation
    if (!payload.network.includes('sei')) {
      return false;
    }
    
    // Additional Sei-specific validations would go here
    return true;
  }
}

/**
 * Backend payment provider manager
 */
export class BackendPaymentProviderManager {
  private providers: Map<SupportedNetwork, BackendPaymentProvider> = new Map();
  private defaultProvider: BackendPaymentProvider;

  constructor() {
    // Initialize providers
    const x402Provider = new X402BackendProvider();
    const seiProvider = new SeiBackendProvider();
    
    // Set default
    this.defaultProvider = x402Provider;
    
    // Map networks to providers
    for (const network of x402Provider.supportedNetworks) {
      this.providers.set(network, x402Provider);
    }
    
    for (const network of seiProvider.supportedNetworks) {
      this.providers.set(network, seiProvider);
    }
  }

  /**
   * Get the appropriate provider for a network
   */
  getProvider(network: SupportedNetwork): BackendPaymentProvider {
    return this.providers.get(network) || this.defaultProvider;
  }

  /**
   * Verify a payment using the appropriate provider
   */
  async verifyPayment(
    payload: PaymentPayload,
    requirements: SupportedPaymentRequirements
  ) {
    const provider = this.getProvider(requirements.network);
    return provider.verifyPayment(payload, requirements);
  }

  /**
   * Settle a payment using the appropriate provider
   */
  async settle(
    payload: PaymentPayload,
    requirements: SupportedPaymentRequirements
  ) {
    const provider = this.getProvider(requirements.network);
    return provider.settle(payload, requirements);
  }

  /**
   * Get statistics about registered providers
   */
  getStats() {
    const networkMappings: Record<SupportedNetwork, string> = {} as any;
    for (const [network, provider] of this.providers.entries()) {
      networkMappings[network] = provider.name;
    }

    return {
      totalProviders: new Set(Array.from(this.providers.values()).map(p => p.name)).size,
      totalNetworks: this.providers.size,
      networkMappings,
      defaultProvider: this.defaultProvider.name
    };
  }
}

// Global instance for easy usage
export const globalBackendProviderManager = new BackendPaymentProviderManager();