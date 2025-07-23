import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer, type RegisteredTool, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
    ToolAnnotations
} from "@modelcontextprotocol/sdk/types.js";
import { type ZodRawShape } from "zod";

export type PaymentRequirements = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  outputSchema?: any;
  extra: {
    name: string;
    version: string;
  };
};

export type VerifyResponse = {
  isValid: boolean;
  invalidReason?: string;
};
/**
 * Advanced payment options for precise control over payment parameters.
 */
export type AdvancedPaymentOptions = {
  /**
   * The recipient address for the payment.
   */
  recipient: string;
  /**
   * The raw amount in atomic units (e.g., wei for ETH, smallest unit for tokens).
   */
  rawAmount: string;
  /**
   * The number of decimals for the token.
   */
  tokenDecimals: number;
  /**
   * The token contract address (optional for native tokens).
   */
  tokenAddress?: string;
  /**
   * The blockchain network to settle the payment on.
   */
  network: number | string;
  /**
   * Human-readable description of the token (e.g., "USDC", "ETH").
   */
  tokenSymbol?: string;
};

/**
 * Simple payment options using fiat currency and human-readable pricing.
 */
export type SimplePaymentOptions = {
  /**
   * The price in human-readable format (e.g., 5.99 for $5.99).
   */
  price: number;
  /**
   * The fiat currency for the price.
   */
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | string;
  /**
   * The recipient address for the payment.
   */
  recipient?: string;
};

/**
 * Union type for all payment options.
 */
export type PaymentOptions = AdvancedPaymentOptions | SimplePaymentOptions;

/**
 * Payment configuration that can be either a single option or multiple options.
 */
export type PaymentConfig = PaymentOptions | PaymentOptions[];

/**
 * Configuration for payment-based authentication.
 */
export type PaymentAuthConfig = {
  /**
   * The mcpay API endpoint for payment validation.
   */
  mcpayApiUrl: string;
  /**
   * API key for mcpay validation requests.
   */
  apiKey: string;
  /**
   * The mcpay API endpoint for payment validation.
   */
  mcpayApiValidationPath?: string;
  /**
   * The mcpay API endpoint for pinging the server.
   */
  mcpayApiPingPath?: string;
  /**
   * The mcpay API endpoint for settling the payment.
   */
  mcpayApiSettlePath?: string;
  /**
   * The mcpay API endpoint for creating a payment.
   */
  mcpayApiCreatePaymentPath?: string;
  /**
   * The mcpay API endpoint for getting the recipient address.
   * This is used to get the recipient address from the mcpay API.
   */
  mcpayApiGetRecipientAddressPath?: string;
  /**
   * The mcpay API endpoint for decoding payments.
   * This is used to decode payment headers into payment payloads.
   */
  mcpayApiDecodePath?: string;
  /**
   * The mcpay API endpoint for creating payment requirements.
   * This is used to generate payment requirements for tools.
   */
  mcpayApiRequirementsPath?: string;
  /**
   * Timeout for payment validation requests in milliseconds.
   * @default 5000
   */
  validationTimeout?: number;
  /**
   * Whether payment validation is required for all requests.
   * @default true
   */
  required?: boolean;
  /**
   * Custom metadata path for OAuth protected resource.
   * @default "/.well-known/oauth-protected-resource"
   */
  resourceMetadataPath?: string;
};

export type MCPayOptions = {
  mcpay?: PaymentAuthConfig,
  /**
   * Ping configuration for the MCP server
   */
  ping?: {
    /**
     * Whether to enable pinging (default: true)
     */
    enabled?: boolean;
    /**
     * Timeout for ping requests in milliseconds (default: 5000)
     */
    timeout?: number;
    /**
     * Whether to ping immediately when handler is created (good for serverless)
     * vs waiting for first server initialization (default: false)
     */
    pingOnCreate?: boolean;
    /**
     * Number of retry attempts for failed pings (default: 2)
     */
    retryAttempts?: number;
    /**
     * Base delay between retry attempts in milliseconds (default: 1000)
     * Uses exponential backoff with jitter
     */
    retryDelay?: number;
  };
};

