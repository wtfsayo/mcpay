import type { StreamableHTTPClientTransportOptions } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Account } from "viem";
import { wrapFetchWithPayment } from "x402-fetch";
import type { PaymentRequirementsSelector } from "x402/client";
import {
    createPaymentHeader,
    selectPaymentRequirements,
} from "x402/client";
import { ChainIdToNetwork, evm } from "x402/types";
import { z } from "zod";

// Import the type from x402/types to match the expected type
import type { PaymentRequirements } from "x402/types";

/**
 * Custom schema for payment requirements that matches our server's format.
 * This is more lenient than the x402 default schema.
 */
const CustomPaymentRequirementsSchema = z.object({
    scheme: z.enum(["exact"]),
    network: z.enum(["base-sepolia", "base", "sei-testnet"]), // Restrict to supported networks
    maxAmountRequired: z.string(),
    resource: z.string(), // Allow any string, not just URLs
    description: z.string().optional().default(""),
    mimeType: z.string().optional().default(""),
    maxTimeoutSeconds: z.number().optional().transform(val => val ?? 60), // Default to 60 if not provided
    asset: z.string(),
    payTo: z.string().optional(), // Make payTo optional
    extra: z.record(z.unknown()).optional()
});

/**
 * Configuration options for payment handling in the PaymentTransport.
 */
export interface PaymentTransportOptions extends StreamableHTTPClientTransportOptions {
    /**
     * The maximum allowed payment amount in base units (defaults to 0.1 USDC)
     */
    maxPaymentValue?: bigint;

    /**
     * A function that selects the payment requirements from the response
     */
    paymentRequirementsSelector?: PaymentRequirementsSelector;
}

/**
 * Payment requirements structure returned by the API
 */
interface PaymentRequirementsResponse {
    x402Version: number;
    accepts: unknown[];
    error?: string;
}

/**
 * PaymentTransport extends StreamableHTTPClientTransport to handle 402 Payment Required responses
 * by automatically creating and sending payment headers using the x402 payment protocol.
 * 
 * This implementation uses the x402-fetch library to automatically handle payments.
 */
export class PaymentTransport extends StreamableHTTPClientTransport {
    private _walletClient: typeof evm.SignerWallet | Account;
    private _maxPaymentValue: bigint;
    private _paymentRequirementsSelector: PaymentRequirementsSelector;
    private _paymentUrl: URL;
    private _customRequestInit?: RequestInit;
    private _paymentFetch: ReturnType<typeof wrapFetchWithPayment>;

