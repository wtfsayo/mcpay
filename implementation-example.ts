/**
 * Implementation Example: Multi-Provider Payment System
 * 
 * This file demonstrates how to use the new provider-based payment system
 * that supports both the original x402 implementation and the new Sei x402 SDK.
 */

// Frontend Usage Example
import { 
  createConfiguredProviderRegistry, 
  PaymentProviderRegistry,
  type MultiProviderConfig 
} from './js-sdk/src/providers/index.js';
import { createPaymentTransport } from './js-sdk/src/mcp/payment-http-transport.js';

/**
 * Example 1: Basic setup with automatic provider selection
 */
async function basicUsageExample() {
  // Create a registry with default configuration
  const registry = createConfiguredProviderRegistry({
    debug: true,
    enableSeiProvider: true
  });

  // Check what's available
  console.log('Registry stats:', registry.getStats());
  
  // Get provider for a specific network
  const baseProvider = registry.getProviderForNetwork('base-sepolia');
  const seiProvider = registry.getProviderForNetwork('sei-testnet');
  
  console.log('Base provider:', baseProvider.name);
  console.log('Sei provider:', seiProvider.name);
}

/**
 * Example 2: Advanced configuration with custom provider options
 */
async function advancedConfigurationExample() {
  const config: MultiProviderConfig = {
    debug: true,
    enableSeiProvider: true,
    providers: {
      'x402-original': {
        debug: true,
        facilitatorUrls: {
          'base-sepolia': 'https://custom-base-facilitator.example.com',
        },
        timeout: 30000,
        maxRetries: 3
      },
      'sei-x402': {
        debug: true,
        providerOptions: {
          enableOptimizations: true,
          useNativeFeatures: true
        }
      }
    },
    networkMappings: {
      'sei-testnet': 'sei-x402',
      'base-sepolia': 'x402-original'
    }
  };

  const registry = createConfiguredProviderRegistry(config);
  
  // Test provider capabilities
  const providers = registry.getAllProviders();
  for (const provider of providers) {
    console.log(`${provider.name} capabilities:`, provider.getCapabilities());
  }
}

/**
 * Example 3: Using with PaymentTransport (updated to use provider registry)
 */
async function paymentTransportExample() {
  // This is how the PaymentTransport would be updated to use the provider system
  
  const registry = createConfiguredProviderRegistry({
    debug: true,
    enableSeiProvider: true
  });

  // Mock wallet client (in real usage, this would be from viem or similar)
  const mockWalletClient = {
    chain: { id: 1328 }, // Sei testnet
    account: { address: '0x123...' }
  } as any;

  // Create payment transport with provider registry
  const paymentTransport = createPaymentTransport(
    new URL('https://api.example.com'),
    mockWalletClient,
    {
      maxPaymentValue: BigInt(1000000), // 1 USDC
      // New option: provider registry
      providerRegistry: registry,
      // Or specify provider selection strategy
      providerSelectionStrategy: 'automatic' // 'automatic', 'prefer-sei', 'prefer-original'
    }
  );

  console.log('Payment transport created with multi-provider support');
}

/**
 * Example 4: Backend integration with provider manager
 */
async function backendIntegrationExample() {
  // Import the backend provider manager
  const { globalBackendProviderManager } = await import('./backend/lib/payment-providers/index.js');
  
  // Check backend provider stats
  console.log('Backend provider stats:', globalBackendProviderManager.getStats());
  
  // Mock payment payload and requirements
  const mockPayload = {
    x402Version: 1,
    scheme: 'exact' as const,
    network: 'sei-testnet' as const,
    payload: {
      signature: '0x...',
      authorization: {
        from: '0x123...',
        to: '0x456...',
        value: '1000000',
        validAfter: '1640995200',
        validBefore: '1640998800',
        nonce: '0xabc...'
      }
    }
  };

  const mockRequirements = {
    scheme: 'exact' as const,
    network: 'sei-testnet' as const,
    maxAmountRequired: '1000000',
    resource: 'https://api.example.com/tool/123',
    description: 'Test payment',
    mimeType: 'application/json',
    payTo: '0x456...',
    maxTimeoutSeconds: 3600,
    asset: '0x789...'
  };

  // Verify payment using appropriate provider
  const verificationResult = await globalBackendProviderManager.verifyPayment(
    mockPayload,
    mockRequirements
  );
  
  console.log('Verification result:', verificationResult);
  
  if (verificationResult.isValid) {
    // Settle payment
    const settlementResult = await globalBackendProviderManager.settle(
      mockPayload,
      mockRequirements
    );
    
    console.log('Settlement result:', settlementResult);
  }
}