/**
 * Configuration for the MCP handler.
 * @property redisUrl - The URL of the Redis instance to use for the MCP handler.
 * @property streamableHttpEndpoint - The endpoint to use for the streamable HTTP transport.
 * @property sseEndpoint - The endpoint to use for the SSE transport.
 * @property verboseLogs - If true, enables console logging.
 */
export type Config = {
  redisUrl?: string;
  /**
   * The maximum duration of an MCP request in seconds.
   * @default 60
   */
  maxDuration?: number;
  /**
   * If true, enables console logging.
   * @default false
   */
  verboseLogs?: boolean;
  /**
   * The base path to use for deriving endpoints.
   * If provided, endpoints will be derived from this path.
   * For example, if basePath is "/", that means your routing is:
   *  /app/[transport]/route.ts and then:
   * - streamableHttpEndpoint will be "/mcp"
   * - sseEndpoint will be "/sse"
   * - sseMessageEndpoint will be "/message"
   * @default ""
   */
  basePath?: string;
  /**
   * Callback function that receives MCP events.
   * This can be used to track analytics, debug issues, or implement custom behaviors.
   */
  onEvent?: (event: unknown) => void;
  /**
   * If true, disables the SSE endpoint.
   * As of 2025-03-26, SSE is not supported by the MCP spec.
   * https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
   * @default false
   */
  disableSse?: boolean;
};

export type MCPayMcpServerOptions = any & MCPayOptions;

/**
 * Configuration for authentication.
 */
export type AuthConfig = {
  /**
   * Whether authentication is required for all requests.
   * @default true
   */
  required?: boolean;
  // /**
  //  * Required scopes for accessing the handler.
  //  */
  // requiredScopes?: string[];
  // /**
  //  * Custom metadata path for OAuth protected resource.
  //  * @default "/.well-known/oauth-protected-resource"
  //  */
  // resourceMetadataPath?: string;
};

/**
 * Token verification function type.
 */
export type TokenVerifier = (
  req: Request,
  bearerToken?: string
) => Promise<AuthInfo | undefined>;

/**
 * Payment validation response from mcpay API.
 */
export type PaymentValidationResponse = {
  isValid: boolean;
  paymentId?: string;
  userId?: string;
  amount?: string;
  currency?: string;
  errorReason?: string;
  metadata?: Record<string, any>;
};

/**
 * Payment verification function type.
 */
export type PaymentVerifier = (
  req: Request,
  paymentHeader?: string
) => Promise<AuthInfo | undefined>;

// Interface for extended server functionality
export interface ExtendedServerMethods {
  paidTool(name: string, options: PaymentConfig, cb: ToolCallback): RegisteredTool;
  paidTool(name: string, description: string, options: PaymentConfig, cb: ToolCallback): RegisteredTool;
  paidTool<Args extends ZodRawShape>(
    name: string,
    options: PaymentConfig,
    paramsSchema: Args,
    cb: ToolCallback<Args>
  ): RegisteredTool;
  paidTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    options: PaymentConfig,
    paramsSchema: Args,
    cb: ToolCallback<Args>
  ): RegisteredTool;
  paidTool<Args extends ZodRawShape>(
    name: string,
    options: PaymentConfig,
    paramsSchema: Args,
    annotations: ToolAnnotations,
    cb: ToolCallback<Args>
  ): RegisteredTool;
  paidTool<Args extends ZodRawShape>(
    name: string,
    description: string,
    options: PaymentConfig,
    paramsSchema: Args,
    annotations: ToolAnnotations,
    cb: ToolCallback<Args>
  ): RegisteredTool;
}

export type ExtendedMcpServer = McpServer & ExtendedServerMethods; 