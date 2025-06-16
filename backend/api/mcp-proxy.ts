/**
 * Proxy for MCPay.fun API
 * 
 * This module is used to proxy requests to the MCPay.fun API.
 * It is used to bypass CORS restrictions and to add authentication to the requests.
 * 
 * It is also used to add a layer of caching to the requests.
 * 
 * It is also used to add a layer of error handling to the requests.
 */

import { type Context, Hono } from "hono";
import { cors } from 'hono/cors';
import { exact } from "x402/schemes";
import { settleResponseHeader } from 'x402/types';
import { createExactPaymentRequirements, settle, verifyPayment, x402Version } from "../lib/payments.js"
import { txOperations } from "../db/actions.js";
import { withTransaction } from "../db/actions.js";

export const runtime = 'nodejs'

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
    origin: '*', // Allow all origins
    allowHeaders: ['*'], // Allow all headers
    allowMethods: ['*'], // Allow all methods
    exposeHeaders: ['*'], // Expose all headers
    maxAge: 86400, // Cache preflight requests for 24 hours
    credentials: true // Allow credentials
}));

// Define a User type based on what we expect from the database
type User = {
    id: string;
    walletAddress: string;
    displayName?: string;
    email?: string;
    [key: string]: any; // Allow for additional properties
};

// Headers that must NOT be forwarded (RFC‑7230 §6.1)
const HOP_BY_HOP = new Set([
    'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade'
])

const DEFAULT_UPSTREAM = new URL(process.env.MCP_TARGET ?? 'http://localhost:3050/stream');

const verbs = ["post", "get", "delete"] as const;

/**
 * Copies a client request to the upstream, returning the upstream Response.
 * Works for POST, GET, DELETE – anything the MCP spec allows.
 */
const forwardRequest = async (c: Context, id?: string, body?: ArrayBuffer) => {
    let targetUpstream = DEFAULT_UPSTREAM;
    let authHeaders: Record<string, unknown> | undefined = undefined;

    if (id) {
        const mcpConfig = await withTransaction(async (tx) => {
            return await txOperations.internal_getMcpServerByServerId(id)(tx);
        });

        const mcpOrigin = mcpConfig?.mcpOrigin;
        if (mcpOrigin) {
            targetUpstream = new URL(mcpOrigin);
        }

        if (mcpConfig?.authHeaders && mcpConfig?.requireAuth) {
            authHeaders = mcpConfig.authHeaders as Record<string, unknown>;
        }
    }

    const url = new URL(c.req.url);
    url.host = targetUpstream.host;
    url.protocol = targetUpstream.protocol;

    // Remove /mcp/:id from path when forwarding to upstream, keeping everything after /:id
    const pathWithoutId = url.pathname.replace(/^\/mcp\/[^\/]+/, '')
    url.pathname = targetUpstream.pathname + (pathWithoutId || '')

    // Preserve all query parameters from the original mcpOrigin
    if (targetUpstream.search) {
        // Copy all query parameters from the target upstream (mcpOrigin)
        const targetParams = new URLSearchParams(targetUpstream.search);
        targetParams.forEach((value, key) => {
            url.searchParams.set(key, value);
        });
    }

    const headers = c.req.raw.headers;

    headers.forEach((v, k) => {
        if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v)
    })

    headers.set('host', targetUpstream.host);

    if (authHeaders) {
        for (const [key, value] of Object.entries(authHeaders)) {
            headers.set(key, value as string);
        }
    }

    const response = await fetch(url.toString(), {
        method: c.req.raw.method,
        headers,
        body: body || (c.req.raw.method !== 'GET' ? c.req.raw.body : undefined),
        duplex: 'half'
    })

    return response;
}

/**
 * Mirrors the upstream response to the client.
 */
const mirrorRequest = (res: Response) => {
    const headers = new Headers();

    res.headers.forEach((v, k) => {
        headers.set(k, v);
    })

    return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers
    })
}

