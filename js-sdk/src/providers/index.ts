// Provider interfaces and base classes
export type { 
  PaymentProvider, 
  PaymentProviderCapabilities, 
  PaymentProviderOptions,
  VerifyResponse,
  SettleResponse
} from './base.js';
export { BasePaymentProvider, PaymentProviderError } from './base.js';

// Provider registry
export { PaymentProviderRegistry, globalPaymentProviderRegistry } from './registry.js';

// Concrete provider implementations
export { X402Provider } from './x402-provider.js';
export { SeiX402Provider } from './sei-x402-provider.js';

// Import for internal use
import { PaymentProviderRegistry } from './registry.js';
import { X402Provider } from './x402-provider.js';
import { SeiX402Provider } from './sei-x402-provider.js';
import type { PaymentProviderOptions } from './base.js';

// Utility functions for provider management
export function createDefaultProviderRegistry(): PaymentProviderRegistry {
  const registry = new PaymentProviderRegistry();
  
  // Register the original x402 provider as default
  const x402Provider = new X402Provider({ debug: false });
  registry.register(x402Provider, true);
  
  // Register Sei provider for Sei networks
  const seiProvider = new SeiX402Provider({ debug: false });
  registry.register(seiProvider);
  
  // Set explicit network mappings for optimal performance
  registry.setNetworkProvider('base-sepolia', 'x402-original');
  registry.setNetworkProvider('base', 'x402-original');
  registry.setNetworkProvider('avalanche-fuji', 'x402-original');
  registry.setNetworkProvider('avalanche', 'x402-original');
  registry.setNetworkProvider('iotex', 'x402-original');
  registry.setNetworkProvider('sei-testnet', 'sei-x402');
  
  return registry;
}

// Configuration helper
export interface MultiProviderConfig {
  /** Enable debug logging for all providers */
  debug?: boolean;
  
  /** Provider-specific configurations */
  providers?: {
    'x402-original'?: PaymentProviderOptions;
    'sei-x402'?: PaymentProviderOptions;
  };
  
  /** Network to provider mapping overrides */
  networkMappings?: Record<string, string>;
  
  /** Whether to enable the Sei provider */
  enableSeiProvider?: boolean;
}

/**
 * Creates a configured provider registry based on options
 * @param config - Configuration options
 * @returns Configured provider registry
 */
export function createConfiguredProviderRegistry(config: MultiProviderConfig = {}): PaymentProviderRegistry {
  const registry = new PaymentProviderRegistry();
  
  // Create and register x402 provider
  const x402Options: PaymentProviderOptions = {
    debug: config.debug || false,
    ...config.providers?.['x402-original']
  };
  const x402Provider = new X402Provider(x402Options);
  registry.register(x402Provider, true);
  
  // Create and register Sei provider if enabled
  if (config.enableSeiProvider !== false) {
    const seiOptions: PaymentProviderOptions = {
      debug: config.debug || false,
      ...config.providers?.['sei-x402']
    };
    const seiProvider = new SeiX402Provider(seiOptions);
    registry.register(seiProvider);
  }
  
  // Apply network mappings
  if (config.networkMappings) {
    for (const [network, provider] of Object.entries(config.networkMappings)) {
      registry.setNetworkProvider(network as any, provider);
    }
  }
  
  return registry;
}