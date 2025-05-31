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
// import { config } from "dotenv";
import { exact } from "x402/schemes";
import { settleResponseHeader } from 'x402/types';
// TODO: Import these when payment functionality is ready
// import { createExactPaymentRequirements, settle, verifyPayment, x402Version } from '../payments';
// import { withTransaction, txOperations } from '../db/actions';

// config();

export const runtime = 'nodejs'

const app = new Hono();

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
const forwardRequest = async (c: Context, id?: string) => {
    let targetUpstream = DEFAULT_UPSTREAM;
    let authHeaders: Record<string, unknown> | undefined = undefined;

    if(id){
        // TODO: Replace with actual DB call
        // const mcpConfig = await withTransaction(async (tx) => {
        //     return await txOperations.internal_getMcpServerByServerId(id)(tx);
        // });
        const mcpConfig = {} as any;

        const mcpOrigin = mcpConfig.origin;
        if(mcpOrigin){
            targetUpstream = new URL(mcpOrigin);
        }

        if(mcpConfig.authHeaders && mcpConfig.requireAuth){
            authHeaders = mcpConfig.authHeaders as Record<string, unknown>;
        }
    }

    const url = new URL(c.req.url);
    url.host = targetUpstream.host;
    url.protocol = targetUpstream.protocol;

    // Remove ID from path when forwarding to upstream
    const pathWithoutId = url.pathname.replace(/^\/mcp\/[^\/]+/, '')
    url.pathname = targetUpstream.pathname + (pathWithoutId || '')

    const headers = c.req.raw.headers;

    headers.forEach((v, k) => {
        if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v)
    })

    headers.set('host', targetUpstream.host);

    if(authHeaders){
        for(const [key, value] of Object.entries(authHeaders)){
            headers.set(key, value as string);
        }
    }

    const response = await fetch(url.toString(), {
        method: c.req.raw.method,
        headers,
        body: c.req.raw.body,
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
const inspectRequest = async (c: Context): Promise<{ toolCall?: { name: string, args: any, isPaid: boolean, payment?: any, id?: string, toolId?: string, serverId?: string } }> => {
    const rawRequest = c.req.raw;
    
    let toolCall = undefined;

    if(rawRequest.method === 'POST' && rawRequest.body){
        try {
            const clonedRequest = rawRequest.clone();
            const contentType = rawRequest.headers.get("content-type") || '';

            const urlPathMatch = new URL(rawRequest.url).pathname.match(/^\/mcp\/([^\/]+)/);
            const id = urlPathMatch ? urlPathMatch[1] : undefined;

            const reader = clonedRequest.body?.getReader();

            if(!reader){
                throw new Error('No reader found');
            }

            if(reader){
                let chunks = [];
                let totalSize = 0;

                while(true){
                    const { done, value } = await reader.read();

                    if(done){
                        break;
                    }

                    totalSize += value.length;
                    // Only collect a reasonable amount to avoid memory issues
                    if (chunks.length < 5) {
                        chunks.push(value);
                    }
                }
                if (chunks.length > 0 && contentType.includes('application/json')) {
                    try {
                        // Try to parse the first chunk as JSON for logging
                        const decoder = new TextDecoder();
                        const jsonText = decoder.decode(chunks[0]);
                        const jsonData = JSON.parse(jsonText);
                        console.log('\x1b[36m%s\x1b[0m', `[${new Date().toISOString()}] First chunk as JSON:`, JSON.stringify(jsonData, null, 2));

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
                                // TODO: Look up tool in database by name and server ID
                                // const server = await withTransaction(async (tx) => {
                                //     return await txOperations.internal_getMcpServerByServerId(id)(tx);
                                // });
                                const server = { id: id };
                                
                                if (server) {
                                    // Store the internal server ID for later use
                                    serverId = server.id;
                                    console.log(`[${new Date().toISOString()}] Found server with internal ID: ${serverId}`);
                                
                                    // TODO: there can be multiple tools with the same name, we need to find the correct one
                                    // const tools = await withTransaction(async (tx) => {
                                    //     return await txOperations.listMcpToolsByServer(server.id)(tx);
                                    // });
                                    const tools = [] as any[];
                                    
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
                        console.log('\x1b[33m%s\x1b[0m', `[${new Date().toISOString()}] First chunk couldn't be parsed as JSON`);
                    }
                }
            }
        }
        catch(e){
            console.error('\x1b[31m%s\x1b[0m', `[${new Date().toISOString()}] Error logging request payload:`, e);
        }
    }

    return { toolCall };
}

// Helper function to get or create user from wallet address
async function getOrCreateUser(walletAddress: string): Promise<User | null> {
    if (!walletAddress) return null;
    
    // TODO: Replace with actual DB call
    // return await withTransaction(async (tx) => {
    //     let user = await txOperations.getUserByWalletAddress(walletAddress)(tx);
    //     
    //     if (!user) {
    //         console.log(`[${new Date().toISOString()}] Creating new user with wallet ${walletAddress}`);
    //         user = await txOperations.createUser({
    //             walletAddress,
    //             displayName: `User_${walletAddress.substring(0, 8)}`
    //         })(tx);
    //     } else {
    //         // Update last login
    //         await txOperations.updateUserLastLogin(user.id)(tx);
    //     }
    //     
    //     return user as User;
    // });
    
    return {
        id: `user_${walletAddress.substring(0, 8)}`,
        walletAddress,
        displayName: `User_${walletAddress.substring(0, 8)}`
    };
}

// Helper function to ensure non-undefined values for database operations
function ensureString(value: string | undefined, fallback: string = 'unknown'): string {
    return value !== undefined ? value : fallback;
}

verbs.forEach(verb => {
    app[verb](`/mcp/:id/*`, async (c) => {
        const id = c.req.param('id');
        console.log(`[${new Date().toISOString()}] Handling ${verb.toUpperCase()} request to ${c.req.url} with ID: ${id}`)

        const startTime = Date.now();
        const { toolCall } = await inspectRequest(c)
        console.log(`[${new Date().toISOString()}] Request payload logged, toolCall: ${toolCall ? 'present' : 'not present'}`)

        // No user yet - will be set from payment verification if available
        let user: User | null = null;
        
        if (toolCall && toolCall.isPaid && toolCall.toolId) {
            console.log(`[${new Date().toISOString()}] Paid tool call detected: ${toolCall.name}`)
            console.log(`[${new Date().toISOString()}] Payment details: ${JSON.stringify(toolCall.payment, null, 2)}`)

            // TODO: Implement payment requirements
            // const paymentRequirements = [
            //     createExactPaymentRequirements(
            //         toolCall.payment.maxAmountRequired,
            //         toolCall.payment.network,
            //         toolCall.payment.resource,
            //         toolCall.payment.description,
            //         toolCall.payment.payTo
            //     ),
            // ];
            const paymentRequirements: any[] = [];
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
            
            // TODO: Implement payment verification
            // const isPaymentValid = await verifyPayment(c, paymentRequirements)
            const isPaymentValid = false;
            console.log(`[${new Date().toISOString()}] Payment verification result: ${JSON.stringify(isPaymentValid, null, 2)}`)

            if (!isPaymentValid) {
                console.log(`[${new Date().toISOString()}] Payment verification failed, returning early`)
                
                // TODO: Record failed payment attempt in analytics
                // if (toolCall.toolId && toolCall.serverId) {
                //     await withTransaction(async (tx) => {
                //         // Record tool usage with error status
                //         await txOperations.recordToolUsage({
                //             toolId: ensureString(toolCall.toolId),
                //             userId: user?.id,
                //             responseStatus: 'payment_failed',
                //             executionTimeMs: Date.now() - startTime,
                //             ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
                //             userAgent: c.req.header('user-agent'),
                //             requestData: {
                //                 toolName: toolCall.name,
                //                 args: toolCall.args
                //             }
                //         })(tx);
                //     });
                // }
                
                c.status(402);
                return c.json({
                    // x402Version,
                    error: "Payment verification failed",
                    accepts: paymentRequirements,
                });
            }

            // TODO: Implement payment processing
            console.log(`[${new Date().toISOString()}] Payment processing not yet implemented`)
        }

        // For non-paid requests, try to get wallet address from header as fallback
        if (!user) {
            const walletAddress = c.req.header('X-Wallet-Address');
            if (walletAddress) {
                user = await getOrCreateUser(walletAddress);
            }
        }

        console.log(`[${new Date().toISOString()}] Forwarding request to upstream with ID: ${id}`)
        const upstream = await forwardRequest(c, id)
        console.log(`[${new Date().toISOString()}] Received upstream response, mirroring back to client`)
        
        // TODO: Record tool usage if we have tool information
        // if (toolCall && toolCall.toolId && toolCall.serverId) {
        //     await withTransaction(async (tx) => {
        //         // Record tool usage
        //         await txOperations.recordToolUsage({
        //             toolId: ensureString(toolCall.toolId),
        //             userId: user?.id,
        //             responseStatus: upstream.status.toString(),
        //             executionTimeMs: Date.now() - startTime,
        //             ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        //             userAgent: c.req.header('user-agent'),
        //             requestData: {
        //                 toolName: toolCall.name,
        //                 args: toolCall.args
        //             }
        //         })(tx);
        //     });
        // }
        
        return mirrorRequest(upstream)
    })

    app[verb](`/mcp/:id`, async (c) => {
        const id = c.req.param('id');

        return c.json({
            message: `Hello, ${id}!`
        })
    })
})

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
