import type { PaymentProvider } from "./base.js";
import { PaymentProviderError } from "./base.js";
import type { SupportedNetwork, ExtendedPaymentRequirements } from "../x402/index.js";

/**
 * Registry for managing multiple payment providers
 */
export class PaymentProviderRegistry {
  private providers: Map<string, PaymentProvider> = new Map();
  private networkToProvider: Map<SupportedNetwork, string> = new Map();
  private defaultProvider?: string;

  /**
   * Register a payment provider
   * @param provider - The provider to register
   * @param isDefault - Whether this should be the default provider
   */
  register(provider: PaymentProvider, isDefault = false): void {
    this.providers.set(provider.name, provider);
    
    // Auto-map networks to this provider if no existing mapping
    for (const network of provider.supportedNetworks) {
      if (!this.networkToProvider.has(network)) {
        this.networkToProvider.set(network, provider.name);
      }
    }
    
    if (isDefault || !this.defaultProvider) {
      this.defaultProvider = provider.name;
    }
  }

  /**
   * Unregister a payment provider
   * @param providerName - Name of the provider to unregister
   */
  unregister(providerName: string): void {
    this.providers.delete(providerName);
    
    // Remove network mappings for this provider
    for (const [network, mappedProvider] of this.networkToProvider.entries()) {
      if (mappedProvider === providerName) {
        this.networkToProvider.delete(network);
      }
    }
    
    // Update default if needed
    if (this.defaultProvider === providerName) {
      this.defaultProvider = this.providers.keys().next().value;
    }
  }

  /**
   * Get a provider by name
   * @param providerName - Name of the provider
   * @returns The provider or undefined if not found
   */
  getProvider(providerName: string): PaymentProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get the best provider for a specific network
   * @param network - The network to get a provider for
   * @returns The best provider for the network
   * @throws PaymentProviderError if no suitable provider is found
   */
  getProviderForNetwork(network: SupportedNetwork): PaymentProvider {
    // First check explicit network mapping
    const mappedProviderName = this.networkToProvider.get(network);
    if (mappedProviderName) {
      const provider = this.providers.get(mappedProviderName);
      if (provider && provider.supportsNetwork(network)) {
        return provider;
      }
    }

    // Find any provider that supports this network
    for (const provider of this.providers.values()) {
      if (provider.supportsNetwork(network)) {
        return provider;
      }
    }

    // Fall back to default provider if it supports the network
    if (this.defaultProvider) {
      const defaultProvider = this.providers.get(this.defaultProvider);
      if (defaultProvider && defaultProvider.supportsNetwork(network)) {
        return defaultProvider;
      }
    }

    throw new PaymentProviderError(
      `No provider found for network: ${network}`,
      'registry',
      network,
      'NO_PROVIDER_FOR_NETWORK'
    );
  }

  /**
   * Get the best provider for payment requirements
   * @param requirements - Array of payment requirements
   * @returns The best provider for the requirements
   */
  getBestProvider(requirements: ExtendedPaymentRequirements[]): PaymentProvider {
    if (requirements.length === 0) {
      throw new PaymentProviderError(
        'No payment requirements provided',
        'registry',
        undefined,
        'NO_REQUIREMENTS'
      );
    }

    // Group requirements by network
    const networkCounts = new Map<SupportedNetwork, number>();
    for (const req of requirements) {
      networkCounts.set(req.network, (networkCounts.get(req.network) || 0) + 1);
    }

    // Find the network with the most requirements
    let bestNetwork: SupportedNetwork | undefined;
    let maxCount = 0;
    for (const [network, count] of networkCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        bestNetwork = network;
      }
    }

    if (!bestNetwork) {
      throw new PaymentProviderError(
        'Could not determine best network from requirements',
        'registry',
        undefined,
        'NETWORK_DETERMINATION_FAILED'
      );
    }

    return this.getProviderForNetwork(bestNetwork);
  }

  /**
   * Set explicit network to provider mapping
   * @param network - The network
   * @param providerName - The provider name
   */
  setNetworkProvider(network: SupportedNetwork, providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new PaymentProviderError(
        `Provider ${providerName} not registered`,
        'registry',
        network,
        'PROVIDER_NOT_REGISTERED'
      );
    }

    const provider = this.providers.get(providerName)!;
    if (!provider.supportsNetwork(network)) {
      throw new PaymentProviderError(
        `Provider ${providerName} does not support network ${network}`,
        'registry',
        network,
        'PROVIDER_UNSUPPORTED_NETWORK'
      );
    }

    this.networkToProvider.set(network, providerName);
  }

  /**
   * Get all registered providers
   * @returns Array of all registered providers
   */
  getAllProviders(): PaymentProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all supported networks across all providers
   * @returns Array of all supported networks
   */
  getSupportedNetworks(): SupportedNetwork[] {
    const networks = new Set<SupportedNetwork>();
    for (const provider of this.providers.values()) {
      for (const network of provider.supportedNetworks) {
        networks.add(network);
      }
    }
    return Array.from(networks);
  }

  /**
   * Check if a network is supported by any provider
   * @param network - The network to check
   * @returns True if supported
   */
  isNetworkSupported(network: SupportedNetwork): boolean {
    for (const provider of this.providers.values()) {
      if (provider.supportsNetwork(network)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get registry statistics
   * @returns Statistics about the registry
   */
  getStats(): {
    totalProviders: number;
    totalNetworks: number;
    networkMappings: Record<SupportedNetwork, string>;
    defaultProvider?: string;
  } {
    const networkMappings = {} as Record<SupportedNetwork, string>;
    for (const [network, provider] of this.networkToProvider.entries()) {
      networkMappings[network] = provider;
    }

    return {
      totalProviders: this.providers.size,
      totalNetworks: this.getSupportedNetworks().length,
      networkMappings,
      defaultProvider: this.defaultProvider
    };
  }
}

/**
 * Global registry instance
 */
export const globalPaymentProviderRegistry = new PaymentProviderRegistry();