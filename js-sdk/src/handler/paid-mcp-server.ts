import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer, type RegisteredTool, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
  ToolAnnotations
} from "@modelcontextprotocol/sdk/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import { gatherPlatformInfo } from "./platform-detection";
import type {
  Config,
  ExtendedMcpServer,
  ExtendedServerMethods,
  MCPayMcpServerOptions,
  MCPayOptions,
  PaymentAuthConfig,
  PaymentConfig,
  PaymentOptions,
  PaymentRequirements,
  PaymentValidationResponse,
  PaymentVerifier,
  SimplePaymentOptions
} from "./types";

// Type for Node.js errors with code property
interface NodeError extends Error {
  code?: string;
}

// Simple debug logging without external dependency
const debug = (namespace: string) => {
  return (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      console.log(`[${namespace}]`, ...args);
    }
  };
};

/**
 * Validates a payment header with the mcpay API.
 */
export async function validatePaymentWithMcpay(
  paymentHeader: string,
  config: PaymentAuthConfig
): Promise<PaymentValidationResponse> {
  const log = debug('payment-validation');
  
  try {
    log('Validating payment with mcpay API:', config.mcpayApiUrl);
    log('Payment header:', paymentHeader);
    log('Config:', JSON.stringify({
      apiKey: config.apiKey,
      mcpayApiUrl: config.mcpayApiUrl,
      mcpayApiValidationPath: config.mcpayApiValidationPath
    }, null, 2));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      log('Payment validation request timing out...');
      controller.abort();
    }, config.validationTimeout || 15000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // Construct URL properly, using /validate as default if path is undefined
    const validationPath = config.mcpayApiValidationPath || '/validate';
    const baseUrl = config.mcpayApiUrl?.replace(/\/$/, '') || ''; // Remove trailing slash
    const url = baseUrl + validationPath;
    
    log('Making request to:', url);
    
    // Validate URL before making request
    try {
      new URL(url);
    } catch (urlError) {
      throw new Error(`Invalid URL constructed: ${url}. Check mcpayApiUrl (${config.mcpayApiUrl}) and mcpayApiValidationPath (${config.mcpayApiValidationPath})`);
    }
    log('Request headers:', JSON.stringify(headers, null, 2));
    
    const requestBody = {
      payment: paymentHeader,
      timestamp: new Date().toISOString(),
    };
    log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log('Mcpay API responded with error:', response.status, response.statusText);
      const errorText = await response.text();
      return {
        isValid: false,
        errorReason: `API error: ${response.status} - ${errorText}`,
      };
    }

    const validationResult: PaymentValidationResponse = await response.json();
    log('Payment validation result:', validationResult);
    
    return validationResult;
  } catch (error) {
    log('Payment validation failed:', error);
    return {
      isValid: false,
      errorReason: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}
/**
 * Creates payment requirements using the MCPay API.
 */
async function createPaymentRequirementsWithMcpay(
  tool: string,
  paymentOptions: PaymentOptions,
  config: PaymentAuthConfig
): Promise<PaymentRequirements> {
  const log = debug('payment-requirements');
  
  try {
    log('Creating payment requirements with mcpay API:', config.mcpayApiUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      log('Payment requirements request timing out...');
      controller.abort();
    }, config.validationTimeout || 15000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const requirementsPath = config.mcpayApiRequirementsPath || '/requirements';
    const baseUrl = config.mcpayApiUrl?.replace(/\/$/, '') || ''; // Remove trailing slash
    const url = baseUrl + requirementsPath;
    
    log('Making requirements request to:', url);
    
    // Validate URL before making request
    try {
      new URL(url);
    } catch (urlError) {
      throw new Error(`Invalid URL constructed: ${url}. Check mcpayApiUrl (${config.mcpayApiUrl}) and mcpayApiRequirementsPath (${config.mcpayApiRequirementsPath})`);
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tool: tool,
        paymentOptions: paymentOptions,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      log('Mcpay API requirements responded with error:', response.status, response.statusText);
      const errorText = await response.text();
      throw new Error(`Requirements API error: ${response.status} - ${errorText}`);
    }

    const requirementsResult = await response.json();
    log('Payment requirements result:', requirementsResult);
    
    return requirementsResult;
  } catch (error) {
    log('Payment requirements creation failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown requirements creation error');
  }
}

/**
 * Creates a payment verifier function that validates X-Payment headers with MCPay.
 */
export function createPaymentVerifier(config: PaymentAuthConfig): PaymentVerifier {
  return async (req: Request, paymentHeader?: string): Promise<AuthInfo | undefined> => {
    if (!paymentHeader) {
      // Extract X-Payment header from request
      paymentHeader = req.headers.get('X-PAYMENT') || undefined;
    }
    
    if (!paymentHeader) {
      return undefined;
    }

    // Validate the payment with MCPay API
    const validationResult = await validatePaymentWithMcpay(paymentHeader, config);
    
    if (!validationResult.isValid) {
      console.warn('[mcpay] Payment validation failed:', validationResult.errorReason);
      return undefined;
    }

    // Create AuthInfo from validated payment
    return {
      token: paymentHeader,
      scopes: ['payment:verified'], // Default scope for validated payments
      clientId: validationResult.userId || validationResult.paymentId || 'anonymous',
      extra: {
        paymentId: validationResult.paymentId,
        userId: validationResult.userId,
        amount: validationResult.amount,
        currency: validationResult.currency,
        paymentMetadata: validationResult.metadata,
        validatedAt: new Date().toISOString(),
      },
    };
  };
}

class PaymentProcessor {
  private readonly log: ReturnType<typeof debug>;
  private readonly options: MCPayOptions;
  private pingAttempts: number = 0;
  private maxPingAttempts: number = 3;
  private pingCircuitBreakerUntil: Date | null = null;
  private readonly circuitBreakerDuration = 5 * 60 * 1000; // 5 minutes

  constructor(options?: MCPayOptions) {
    this.log = debug('payflow-sdk');

    // Define default ping options
    const defaultPingOptions = {
      enabled: true, // Disabled by default to prevent hanging when no server is available
      pingOnCreate: true,
      timeout: 3000,  // Reduced timeout for faster failures
      retryAttempts: 2,
      retryDelay: 1000, // 1 second base delay      
    };

    // Define default mcpay options
    const defaultMcpayOptions = {
      mcpayApiUrl: process.env.MCPAY_API_URL || 'https://mcpay.fun',
      apiKey: process.env.MCPAY_API_KEY || '',
      mcpayApiValidationPath: process.env.MCPAY_API_VALIDATION_PATH || '/validate',
      mcpayApiPingPath: process.env.MCPAY_API_PING_PATH || '/ping',
      mcpayApiRequirementsPath: process.env.MCPAY_API_REQUIREMENTS_PATH || '/requirements',
      validationTimeout: 15000,
      required: true,
      resourceMetadataPath: '/.well-known/oauth-protected-resource',
    };

    // Merge user options with defaults (preserving defaults for undefined values)
    this.options = {
      ping: {
        ...defaultPingOptions,
        ...(options?.ping || {}),
      },
      mcpay: {
        ...defaultMcpayOptions,
        ...(options?.mcpay || {}),
        // Ensure critical paths have defaults if undefined
        mcpayApiValidationPath: options?.mcpay?.mcpayApiValidationPath ?? defaultMcpayOptions.mcpayApiValidationPath,
        mcpayApiRequirementsPath: options?.mcpay?.mcpayApiRequirementsPath ?? defaultMcpayOptions.mcpayApiRequirementsPath,
        mcpayApiPingPath: options?.mcpay?.mcpayApiPingPath ?? defaultMcpayOptions.mcpayApiPingPath,
      },
    };

    // If pingOnCreate is enabled, ping immediately (good for serverless)
    if (this.options.ping?.pingOnCreate) {
      this.log('Pinging on create enabled, triggering immediate ping...');
      this.pingServerWithRetry().catch((error) => {
        console.warn('[mcpay] Immediate ping failed (non-blocking):', error);
      });
    }
  }

  /**
   * Creates a timeout promise that rejects after the specified duration
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Attempts to ping the server with retry logic and circuit breaker
   */
  async pingServerWithRetry(): Promise<void> {
    // Check circuit breaker
    if (this.pingCircuitBreakerUntil && new Date() < this.pingCircuitBreakerUntil) {
      this.log('Ping circuit breaker active, skipping ping until', this.pingCircuitBreakerUntil.toISOString());
      return;
    }

    const maxRetries = this.options.ping?.retryAttempts || 2;
    const baseDelay = this.options.ping?.retryDelay || 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.pingServer();
        this.log('Ping successful on attempt', attempt + 1);
        this.pingAttempts = 0; // Reset failure counter on success
        this.pingCircuitBreakerUntil = null; // Clear circuit breaker
        return;
      } catch (error) {
        this.pingAttempts++;
        const isLastAttempt = attempt === maxRetries;
        
        this.log(`Ping attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : String(error));
        
        if (isLastAttempt) {
          // Activate circuit breaker if we've failed too many times
          if (this.pingAttempts >= this.maxPingAttempts) {
            this.pingCircuitBreakerUntil = new Date(Date.now() + this.circuitBreakerDuration);
            this.log('Ping circuit breaker activated until', this.pingCircuitBreakerUntil.toISOString());
          }
          // Log the final failure but don't throw - let server continue running normally
          this.log('All ping attempts failed, continuing server operation normally:', error instanceof Error ? error.message : String(error));
          return;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        this.log(`Retrying ping in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Pings the configured server to notify it that the MCP handler has been created
   */
  async pingServer(): Promise<void> {
    this.log('Starting ping process...');
    
    if (!this.options.ping?.enabled) {
      this.log('Ping disabled, skipping server ping');
      return;
    }

    const mcpayApiUrl = this.options.mcpay?.mcpayApiUrl;
    const mcpayApiPingPath = this.options.mcpay?.mcpayApiPingPath;

    if (!mcpayApiUrl || !mcpayApiPingPath) {
      this.log('No ping server URL configured, skipping ping');
      return;
    }

    const baseUrl = mcpayApiUrl?.replace(/\/$/, '') || ''; // Remove trailing slash
    const pingPath = mcpayApiPingPath || '/ping';
    const pingUrl = baseUrl + pingPath;
    const timeout = this.options.ping?.timeout || 3000;

    // Validate URL before making request
    try {
      new URL(pingUrl);
    } catch (urlError) {
      throw new Error(`Invalid ping URL constructed: ${pingUrl}. Check mcpayApiUrl (${mcpayApiUrl}) and mcpayApiPingPath (${mcpayApiPingPath})`);
    }

    this.log('Attempting to ping server at:', pingUrl, 'with timeout:', timeout);

    // Quick connectivity hint for localhost
    if (pingUrl.includes('localhost') || pingUrl.includes('127.0.0.1')) {
      this.log('Pinging localhost - ensure local MCPay server is running or disable ping');
    }

    // Gather platform info with timeout (non-blocking)
    let platformInfo;
    try {
      const platformInfoPromise = gatherPlatformInfo(process.env);
      const platformTimeout = Math.min(timeout / 2, 2000); // Use half the ping timeout, max 2s
      
      platformInfo = await Promise.race([
        platformInfoPromise,
        this.createTimeoutPromise(platformTimeout)
      ]);
      
      this.log('Detected platform info:', platformInfo);
    } catch (error) {
      this.log('Platform detection failed or timed out, using fallback:', error instanceof Error ? error.message : String(error));
      platformInfo = {
        platform: 'Unknown',
        urls: [`http://localhost:${process.env.PORT || '3000'}`],
        signatureEnv: {}
      };
    }

    // Ensure all values in the payload are serializable and safe
    let payload: Record<string, unknown>;
    try {
      payload = {
        event: 'mcp_handler_created',
        timestamp: new Date().toISOString(),
        platform: platformInfo?.platform || 'Unknown',
        detectedUrls: Array.isArray(platformInfo?.urls) ? platformInfo.urls.filter(url => typeof url === 'string') : [],
        platformEnv: (platformInfo?.signatureEnv && typeof platformInfo.signatureEnv === 'object') 
          ? Object.fromEntries(
              Object.entries(platformInfo.signatureEnv)
                .filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
            )
          : {},
      };
    } catch (payloadError) {
      // If payload construction fails, use minimal safe payload
      this.log('Failed to construct full payload, using minimal payload:', payloadError instanceof Error ? payloadError.message : String(payloadError));
      payload = {
        event: 'mcp_handler_created',
        timestamp: new Date().toISOString(),
        platform: 'Unknown',
        detectedUrls: [],
        platformEnv: {},
      };
    }

    this.log('Ping payload:', payload);

    // Validate JSON serialization before sending
    let jsonBody: string;
    try {
      jsonBody = JSON.stringify(payload);
      this.log('Serialized JSON body length:', jsonBody.length);
    } catch (jsonError) {
      throw new Error(`Failed to serialize ping payload: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }

    try {
      // Use AbortController for proper timeout handling instead of Promise.race
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        this.log('Ping request timeout, aborting...');
        controller.abort();
      }, timeout);

      const response = await fetch(pingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.options.mcpay?.apiKey}`,
        },
        body: jsonBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.log('Successfully pinged server:', response.status);
        try {
          const responseText = await response.text();
          if (responseText) {
            this.log('Ping response:', responseText);
          }
        } catch (error) {
          this.log('Error reading ping response (non-critical):', error instanceof Error ? error.message : String(error));
        }
      } else {
        this.log('Ping server responded with error:', response.status, response.statusText);
        try {
          const errorText = await response.text();
          if (errorText) {
            this.log('Error response body:', errorText);
          }
        } catch (error) {
          this.log('Error reading error response (non-critical):', error instanceof Error ? error.message : String(error));
        }
        throw new Error(`Ping failed with status ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Categorize and handle different types of errors
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(`Ping timed out after ${timeout}ms`);
        } else if (error.message.includes('timed out')) {
          throw new Error(`Ping timed out after ${timeout}ms`);
        } else if ('code' in error && (error as NodeError).code === 'ECONNREFUSED') {
          throw new Error(`Connection refused - is the ping server running at ${pingUrl}?`);
        } else if ('code' in error && (error as NodeError).code === 'ENOTFOUND') {
          throw new Error(`DNS resolution failed for ${pingUrl}`);
        } else if ('code' in error && (error as NodeError).code === 'ECONNRESET') {
          throw new Error(`Connection reset by server at ${pingUrl}`);
        } else {
          throw new Error(`Ping failed: ${error.message}`);
        }
      } else {
        throw new Error(`Ping failed: ${String(error)}`);
      }
    }
  }

  /**
   * Determines if payment options are simple or advanced based on their properties.
   */
  private isSimplePayment(options: PaymentOptions): options is SimplePaymentOptions {
    return 'price' in options && 'currency' in options && !('rawAmount' in options);
  }

  /**
   * Creates an error response in the standard CallToolResult format
   */
  private createErrorResponse(message: string): CallToolResult {
    this.log('Error:', message);
    return {
      content: [{ 
        type: 'text', 
        text: message, 
        isError: true 
      }],
    };
  }

  /**
   * Creates a payment requirements response for unpaid requests
   */
  private createPaymentRequirementsResponse(requirements: PaymentRequirements): CallToolResult {
    return {
      content: [{
        type: 'text',
        text: `Payment required. Please provide payment via X-PAYMENT header.\n\nPayment Requirements:\n- Amount: ${requirements.maxAmountRequired} ${requirements.asset}\n- Recipient: ${requirements.payTo}\n- Network: ${requirements.network}\n- Description: ${requirements.description}`
      }],
      isError: false,
    };
  }

  /**
   * Executes the tool callback with proper type safety
   */
  private async executeToolCallback(
    cb: ToolCallback,
    toolArgs: Record<string, unknown>,
    context: RequestHandlerExtra<ServerRequest, ServerNotification>
  ): Promise<CallToolResult> {

    const authInfo = context.authInfo;

    if (!authInfo || !authInfo.scopes.includes('payment:verified')) {
      return this.createErrorResponse('Payment required. Please provide payment via X-PAYMENT header.');
    }

    return await (cb as unknown as (args: Record<string, unknown>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => Promise<CallToolResult>)(toolArgs, context);
  }

  /**
   * Generates payment requirements for a tool when no valid payment is provided
   */
  private async generatePaymentRequirements(
    toolName: string,
    paymentConfig: PaymentConfig
  ): Promise<PaymentRequirements> {
    if (!this.options.mcpay) {
      throw new Error('MCPay configuration is required');
    }

    const paymentOptionsArray = this.normalizePaymentConfig(paymentConfig);
    const selectedPaymentOption = paymentOptionsArray[0]; // Use first option for requirements

    return await createPaymentRequirementsWithMcpay(toolName, selectedPaymentOption, this.options.mcpay);
  }

  createPaidCallback<ArgsSchema extends ZodTypeAny>(
    name: string,
    paymentConfig: PaymentConfig,
    schema: ArgsSchema,
    cb: ToolCallback
  ): (args: { [x: string]: unknown }, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => Promise<CallToolResult> {
    // Return a function that matches the expected signature for server.tool
    return async (args: { [x: string]: unknown }, context: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> => {
      this.log('Executing paid tool:', name);

      try {
        // Extract payment header and tool arguments
        const { ...toolArgs } = args as (z.infer<ArgsSchema>);
        
        // Validate tool arguments against schema
        const validatedArgs = schema.parse(toolArgs);

        // Check if payment header is provided
        if (!context.authInfo?.scopes.includes('payment:verified')) {
          // No payment provided - generate and return payment requirements
          try {
            const requirements = await this.generatePaymentRequirements(name, paymentConfig);
            return this.createPaymentRequirementsResponse(requirements);
          } catch (error) {
            return this.createErrorResponse(
              `Failed to generate payment requirements: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
        
        try {
          const result = await this.executeToolCallback(cb, validatedArgs, context);
          return result;
        } catch (error) {
          return this.createErrorResponse(
            `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }

      } catch (error) {
        // Handle schema validation errors and any other unexpected errors
        if (error instanceof z.ZodError) {
          return this.createErrorResponse(
            `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        
        return this.createErrorResponse(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };
  }

  // Helper function to check if an object is a Zod schema
  private isZodRawShape(obj: unknown): obj is ZodRawShape {
    if (typeof obj !== 'object' || obj === null) return false;
    const isEmptyObject = Object.keys(obj).length === 0;
    // Check if object is empty or at least one property is a ZodType instance
    return isEmptyObject || Object.values(obj as object).some(this.isZodTypeLike);
  }

  private isZodTypeLike(value: unknown): value is ZodTypeAny {
    if (value === null || typeof value !== 'object') return false;
    
    try {
      const obj = value as Record<string, unknown>;
      
      // Most reliable check: Zod types have a _def property
      if ('_def' in obj && typeof obj._def === 'object') {
        return true;
      }
      
      // Check for parse and safeParse methods
      if ('parse' in obj && typeof obj.parse === 'function' &&
          'safeParse' in obj && typeof obj.safeParse === 'function') {
        return true;
      }
      
      // Check constructor name (covers more Zod types)
      if (obj.constructor?.name?.includes('Zod')) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Normalizes PaymentConfig to always return an array of PaymentOptions.
   */
  private normalizePaymentConfig(config: PaymentConfig): PaymentOptions[] {
    return Array.isArray(config) ? config : [config];
  }

  /**
   * Determines if payment config contains simple or advanced payment types.
   */
  private isPaymentConfig(obj: unknown): obj is PaymentConfig {
    if (Array.isArray(obj)) {
      return obj.length > 0 && obj.every(item => 
        (typeof item === 'object' && item !== null) &&
        (
          // SimplePaymentOptions: price + currency (recipient optional)
          ('price' in item && 'currency' in item) ||
          // AdvancedPaymentOptions: recipient + rawAmount + tokenDecimals  
          ('recipient' in item && 'rawAmount' in item && 'tokenDecimals' in item)
        )
      );
    }
    
    return (typeof obj === 'object' && obj !== null) &&
           (
             // SimplePaymentOptions: price + currency (recipient optional)
             ('price' in obj && 'currency' in obj) ||
             // AdvancedPaymentOptions: recipient + rawAmount + tokenDecimals
             ('recipient' in obj && 'rawAmount' in obj && 'tokenDecimals' in obj)
           );
  }

  createPaidToolMethod(server: McpServer): ExtendedServerMethods['paidTool'] {
    return (name: string, ...rest: unknown[]): RegisteredTool => {
      let description: string | undefined;
      let paymentConfig: PaymentConfig | undefined;
      let inputSchema: ZodRawShape | undefined;
      let annotations: ToolAnnotations | undefined;

      // Check for description as first argument
      if (rest.length >= 1 && typeof rest[0] === 'string') {
        description = rest.shift() as string;
      }

      // Check for PaymentConfig object or array
      if (rest.length >= 1 && this.isPaymentConfig(rest[0])) {
        paymentConfig = rest.shift() as PaymentConfig;
      }

      // Check for input schema or annotations
      if (rest.length >= 1) {
        if (this.isZodRawShape(rest[0])) {
          inputSchema = rest.shift() as ZodRawShape;
        } else if (typeof rest[0] === 'object' && rest[0] !== null && 'title' in rest[0]) {
          annotations = rest.shift() as ToolAnnotations;
        }
      }

      // Check for annotations if not found yet
      if (rest.length >= 1 && typeof rest[0] === 'object' && rest[0] !== null && 'title' in rest[0]) {
        annotations = rest.shift() as ToolAnnotations;
      }

      if (rest.length > 1) {
        throw new Error('Too many arguments to paidTool()');
      }

      if (!paymentConfig) {
        throw new Error('PaymentConfig are required for paidTool()');
      }

      // Normalize paymentConfig to an array of PaymentOptions
      const paymentOptionsArray = this.normalizePaymentConfig(paymentConfig);

      // Create annotations with all payment options information
      const allPaymentDetails = paymentOptionsArray.map(option => {
        return this.isSimplePayment(option) 
          ? {
              type: 'simple',
              price: option.price,
              currency: option.currency,
              recipient: option.recipient,
            }
          : {
              type: 'advanced',
              rawAmount: option.rawAmount,
              tokenDecimals: option.tokenDecimals,
              recipient: option.recipient,
              network: option.network,
              ...(option.tokenAddress && { tokenAddress: option.tokenAddress }),
              ...(option.tokenSymbol && { tokenSymbol: option.tokenSymbol }),
            };
      });

      const paymentAnnotations = {
        payment: paymentOptionsArray.length === 1 ? allPaymentDetails[0] : allPaymentDetails,
        ...annotations,
      };

      const cb = rest[0] as ToolCallback;

      let finalSchema: ZodRawShape;
      if (inputSchema) {
        // Merge the input schema with payment schema
        finalSchema = {
          ...inputSchema,
        };
      } else {
        finalSchema = {};
      }

      // Create the schema object for createPaidCallback
      const schemaForCallback = inputSchema ? z.object(inputSchema) : z.object({});

      // Create the paid callback with proper typing
      const paidCb = this.createPaidCallback(
        name,
        paymentConfig,
        schemaForCallback,
        cb
      );

      // Generate description based on payment options
      const toolDescription = description || `Paid tool ${name}`;
      let paymentInfo: string;
      
      if (paymentOptionsArray.length === 1) {
        const option = paymentOptionsArray[0];
        paymentInfo = this.isSimplePayment(option)
          ? `Price: ${option.price} ${option.currency} - Recipient: ${option.recipient}`
          : `Raw Amount: ${option.rawAmount} (${option.tokenSymbol || 'tokens'}) - Recipient: ${option.recipient}`;
      } else {
        paymentInfo = `Multiple payment options available (${paymentOptionsArray.length} options):\n` +
          paymentOptionsArray.map((option, index) => {
            const details = this.isSimplePayment(option)
              ? `${option.price} ${option.currency}`
              : `${option.rawAmount} ${option.tokenSymbol || 'tokens'}`;
            return `  ${index + 1}. ${details} - ${option.recipient}`;
          }).join('\n');
      }
      
      const fullDescription = `${toolDescription}\nIMPORTANT: Payment details:\n${paymentInfo}`;

      // Register the tool with payment annotations
      return server.tool(name, fullDescription, finalSchema, paymentAnnotations, paidCb);
    };
  }
}

function _createPaidMcpHandler(
  initializeServer: ((server: ExtendedMcpServer) => Promise<void>) | ((server: ExtendedMcpServer) => void),
  serverOptions?: MCPayMcpServerOptions,
  config?: Config
): (request: Request) => Promise<Response> {
  console.log('[mcpay] Creating paid MCP handler...', { serverOptions });
  const processor = new PaymentProcessor(serverOptions);

  processor.pingServerWithRetry();

  return createMcpHandler(
    // Wrap the initialization to use ExtendedMcpServer
    async (server: McpServer) => {
      console.log('[mcpay] Initializing MCP server with payment support...');
      
      // Create a proxy that adds the paidTool method while delegating everything else to the original server
      const extendedServer = new Proxy(server, {
        get(target, prop, receiver) {
          if (prop === 'paidTool') {
            return processor.createPaidToolMethod(target);
          }
          return Reflect.get(target, prop, receiver);
        }
      }) as ExtendedMcpServer;
      
      // Call the user's initialization function with the extended server
      await initializeServer(extendedServer);
      
      console.log('[mcpay] Server initialized, triggering ping...');

      // Ping the server asynchronously after initialization (don't await to avoid blocking)
      // Only ping here if pingOnCreate is disabled
      if (!serverOptions?.ping?.pingOnCreate) {
        processor.pingServerWithRetry().catch((error) => {
          // Already handled in pingServer method, but adding extra safety
          console.warn('Ping server error (non-blocking):', error);
        });
      } else {
        console.log('[mcpay] Skipping server initialization ping (already pinged on create)');
      }
    },
    serverOptions,
    config
  );
}

/**
 * Creates a payment-based authenticated MCP handler that validates X-Payment headers with mcpay API
 * @param initializeServer - A function that initializes the MCP server with paid tools
 * @param serverOptions - Options for the MCP server including MCPay configuration
 * @param config - Configuration for the MCP handler
 * @returns A function that can be used to handle MCP requests with payment-based authentication
 */
export function createPaidMcpHandler(
  initializeServer: ((server: ExtendedMcpServer) => Promise<void>) | ((server: ExtendedMcpServer) => void),
  serverOptions?: MCPayMcpServerOptions,
  config?: Config
): (request: Request) => Promise<Response> {

  // Create the payment verifier
  const paymentVerifier = createPaymentVerifier(serverOptions?.mcpay);
  
  // Create the base paid handler
  const paidHandler = _createPaidMcpHandler(initializeServer, serverOptions, config);
  
  // Wrap the paid handler with payment-based authentication
  const authHandler = withMcpAuth(paidHandler, paymentVerifier, {
    requiredScopes: ['payment:verified'],
  });
  
  return authHandler;
}