import type { Account } from "viem";
import { BasePaymentProvider, type PaymentProviderCapabilities, type PaymentProviderOptions, type VerifyResponse, type SettleResponse } from "./base.js";
import type { ExtendedPaymentRequirements, PaymentPayload, SupportedNetwork, SignerWallet } from "../x402/index.js";
import { createPaymentHeader, SupportedEVMNetworks } from "../x402/index.js";

/**
 * Original x402 provider that wraps the existing x402 implementation
 * Handles Base, Avalanche, IoTeX, and other EVM networks
 */
export class X402Provider extends BasePaymentProvider {
  constructor(options: PaymentProviderOptions = {}) {
    super(
      'x402-original',
      [...SupportedEVMNetworks], // Use all supported EVM networks
      '1.0.0',
      options
    );
  }

  async createPaymentHeader(
    client: SignerWallet | Account,
    x402Version: number,
    requirements: ExtendedPaymentRequirements
  ): Promise<string> {
    this.log('Creating payment header', { 
      network: requirements.network, 
      amount: requirements.maxAmountRequired 
    });

    try {
      // Use the existing createPaymentHeader function
      const paymentHeader = await createPaymentHeader(client, x402Version, requirements);
      
      this.log('Payment header created successfully');
      return paymentHeader;
    } catch (error) {
      this.logError('Failed to create payment header', error as Error);
      throw this.createError(
        `Failed to create payment header: ${(error as Error).message}`,
        requirements.network,
        'PAYMENT_HEADER_CREATION_FAILED',
        error as Error
      );
    }
  }

  async verifyPayment(
    payload: PaymentPayload,
    requirements: ExtendedPaymentRequirements
  ): Promise<VerifyResponse> {
    this.log('Verifying payment', { network: requirements.network });

    try {
      // For now, we'll implement basic verification
      // In a real implementation, this would use the facilitator to verify
      const isValid = this.validatePaymentStructure(payload, requirements);
      
      if (!isValid) {
        return {
          isValid: false,
          invalidReason: 'Invalid payment structure'
        };
      }

      // Extract payer from payload
      const payer = payload.payload.authorization.from;

      this.log('Payment verification completed', { isValid: true, payer });
      
      return {
        isValid: true,
        payer
      };
    } catch (error) {
      this.logError('Payment verification failed', error as Error);
      return {
        isValid: false,
        invalidReason: `Verification error: ${(error as Error).message}`
      };
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: ExtendedPaymentRequirements
  ): Promise<SettleResponse> {
    this.log('Settling payment', { network: requirements.network });

    try {
      // For now, we'll implement basic settlement simulation
      // In a real implementation, this would use the facilitator to settle
      const payer = payload.payload.authorization.from;
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.log('Payment settlement completed', { 
        success: true, 
        payer, 
        transaction: transactionId 
      });

      return {
        success: true,
        payer,
        transaction: transactionId,
        network: requirements.network
      };
    } catch (error) {
      this.logError('Payment settlement failed', error as Error);
      return {
        success: false,
        errorReason: `Settlement error: ${(error as Error).message}`,
        transaction: '',
        network: requirements.network
      };
    }
  }

  getCapabilities(): PaymentProviderCapabilities {
    return {
      hasNativeOptimizations: false,
      supportsBatching: false,
      hasCustomFacilitators: true,
      maxPaymentAmount: BigInt('1000000000000000000'), // 1 ETH equivalent in wei
      minPaymentAmount: BigInt('1000'), // 0.001 USDC in atomic units
      metadata: {
        facilitatorBased: true,
        evmCompatible: true,
        supportedSchemes: ['exact']
      }
    };
  }

  /**
   * Validates the basic structure of a payment payload
   * @param payload - Payment payload to validate
   * @param requirements - Payment requirements
   * @returns True if structure is valid
   */
  private validatePaymentStructure(
    payload: PaymentPayload,
    requirements: ExtendedPaymentRequirements
  ): boolean {
    try {
      // Check basic payload structure
      if (!payload.payload || !payload.payload.authorization || !payload.payload.signature) {
        return false;
      }

      const auth = payload.payload.authorization;
      
      // Check required fields
      if (!auth.from || !auth.to || !auth.value || !auth.nonce) {
        return false;
      }

      // Check network matches
      if (payload.network !== requirements.network) {
        return false;
      }

      // Check scheme matches
      if (payload.scheme !== requirements.scheme) {
        return false;
      }

      // Check amount doesn't exceed maximum
      if (BigInt(auth.value) > BigInt(requirements.maxAmountRequired)) {
        return false;
      }

      // Check recipient matches
      if (auth.to !== requirements.payTo) {
        return false;
      }

      return true;
    } catch (error) {
      this.logError('Payment structure validation failed', error as Error);
      return false;
    }
  }

  /**
   * Checks if this provider is the best choice for the given network
   * @param network - Network to check
   * @returns Priority score (higher is better, -1 means not supported)
   */
  getPriorityForNetwork(network: SupportedNetwork): number {
    if (!this.supportsNetwork(network)) {
      return -1;
    }

    // Give higher priority to non-Sei networks since this is the original provider
    if (network.includes('sei')) {
      return 1; // Low priority for Sei networks
    }

    // Higher priority for Base and other EVM networks
    if (network.includes('base')) {
      return 10;
    }

    return 5; // Default priority for other supported networks
  }
}