    constructor(
        url: URL,
        walletClient: typeof evm.SignerWallet | Account,
        opts: PaymentTransportOptions,
    ) {
        // Call parent constructor with normal options first
        super(url, {
            sessionId: opts.sessionId,
            requestInit: opts.requestInit,
            authProvider: opts.authProvider,
            reconnectionOptions: opts.reconnectionOptions
        });
        
        // Create a payment-enabled fetch function that preserves all headers
        const paymentFetch = async (input: string | URL, init?: RequestInit) => {
            // Start with the original fetch
            const response = await fetch(input, init);

            // If not a 402 response, just return it
            if (response.status !== 402) {
                return response;
            }

            // Handle 402 Payment Required response
            console.log("[x402] Payment required response detected");

            // Parse payment requirements
            const { x402Version, accepts } = (await response.json()) as {
                x402Version: number;
                accepts: unknown[];
            };

            // Parse requirements with our custom schema
            const parsedPaymentRequirements = accepts.map(req => {
                // Validate and normalize with our custom schema
                const validated = CustomPaymentRequirementsSchema.parse(req);

                // Add default payTo if missing (required by createPaymentHeader)
                if (!validated.payTo) {
                    (validated as any).payTo = validated.asset;
                }

                // Ensure maxTimeoutSeconds is set
                if (validated.maxTimeoutSeconds === undefined) {
                    (validated as any).maxTimeoutSeconds = 60;
                }

                return validated as unknown as PaymentRequirements;
            });

            // Get chain ID from wallet client
            const chainId = (walletClient as any).chain?.id || 
                           (walletClient as any).client?.chain?.id || 
                           84532; // fallback to Base Sepolia

            console.log("[x402] Constructor payment fetch - Wallet client chain info:", {
                walletChainId: (walletClient as any).chain?.id,
                clientChainId: (walletClient as any).client?.chain?.id,
                resolvedChainId: chainId
            });

            // Select appropriate payment requirements
            const selectedPaymentRequirements = this._paymentRequirementsSelector(
                parsedPaymentRequirements,
                chainId ? ChainIdToNetwork[chainId] : undefined,
                "exact",
            );

            // Check if the payment amount exceeds the maximum allowed
            if (BigInt(selectedPaymentRequirements.maxAmountRequired) > this._maxPaymentValue) {
                throw new Error(`Payment amount ${selectedPaymentRequirements.maxAmountRequired} exceeds maximum allowed ${this._maxPaymentValue}`);
            }

            console.log("[x402] Constructor - About to create payment header with:", {
                walletClient: walletClient,
                x402Version,
                selectedPaymentRequirements
            });

            // Create payment header
            const paymentHeader = await createPaymentHeader(
                walletClient,
                x402Version,
                selectedPaymentRequirements,
            );

            // Create new headers object, preserving all original headers
            const newHeaders = new Headers(init?.headers || {});
            newHeaders.set("X-PAYMENT", paymentHeader);
            newHeaders.set("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");

            // Create a new request init object with all original properties
            const newInit = {
                ...init,
                headers: newHeaders,
            };

            // Make the request with payment header
            console.log("[x402] Retrying request with payment header");
            return fetch(input, newInit);
        };
        
        // Wrap the payment fetch with logging
        const loggedPaymentFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            // Log the request with timestamp
            const timestamp = new Date().toISOString();
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
            console.log(`[x402-log][${timestamp}] Request URL: ${url}`);
            
            // Log HTTP method/verb
            const method = init?.method || 'GET';
            console.log(`[x402-log][${timestamp}] HTTP Method: ${method}`);
            
            if (init) {
                // Log headers
                console.log(`[x402-log][${timestamp}] Request Headers:`, init.headers);
                
                // Log credentials mode
                if (init.credentials) {
                    console.log(`[x402-log][${timestamp}] Credentials Mode: ${init.credentials}`);
                }
                
                // Log payload if it exists
                if (init.body) {
                    try {
                        const bodyContent = init.body instanceof ReadableStream 
                            ? '[ReadableStream]' 
                            : typeof init.body === 'string' 
                                ? init.body
                                : JSON.stringify(init.body);
                        console.log(`[x402-log][${timestamp}] Request Payload:`, bodyContent);
                    } catch (e) {
                        console.log(`[x402-log][${timestamp}] Request Payload: [Unable to stringify payload]`);
                    }
                }
            }
            
            console.log(`[x402-log][${timestamp}] Sending request...`);
            
            // Measure request time
            const startTime = performance.now();
            
            // Convert input to compatible type for paymentFetch
            const fetchInput: string | URL = typeof input === 'string' || input instanceof URL 
                ? input 
                : (input as Request).url;
            
            // Call the payment fetch
            const response = await paymentFetch(fetchInput, init);
            
            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2);
            
            // Log the response details
            console.log(`[x402-log][${timestamp}] Response received in ${duration}ms`);
            console.log(`[x402-log][${timestamp}] Response Status: ${response.status} ${response.statusText}`);
            console.log(`[x402-log][${timestamp}] Response Type: ${response.type}`);
            
            // Fix headers logging - cast headers to iterable for older TS versions
            const headerEntries: [string, string][] = [];
            response.headers.forEach((value, key) => {
                headerEntries.push([key, value]);
            });
            console.log(`[x402-log][${timestamp}] Response Headers:`, Object.fromEntries(headerEntries));
            