// Helper function to inspect request payload for streamable HTTP requests and identify tool calls
const inspectRequest = async (c: Context): Promise<{ toolCall?: { name: string, args: any, isPaid: boolean, payment?: any, id?: string, toolId?: string, serverId?: string }, body?: ArrayBuffer }> => {
    const rawRequest = c.req.raw;

    let toolCall = undefined;
    let body = undefined;

    if (rawRequest.method === 'POST' && rawRequest.body) {
        try {
            const clonedRequest = rawRequest.clone();
            const contentType = rawRequest.headers.get("content-type") || '';

            // Parse /mcp/:id format and extract what comes after /:id
            const urlPathMatch = new URL(rawRequest.url).pathname.match(/^\/mcp\/([^\/]+)/);
            const id = urlPathMatch ? urlPathMatch[1] : undefined;

            // Read the entire body as ArrayBuffer to avoid stream locking issues
            body = await clonedRequest.arrayBuffer();

            if (body && contentType.includes('application/json')) {
                try {
                    // Try to parse as JSON for logging
                    const decoder = new TextDecoder();
                    const jsonText = decoder.decode(body);
                    const jsonData = JSON.parse(jsonText);
                    console.log('\x1b[36m%s\x1b[0m', `[${new Date().toISOString()}] Request JSON:`, JSON.stringify(jsonData, null, 2));

                    // Extract and log tool call information if present
                    if (jsonData.method === 'tools/call' && jsonData.params) {
                        const toolName = jsonData.params.name;
                        const toolArgs = jsonData.params.arguments;

                        // Check if this is a paid tool by looking up in DB
                        let isPaid = false;
                        let paymentDetails = undefined;
                        let toolId = undefined;
                        let serverId = undefined;

                        if (id) {
                            const server = await withTransaction(async (tx) => {
                                return await txOperations.internal_getMcpServerByServerId(id)(tx);
                            });

                            if (server) {
                                // Store the internal server ID for later use
                                serverId = server.id;
                                console.log(`[${new Date().toISOString()}] Found server with internal ID: ${serverId}`);

                                const tools = await withTransaction(async (tx) => {
                                    return await txOperations.listMcpToolsByServer(server.id)(tx);
                                });

                                const toolConfig = tools.find((t: any) => t.name === toolName);

                                console.log(`[${new Date().toISOString()}] ---Tool Config: ${JSON.stringify(toolConfig, null, 2)}`)

                                if (toolConfig) {
                                    toolId = toolConfig.id;

                                    if (toolConfig.isMonetized && toolConfig.payment) {
                                        isPaid = true;
                                        paymentDetails = toolConfig.payment;
                                        console.log('\x1b[33m%s\x1b[0m', `[${new Date().toISOString()}] Paid tool identified:`);
                                        console.log('\x1b[33m%s\x1b[0m', `  Payment details: ${JSON.stringify(paymentDetails, null, 2)}`);
                                    }
                                }
                            }
                        }

                        console.log(`[${new Date().toISOString()}] ---Tool ID: ${toolId}`)

                        // Store tool call info to return
                        toolCall = {
                            name: toolName,
                            args: toolArgs,
                            isPaid,
                            ...(paymentDetails && { payment: paymentDetails }),
                            ...(id && { id: id }),
                            ...(toolId && { toolId }),
                            ...(serverId && { serverId })
                        };

                        if (jsonData.params._meta) {
                            console.log('\x1b[32m%s\x1b[0m', `  Meta: ${JSON.stringify(jsonData.params._meta, null, 2)}`);
                        }
                    }
                } catch (e) {
                    console.log('\x1b[33m%s\x1b[0m', `[${new Date().toISOString()}] Request body couldn't be parsed as JSON`);
                }
            }
        }
        catch (e) {
            console.error('\x1b[31m%s\x1b[0m', `[${new Date().toISOString()}] Error logging request payload:`, e);
        }
    }

    return { toolCall, body };
}

