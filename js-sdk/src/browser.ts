// Browser-only exports for frontend usage
export { 
    PaymentTransport, 
    createPaymentTransport,
    type PaymentTransportOptions 
} from './mcp/payment-http-transport.js';

// Re-export commonly used types from dependencies that work in browser
export type { Account } from 'viem';
export type { Client } from '@modelcontextprotocol/sdk/client/index.js'; 