            return response;
        };
        
        // Store for later use
        this._paymentFetch = loggedPaymentFetch;
        
        if (!walletClient) {
            throw new Error("PaymentTransport requires a walletClient");
        }

        this._paymentUrl = url;
        this._walletClient = walletClient;
        this._maxPaymentValue = opts.maxPaymentValue ?? BigInt(0.1 * 10 ** 6); // Default to 0.10 USDC
        this._paymentRequirementsSelector = opts.paymentRequirementsSelector ?? selectPaymentRequirements;
        this._customRequestInit = opts.requestInit;

        // Override the send method to use our payment-enabled fetch
        this._overrideSendMethod();
    }

    /**
     * Override the send method to use our payment-enabled fetch
     */
    private _overrideSendMethod() {
        // Store the original _commonHeaders method from parent class
        const originalCommonHeaders = StreamableHTTPClientTransport.prototype['_commonHeaders'];
        
        // Override _commonHeaders to intercept header creation
        StreamableHTTPClientTransport.prototype['_commonHeaders'] = async function(this: StreamableHTTPClientTransport) {
            // Call the original method to get standard headers
            const headers = await originalCommonHeaders.call(this);
            
            // Check if we're in payment mode by looking for payment headers in _customRequestInit
            // @ts-ignore - We're accepting the missing properties for this temporary replacement
            if (this['_customRequestInit']?.headers) {
                // @ts-ignore - We're accepting the missing properties for this temporary replacement
                const customHeaders = this['_customRequestInit'].headers as Record<string, string>;
                if (customHeaders["X-PAYMENT"]) {
                    // Add payment headers to the common headers
                    headers.set("X-PAYMENT", customHeaders["X-PAYMENT"]);
                    headers.set("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
                }
            }
            
            return headers;
        };
        
        // Store the original send method
        const originalSend = this.send.bind(this);
        
        // Replace the send method with our custom implementation
        this.send = async (message: JSONRPCMessage | JSONRPCMessage[], options?: { 
            resumptionToken?: string, 
            onresumptiontoken?: (token: string) => void 
        }): Promise<void> => {
            try {
                // First try the original send method
                return await originalSend(message, options);
            } catch (error) {
                // If we get a 402 error, retry with our payment-enabled fetch
                const errorMessage = String(error);
                if (errorMessage.includes("HTTP 402")) {
                    console.log("[x402] Detected 402 Payment Required, handling payment...");
                    
                    // Handle the payment required response
                    await this._handlePaymentRequired(message, errorMessage, options);
                    return;
                }
                
                // Not a 402 error or payment failed, re-throw
                throw error;
            }
        };
    }

    /**
     * Extract payment requirements from an error message
     */
    private _extractPaymentRequirementsFromError(errorMessage: string): PaymentRequirementsResponse | null {
        try {
            // Find the JSON part in the error message
            const jsonMatch = errorMessage.match(/\{.*\}/s);
            if (!jsonMatch) return null;

            const jsonData = JSON.parse(jsonMatch[0]);
            if (jsonData.x402Version && Array.isArray(jsonData.accepts)) {
                return {
                    x402Version: jsonData.x402Version,
                    accepts: jsonData.accepts,
                    error: jsonData.error
                };
            }

            return null;
        } catch (e) {
            console.error("[x402] Failed to extract payment requirements from error:", e);
            return null;
        }
    }

    /**
     * Handle a 402 Payment Required response by creating and sending a payment header
     */
    private async _handlePaymentRequired(
        message: JSONRPCMessage | JSONRPCMessage[],
        errorMessage: string,
        options?: { resumptionToken?: string, onresumptiontoken?: (token: string) => void }
    ): Promise<void> {
        try {
            // First, try to extract payment requirements from the error message
            let paymentRequirements: PaymentRequirementsResponse;

            // Extract requirements from the error message if possible
            const extractedReqs = this._extractPaymentRequirementsFromError(errorMessage);

            if (extractedReqs) {
                console.log("[x402] Extracted payment requirements from error message");
                paymentRequirements = extractedReqs;
            } else {
                // If extraction failed, fetch requirements from the API endpoint
                console.log("[x402] Fetching payment requirements from endpoint...");
                const response = await fetch(this._paymentUrl.toString(), {
                    method: "OPTIONS",
                    headers: {
                        Accept: "application/json",
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to get payment requirements: ${response.statusText}`);
                }

                paymentRequirements = await response.json() as PaymentRequirementsResponse;
            }

            console.log("[x402] Payment requirements:", paymentRequirements);

            const { x402Version, accepts } = paymentRequirements;

            // Parse requirements with our custom schema instead of the default one
            const parsedPaymentRequirements = accepts.map(req => {
                // Validate and normalize with our custom schema
                const validated = CustomPaymentRequirementsSchema.parse(req);

                // Add default payTo if missing (required by createPaymentHeader)
                if (!validated.payTo) {
                    (validated as any).payTo = validated.asset;
                }

                // Ensure maxTimeoutSeconds is set
                if (validated.maxTimeoutSeconds === undefined) {
                    (validated as any).maxTimeoutSeconds = 60;
                }

                // Cast to the expected PaymentRequirements type
                return validated as unknown as PaymentRequirements;
            });

            // Determine chain ID from wallet client
            const chainId = (this._walletClient as any).chain?.id || 
                           (this._walletClient as any).client?.chain?.id || 
                           84532; // fallback to Base Sepolia

            console.log("[x402] Wallet client chain info:", {
                walletChainId: (this._walletClient as any).chain?.id,
                clientChainId: (this._walletClient as any).client?.chain?.id,
                resolvedChainId: chainId
            });
            console.log("[x402] Using chain ID:", chainId);

            // Select appropriate payment requirements
            const selectedPaymentRequirements = this._paymentRequirementsSelector(
                parsedPaymentRequirements,
                chainId ? ChainIdToNetwork[chainId] : undefined,
                "exact",
            );

            console.log("[x402] Selected payment requirements:", selectedPaymentRequirements);

            // Check if the payment amount exceeds the maximum allowed
            if (BigInt(selectedPaymentRequirements.maxAmountRequired) > this._maxPaymentValue) {
                throw new Error(`Payment amount ${selectedPaymentRequirements.maxAmountRequired} exceeds maximum allowed ${this._maxPaymentValue}`);
            }

            console.log("[x402] Wallet client details:", this._walletClient); 
            console.log("[x402] Selected payment requirements for header creation:", selectedPaymentRequirements);
            console.log("[x402] x402Version:", x402Version);
            
            // Create payment header
            console.log("[x402] Creating payment header...");
            const paymentHeader = await createPaymentHeader(
                this._walletClient,
                x402Version,
                selectedPaymentRequirements,
            );

            console.log("[x402] Payment header created");

            // Create a modified version of the requestInit with payment headers
            const requestInit = this._customRequestInit ? { ...this._customRequestInit } : {};

            if (!requestInit.headers) {
                requestInit.headers = {};
            }

            // Add payment headers
            const headers = requestInit.headers as Record<string, string>;
            headers["X-PAYMENT"] = paymentHeader;
            headers["Access-Control-Expose-Headers"] = "X-PAYMENT-RESPONSE";

            // Instead of creating a new transport, modify the current one's request headers
            // and retry the request
            console.log("[x402] Retrying request with payment header");
            
            // Store original requestInit
            const originalRequestInit = this._customRequestInit;
            
            try {
                // Temporarily set the requestInit with payment headers
                this._customRequestInit = requestInit;
                
                // Retry the request with the same transport instance
                await super.send(message, options);
                console.log("[x402] Payment successful");
            } finally {
                // Restore original requestInit
                this._customRequestInit = originalRequestInit;
            }
        } catch (error) {
            console.error("[x402] Payment error:", error);
            this.onerror?.(error as Error);
            throw error;
        }
    }
}

/**
 * Creates a PaymentTransport instance that automatically handles 402 Payment Required responses
 * by creating and sending payment headers using the x402 payment protocol.
 */
export function createPaymentTransport(
    url: URL,
    walletClient: typeof evm.SignerWallet | Account,
    options?: Omit<PaymentTransportOptions, 'walletClient'>
): PaymentTransport {
    return new PaymentTransport(url, walletClient, options || {});
}