// Helper function to get or create user from wallet address
async function getOrCreateUser(walletAddress: string): Promise<User | null> {
    if (!walletAddress) return null;

    return await withTransaction(async (tx) => {
        let user = await txOperations.getUserByWalletAddress(walletAddress)(tx);
        
        if (!user) {
            console.log(`[${new Date().toISOString()}] Creating new user with wallet ${walletAddress}`);
            user = await txOperations.createUser({
                walletAddress,
                displayName: `User_${walletAddress.substring(0, 8)}`
            })(tx);
        } else {
            // Update last login
            await txOperations.updateUserLastLogin(user.id)(tx);
        }
        
        return user as User;
    });
}

// Helper function to ensure non-undefined values for database operations
function ensureString(value: string | undefined, fallback: string = 'unknown'): string {
    return value !== undefined ? value : fallback;
}

verbs.forEach(verb => {
    app[verb](`/:id/*`, async (c) => {
        const id = c.req.param('id');
        console.log(`[${new Date().toISOString()}] Handling ${verb.toUpperCase()} request to ${c.req.url} with ID: ${id}`)

        const startTime = Date.now();
        const { toolCall, body } = await inspectRequest(c)
        console.log(`[${new Date().toISOString()}] Request payload logged, toolCall: ${toolCall ? 'present' : 'not present'}`)

        // No user yet - will be set from payment verification if available
        let user: User | null = null;

        if (toolCall && toolCall.isPaid && toolCall.toolId) {
            console.log(`[${new Date().toISOString()}] Paid tool call detected: ${toolCall.name}`)
            console.log(`[${new Date().toISOString()}] Payment details: ${JSON.stringify(toolCall.payment, null, 2)}`)

            // Ensure payTo field exists, default to asset address if missing
            const payTo = toolCall.payment.payTo || toolCall.payment.asset;
            
            const paymentRequirements = [
                createExactPaymentRequirements(
                    toolCall.payment.maxAmountRequired,
                    toolCall.payment.network,
                    toolCall.payment.resource,
                    toolCall.payment.description,
                    payTo
                ),
            ];
            console.log(`[${new Date().toISOString()}] Created payment requirements: ${JSON.stringify(paymentRequirements, null, 2)}`)

            // Get the payment header before verification to extract payer information
            const paymentHeader = c.req.header("X-PAYMENT");
            let payerAddress = '';

            if (paymentHeader) {
                try {
                    const decodedPayment = exact.evm.decodePayment(paymentHeader);
                    // Extract the payer address from decoded payment
                    payerAddress = decodedPayment.payload.authorization.from;
                    console.log(`[${new Date().toISOString()}] Extracted payer address from payment: ${payerAddress}`);

                    // Get or create user with the payer address
                    if (payerAddress) {
                        user = await getOrCreateUser(payerAddress);
                        console.log(`[${new Date().toISOString()}] User identified: ${user?.id || 'unknown'}`);
                    }
                } catch (e) {
                    console.error(`[${new Date().toISOString()}] Error extracting payer from payment:`, e);
                }
            }

            const isPaymentValid = await verifyPayment(c, paymentRequirements)
            console.log(`[${new Date().toISOString()}] Payment verification result: ${JSON.stringify(isPaymentValid, null, 2)}`)

            if (!isPaymentValid) {
                console.log(`[${new Date().toISOString()}] Payment verification failed, returning early`)

                // Record failed payment attempt in analytics
                if (toolCall.toolId && toolCall.serverId) {
                    await withTransaction(async (tx) => {
                        // Record tool usage with error status
                        await txOperations.recordToolUsage({
                            toolId: ensureString(toolCall.toolId),
                            userId: user?.id,
                            responseStatus: 'payment_failed',
                            executionTimeMs: Date.now() - startTime,
                            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
                            userAgent: c.req.header('user-agent'),
                            requestData: {
                                toolName: toolCall.name,
                                args: toolCall.args
                            },
                            result: {
                                error: "Payment verification failed",
                                status: "payment_failed"
                            }
                        })(tx);
                        
                        // Update daily analytics using internal server ID
                        const today = new Date();
                        await txOperations.updateOrCreateDailyAnalytics(
                            ensureString(toolCall.serverId),
                            today,
                            {
                                totalRequests: 1,
                                errorCount: 1,
                                userId: user?.id,
                                avgResponseTime: Date.now() - startTime,
                                toolUsage: { 
                                    [ensureString(toolCall.toolId)]: 1 
                                }
                            }
                        )(tx);
                    });
                }

                c.status(402);
                return c.json({
                    x402Version,
                    error: "Payment verification failed",
                    accepts: paymentRequirements,
                });
            }

            try {
                const payment = c.req.header("X-PAYMENT");
                if (!payment) {
                    console.log(`[${new Date().toISOString()}] No X-PAYMENT header found, returning early`)
                    c.status(402);
                    return c.json({
                        x402Version,
                        error: "No payment found in X-PAYMENT header",
                        accepts: paymentRequirements,
                    });
                }

                const decodedPayment = exact.evm.decodePayment(payment);
                const paymentRequirement = paymentRequirements[0];

                if (!paymentRequirement) {
                    console.log(`[${new Date().toISOString()}] No payment requirement available for settlement`)
                    c.status(402);
                    return c.json({
                        x402Version,
                        error: "No payment requirement available for settlement",
                        accepts: paymentRequirements,
                    });
                }

                console.log(`[${new Date().toISOString()}] About to settle payment with:`)
                console.log(`[${new Date().toISOString()}] - Decoded payment: ${JSON.stringify(decodedPayment, null, 2)}`)
                console.log(`[${new Date().toISOString()}] - Payment requirement: ${JSON.stringify(paymentRequirement, null, 2)}`)

                let settleResponse;
                try {
                    settleResponse = await settle(
                        decodedPayment,
                        paymentRequirement
                    );
                    console.log(`[${new Date().toISOString()}] Settlement successful: ${JSON.stringify(settleResponse, null, 2)}`)
                } catch (settleError) {
                    console.error(`[${new Date().toISOString()}] Settlement failed:`, settleError)
                    console.error(`[${new Date().toISOString()}] Settlement error details:`, {
                        message: settleError instanceof Error ? settleError.message : String(settleError),
                        stack: settleError instanceof Error ? settleError.stack : undefined
                    })
                    throw settleError; // Re-throw to be caught by the outer try-catch
                }

                if (settleResponse.success === false) {
                    console.log(`[${new Date().toISOString()}] Settlement returned success=false: ${settleResponse.errorReason}`)
                    c.status(402);
                    return c.json({
                        x402Version,
                        error: settleResponse.errorReason,
                        accepts: paymentRequirements,
                    });
                }

                // Record successful payment in database
                if (toolCall.toolId && toolCall.serverId) {
                    await withTransaction(async (tx) => {
                        // Create payment record
                        const paymentRecord = await txOperations.createPayment({
                            toolId: ensureString(toolCall.toolId),
                            userId: user?.id,
                            amount: (paymentRequirement as any).amount || toolCall.payment.maxAmountRequired,
                            currency: paymentRequirement.asset,
                            network: paymentRequirement.network,
                            transactionHash: settleResponse.transaction || `unknown-${Date.now()}`,
                            status: 'completed',
                            signature: payment,
                            paymentData: {
                                decodedPayment,
                                settleResponse
                            }
                        })(tx);
                        
                        console.log(`[${new Date().toISOString()}] Payment recorded with ID: ${paymentRecord.id}`);
                    });
                }

                const responseHeader = settleResponseHeader(settleResponse);
                console.log(`[${new Date().toISOString()}] Setting X-PAYMENT-RESPONSE header: ${responseHeader}`)
                c.header("X-PAYMENT-RESPONSE", responseHeader);

                console.log(`[${new Date().toISOString()}] Forwarding request to upstream with ID: ${id}`)
                const upstream = await forwardRequest(c, id, body)
                console.log(`[${new Date().toISOString()}] Received upstream response, mirroring back to client`)

                // Capture response data for logging
                let responseData: Record<string, unknown> | undefined;
                try {
                    const clonedResponse = upstream.clone();
                    const responseText = await clonedResponse.text();
                    if (responseText) {
                        try {
                            responseData = JSON.parse(responseText);
                        } catch {
                            responseData = { response: responseText };
                        }
                    }
                } catch (e) {
                    console.log(`[${new Date().toISOString()}] Could not capture response data:`, e);
                }

                // Record successful tool usage in database
                if (toolCall.toolId && toolCall.serverId) {
                    await withTransaction(async (tx) => {
                        // Record tool usage
                        await txOperations.recordToolUsage({
                            toolId: ensureString(toolCall.toolId),
                            userId: user?.id,
                            responseStatus: upstream.status.toString(),
                            executionTimeMs: Date.now() - startTime,
                            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
                            userAgent: c.req.header('user-agent'),
                            requestData: {
                                toolName: toolCall.name,
                                args: toolCall.args
                            },
                            result: responseData
                        })(tx);
                        
                        // Update daily analytics using internal server ID
                        const today = new Date();
                        await txOperations.updateOrCreateDailyAnalytics(
                            ensureString(toolCall.serverId),
                            today,
                            {
                                totalRequests: 1,
                                totalRevenue: parseFloat((paymentRequirement as any).amount || toolCall.payment.maxAmountRequired),
                                userId: user?.id,
                                avgResponseTime: Date.now() - startTime,
                                toolUsage: { 
                                    [ensureString(toolCall.toolId)]: 1 
                                }
                            }
                        )(tx);
                    });
                }

                return mirrorRequest(upstream)
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error during payment processing:`, error)
                c.status(500)
                return c.json({
                    error: "Internal server error during payment processing"
                })
            }

        }

        // For non-paid requests, try to get wallet address from header as fallback
        if (!user) {
            const walletAddress = c.req.header('X-Wallet-Address');
            if (walletAddress) {
                user = await getOrCreateUser(walletAddress);
            }
        }

        console.log(`[${new Date().toISOString()}] Forwarding request to upstream with ID: ${id}`)
        const upstream = await forwardRequest(c, id, body)
        console.log(`[${new Date().toISOString()}] Received upstream response, mirroring back to client`)

        // Capture response data for logging
        let responseData: Record<string, unknown> | undefined;
        if (toolCall && toolCall.toolId && toolCall.serverId) {
            try {
                const clonedResponse = upstream.clone();
                const responseText = await clonedResponse.text();
                if (responseText) {
                    try {
                        responseData = JSON.parse(responseText);
                    } catch {
                        responseData = { response: responseText };
                    }
                }
            } catch (e) {
                console.log(`[${new Date().toISOString()}] Could not capture response data:`, e);
            }
        }

        // Record tool usage if we have tool information
        if (toolCall && toolCall.toolId && toolCall.serverId) {
            await withTransaction(async (tx) => {
                // Record tool usage
                await txOperations.recordToolUsage({
                    toolId: ensureString(toolCall.toolId),
                    userId: user?.id,
                    responseStatus: upstream.status.toString(),
                    executionTimeMs: Date.now() - startTime,
                    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
                    userAgent: c.req.header('user-agent'),
                    requestData: {
                        toolName: toolCall.name,
                        args: toolCall.args
                    },
                    result: responseData
                })(tx);
                
                // Update daily analytics using internal server ID
                const today = new Date();
                await txOperations.updateOrCreateDailyAnalytics(
                    ensureString(toolCall.serverId),
                    today,
                    {
                        totalRequests: 1,
                        userId: user?.id,
                        avgResponseTime: Date.now() - startTime,
                        toolUsage: { 
                            [ensureString(toolCall.toolId)]: 1 
                        }
                    }
                )(tx);
            });
        }

        return mirrorRequest(upstream)
    })
})

export default app;