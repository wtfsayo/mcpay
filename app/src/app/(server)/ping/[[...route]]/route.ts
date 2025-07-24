// Enhanced ping service that registers MCP servers automatically with payment information

import { extractApiKeyFromHeaders, hashApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { mcpTools } from "@/lib/gateway/db/schema";
import { getMcpServerInfo, getMcpToolsWithPayments, validatePaymentInfo } from "@/lib/gateway/inspect-mcp";
import { PricingEntry } from "@/types";
import { Hono, type Context, type Next } from "hono";
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { randomUUID } from "node:crypto";

export const runtime = 'nodejs'

// List of blocked URL origins that are not allowed to be registered
const BLOCKED_ORIGINS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    // Add more blocked origins as needed
    // maybe the vercel sandbox
];

/**
 * Check if a URL origin is blocked
 * @param url - The URL to check
 * @returns true if the origin is blocked, false otherwise
 */
function isOriginBlocked(url: string): boolean {
    // Only apply blocked origins in actual production environment
    // On Vercel: VERCEL_ENV can be 'production', 'preview', or 'development'
    // We only want to block origins in actual production, not preview deployments
    const isVercelProduction = process.env.VERCEL_ENV === 'production';
    const isNodeProduction = process.env.NODE_ENV === 'production';
    const isActualProduction = isVercelProduction || (isNodeProduction && !process.env.VERCEL_ENV);
    
    if (!isActualProduction) {
        return false;
    }

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Check against blocked origins list
        return BLOCKED_ORIGINS.some(blockedOrigin => {
            const normalizedBlocked = blockedOrigin.toLowerCase();
            
            // Exact match
            if (hostname === normalizedBlocked) {
                return true;
            }
            
            // Subdomain match (e.g. blocked: example.com, url: sub.example.com)
            if (hostname.endsWith(`.${normalizedBlocked}`)) {
                return true;
            }
            
            return false;
        });
    } catch (error) {
        // If URL parsing fails, consider it blocked for security (only in production)
        console.warn('Failed to parse URL for origin check:', url, error);
        return true;
    }
}

// Define user type that matches what we get from API key validation
type ApiKeyUser = {
    id: string;
    name: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    image: string | null;
};

// Define extended context type for ping middleware with API key info
type PingAppContext = {
    Variables: {
        user: ApiKeyUser;
        apiKeyInfo?: {
            id: string;
            userId: string;
            keyHash: string;
            name: string;
            permissions: string[];
            createdAt: Date;
            expiresAt: Date | null;
            lastUsedAt: Date | null;
            active: boolean;
        };
    };
};

const app = new Hono<PingAppContext>({
    strict: false,
}).basePath('/ping')

// Add CORS middleware to handle cross-origin requests
app.use('*', cors({
    origin: '*', // You might want to restrict this to your domain in production
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}))

// Add error handling middleware
app.onError((err, c) => {
    console.error('Ping route error:', err)
    return c.json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        service: 'mcpay-ping'
    }, 500)
})