/**
 * Example 5: Runtime provider switching and fallback
 */
async function runtimeProviderSwitchingExample() {
  const registry = new PaymentProviderRegistry();
  
  // Register providers with different priorities
  const { X402Provider, SeiX402Provider } = await import('./js-sdk/src/providers/index.js');
  
  const x402Provider = new X402Provider({ debug: true });
  const seiProvider = new SeiX402Provider({ debug: true });
  
  registry.register(x402Provider, true); // Default
  registry.register(seiProvider);
  
  // Test network-specific provider selection
  const networks = ['base-sepolia', 'sei-testnet', 'avalanche'] as const;
  
  for (const network of networks) {
    try {
      const provider = registry.getProviderForNetwork(network);
      console.log(`Network ${network} -> Provider ${provider.name}`);
      
      // Check provider capabilities for this network
      const capabilities = provider.getCapabilities();
      console.log(`  Capabilities:`, capabilities);
      
    } catch (error) {
      console.error(`No provider for network ${network}:`, error);
    }
  }
}

/**
 * Example 6: Migration strategy - gradual rollout
 */
async function migrationStrategyExample() {
  // This demonstrates how to gradually migrate from the old system to the new one
  
  // Phase 1: Use feature flags to enable the new system
  const enableNewProviderSystem = process.env.ENABLE_NEW_PROVIDER_SYSTEM === 'true';
  const enableSeiProvider = process.env.ENABLE_SEI_PROVIDER === 'true';
  
  if (enableNewProviderSystem) {
    console.log('Using new provider system');
    
    const registry = createConfiguredProviderRegistry({
      enableSeiProvider,
      debug: process.env.NODE_ENV === 'development'
    });
    
    // Use the new system
    return registry;
  } else {
    console.log('Using legacy payment system');
    
    // Fall back to the old system
    // This would be the existing createPaymentTransport without provider registry
    return null;
  }
}

/**
 * Example 7: Performance monitoring and observability
 */
async function performanceMonitoringExample() {
  const registry = createConfiguredProviderRegistry({
    debug: true,
    enableSeiProvider: true
  });
  
  // Mock performance monitoring
  const performanceMetrics = {
    providerUsage: new Map<string, number>(),
    networkLatency: new Map<string, number[]>(),
    errorRates: new Map<string, number>()
  };
  
  // Simulate monitoring provider usage
  const networks = ['base-sepolia', 'sei-testnet'] as const;
  
  for (const network of networks) {
    const provider = registry.getProviderForNetwork(network);
    
    // Track usage
    const currentUsage = performanceMetrics.providerUsage.get(provider.name) || 0;
    performanceMetrics.providerUsage.set(provider.name, currentUsage + 1);
    
    // Simulate latency measurement
    const latencies = performanceMetrics.networkLatency.get(network) || [];
    latencies.push(Math.random() * 1000); // Mock latency
    performanceMetrics.networkLatency.set(network, latencies);
    
    console.log(`Provider ${provider.name} used for ${network}`);
  }
  
  // Log metrics
  console.log('Performance metrics:', {
    providerUsage: Object.fromEntries(performanceMetrics.providerUsage),
    averageLatency: Object.fromEntries(
      Array.from(performanceMetrics.networkLatency.entries()).map(([network, latencies]) => [
        network,
        latencies.reduce((a, b) => a + b, 0) / latencies.length
      ])
    )
  });
}

// Run examples
async function runExamples() {
  console.log('=== Basic Usage Example ===');
  await basicUsageExample();
  
  console.log('\n=== Advanced Configuration Example ===');
  await advancedConfigurationExample();
  
  console.log('\n=== Payment Transport Example ===');
  await paymentTransportExample();
  
  console.log('\n=== Backend Integration Example ===');
  await backendIntegrationExample();
  
  console.log('\n=== Runtime Provider Switching Example ===');
  await runtimeProviderSwitchingExample();
  
  console.log('\n=== Migration Strategy Example ===');
  await migrationStrategyExample();
  
  console.log('\n=== Performance Monitoring Example ===');
  await performanceMonitoringExample();
}

// Export for use in other files
export {
  basicUsageExample,
  advancedConfigurationExample,
  paymentTransportExample,
  backendIntegrationExample,
  runtimeProviderSwitchingExample,
  migrationStrategyExample,
  performanceMonitoringExample,
  runExamples
};

// Uncomment to run examples
// runExamples().catch(console.error);