// API key authentication middleware for ping requests
const pingAuthMiddleware = async (c: Context<PingAppContext>, next: Next) => {
    try {
        // Extract API key from headers
        const apiKey = extractApiKeyFromHeaders(c.req.raw.headers);

        if (!apiKey) {
            return c.json({
                status: 'error',
                message: 'API key required. Please provide a valid API key in X-API-KEY header or Authorization: Bearer header.',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 401);
        }

        // Validate API key
        const keyHash = hashApiKey(apiKey);
        const apiKeyResult = await withTransaction(async (tx) => {
            return await txOperations.validateApiKey(keyHash)(tx);
        });

        if (!apiKeyResult?.user) {
            return c.json({
                status: 'error',
                message: 'Invalid or expired API key.',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 401);
        }

        console.log(`[${new Date().toISOString()}] User authenticated via API key: ${apiKeyResult.user.id}`);

        // Add user to context with proper typing
        c.set('user', apiKeyResult.user);
        // Store API key info in context
        c.set('apiKeyInfo', apiKeyResult.apiKey);

        await next();
    } catch (error) {
        console.error('Ping auth middleware error:', error);
        return c.json({
            status: 'error',
            message: 'Authentication failed',
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping'
        }, 401);
    }
};

app.post('/', pingAuthMiddleware, async (c) => {
    try {
        console.log('Enhanced ping received');
        const user = c.get('user');
        if (!user) {
            return c.json({
                status: 'error',
                message: 'User not found in context',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 401);
        }
        const body = await c.req.json();

        console.log('Ping payload:', body);

        const {
            detectedUrls,
            receiverAddress,
            requireAuth = false,
            authHeaders
        } = body;

        if (!detectedUrls || !Array.isArray(detectedUrls) || detectedUrls.length === 0) {
            return c.json({
                status: 'error',
                message: 'No detected URLs provided',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 400);
        }

        // Check if any of the detected URLs have blocked origins
        const blockedUrls = detectedUrls.filter(url => isOriginBlocked(url));
        if (blockedUrls.length > 0) {
            console.warn('Blocked origin detected:', blockedUrls[0]);
            return c.json({
                status: 'error',
                message: 'Origin is blocked and cannot be registered',
                blockedOrigin: blockedUrls[0],
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 403);
        }

        // Set proper headers to prevent caching and ensure fresh responses
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        c.header('Pragma', 'no-cache');
        c.header('Expires', '0');
        c.header('Content-Type', 'application/json');

        const mcpUrl = new URL(`${detectedUrls[0]}/mcp`);
        console.log('Connecting to MCP server at:', mcpUrl.toString());

        // Get user's primary wallet address for receiverAddress fallback
        let userWalletAddress: string | null = null;
        try {
            const userWallets = await withTransaction(async (tx) => {
                return await tx.query.userWallets.findMany({
                    where: (userWallets, { eq, and }) => and(
                        eq(userWallets.userId, user.id),
                        eq(userWallets.isActive, true)
                    ),
                    orderBy: (userWallets, { desc }) => [desc(userWallets.isPrimary), desc(userWallets.createdAt)],
                    limit: 1
                });
            });

            console.log('User wallets:', userWallets);

            userWalletAddress = userWallets[0]?.walletAddress || null;
        } catch (error) {
            console.warn('Failed to get user wallet address:', error);
        }

        const serverInfo = await getMcpServerInfo(mcpUrl.toString(), userWalletAddress || receiverAddress || '0x0000000000000000000000000000000000000000');

        // Extract tools with payment information
        let toolsWithPricing;
        try {
            // FIX THIS: receiverAddress is not always set
            toolsWithPricing = serverInfo.tools;
            console.log(`Found ${toolsWithPricing.length} tools, ${toolsWithPricing.filter(t => t.pricing).length} with pricing info`);
        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            return c.json({
                status: 'error',
                message: 'Failed to connect to MCP server',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 400);
        }

        // Log payment information for debugging
        toolsWithPricing.forEach(tool => {
            if (tool.pricing) {
                tool.pricing.forEach(pricing => {
                    console.log(`Tool ${tool.name} pricing info:`, pricing);
                    const isValid = validatePaymentInfo(pricing);
                    console.log(`Payment info valid: ${isValid}`);
                });
            }
        });

        // Auto-register or update server using atomic upsert to prevent race conditions
        const serverResult = await withTransaction(async (tx) => {
            try {
                // Use upsert operation to handle race conditions gracefully
                const upsertResult = await txOperations.upsertServerByOrigin({
                    serverId: randomUUID(),
                    mcpOrigin: mcpUrl.toString(), // Use raw URL as provided
                    creatorId: user.id,
                    receiverAddress: receiverAddress || userWalletAddress || '0x0000000000000000000000000000000000000000',
                    requireAuth,
                    authHeaders,
                    name: serverInfo.metadata.name || 'Auto-registered Server',
                    description: 'Server registered via ping',
                    metadata: {
                        registeredFromPing: true,
                        timestamp: new Date().toISOString(),
                        toolsCount: toolsWithPricing.length,
                        monetizedToolsCount: toolsWithPricing.filter(t => t.pricing).length,
                    }
                })(tx);

                if (upsertResult.isNew) {
                    console.log('Created new server:', upsertResult.server.id);
                    
                    // Create tools for new server
                    const toolResults = [];
                    for (const tool of toolsWithPricing) {
                        const newTool = await tx.insert(mcpTools).values({
                            serverId: upsertResult.server.id,
                            name: tool.name,
                            description: tool.description || `Access to ${tool.name}`,
                            inputSchema: tool.inputSchema || {},
                            isMonetized: !!tool.pricing && tool.pricing.some((p: PricingEntry) => p.active === true),
                            pricing: tool.pricing,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }).returning();
                        
                        toolResults.push(newTool[0]);
                    }
                    
                    return {
                        server: upsertResult.server,
                        tools: toolResults,
                        isNew: true
                    };
                } else {
                    console.log('Updating existing server:', upsertResult.server.id);
                    
                    // Update existing server with tools
                    const updateResult = await txOperations.updateServerFromPing(upsertResult.server.id, {
                        name: serverInfo.metadata.name || upsertResult.server.name || 'Auto-registered Server',
                        description: serverInfo.metadata.description || upsertResult.server.description || 'Server registered via ping',
                        metadata: {
                            ...(upsertResult.server.metadata && typeof upsertResult.server.metadata === 'object' ? upsertResult.server.metadata : {}),
                            registeredFromPing: true,
                            lastPing: new Date().toISOString(),
                            toolsCount: toolsWithPricing.length,
                            monetizedToolsCount: toolsWithPricing.filter(t => t.pricing).length
                        },
                        toolsData: toolsWithPricing.map(tool => ({
                            name: tool.name,
                            description: tool.description || `Access to ${tool.name}`,
                            inputSchema: tool.inputSchema || ({} as Record<string, unknown>),
                            pricing: tool.pricing
                        }))
                    })(tx);

                    return {
                        server: updateResult.server,
                        tools: updateResult.tools,
                        isNew: false
                    };
                }
            } catch (error) {
                console.error('Server upsert failed:', error);
                throw error;
            }
        });

        const toolSummary = toolsWithPricing.map(tool => ({
            name: tool.name,
            hasPricing: !!tool.pricing,
            pricingInfo: tool.pricing ? {
                asset: tool.pricing[0].assetAddress,
                network: tool.pricing[0].network,
                amount: tool.pricing[0].maxAmountRequiredRaw
            } : null
        }));

        return c.json({
            status: 'success',
            message: `Server ${serverResult.isNew ? 'registered' : 'updated'} successfully`,
            server: {
                id: serverResult.server.id,
                serverId: serverResult.server.serverId,
                name: serverResult.server.name,
                mcpOrigin: mcpUrl.toString(),
                toolsRegistered: toolsWithPricing.length,
                monetizedTools: toolsWithPricing.filter(t => t.pricing).length,
                registrationStatus: serverResult.isNew ? 'created' : 'updated'
            },
            tools: toolSummary,
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping',
            requestId: Math.random().toString(36).substring(7)
        });
    } catch (error) {
        console.error('Error processing enhanced ping:', error);
        return c.json({
            status: 'error',
            message: 'Failed to process ping',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping'
        }, 500);
    }
});

// Add GET endpoint for health checks
app.get('/', async (c) => {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Content-Type', 'application/json');

    const isVercelProduction = process.env.VERCEL_ENV === 'production';
    const isNodeProduction = process.env.NODE_ENV === 'production';
    const isActualProduction = isVercelProduction || (isNodeProduction && !process.env.VERCEL_ENV);

    return c.json({
        status: 'ok',
        message: 'Enhanced ping service is running',
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            VERCEL_ENV: process.env.VERCEL_ENV || 'not-vercel',
            isProduction: isActualProduction
        },
        features: [
            'Auto server registration',
            'Payment extraction from tool annotations',
            'Tool synchronization',
            'API key authentication',
            isActualProduction ? 'Blocked origins protection (active)' : 'Blocked origins protection (inactive)'
        ],
        blockedOrigins: isActualProduction ? BLOCKED_ORIGINS : [],
        blockedOriginsNote: isActualProduction 
            ? 'Active in production environment' 
            : `Disabled in ${process.env.VERCEL_ENV || 'development'} environment`,
        authentication: 'Requires valid API key in X-API-KEY header or Authorization: Bearer header',
        timestamp: new Date().toISOString(),
        service: 'mcpay-ping'
    });
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);