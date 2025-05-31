/**
 * Main API handler for MCPay.fun
 * 
 * This module handles general API endpoints for the MCPay.fun platform.
 * It provides endpoints for user management, server configuration, and other core functionality.
 */

import { type Context, Hono } from "hono";
import { cors } from 'hono/cors';
import registry from '../hardcoded-registry.js';
import { getMcpTools } from "../lib/inspect-mcp.js";
import { txOperations, withTransaction } from "../db/actions.js";
import { PaymentRequirementsSchema } from "x402/types";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { generateObject } from "ai";
import { gateway } from "@vercel/ai-sdk-gateway";
import db from "../db/index.js";

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

app.get('/', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'mcpay-api'
    });
});

// Health check endpoint
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'mcpay-api'
    });
});

// API version endpoint
app.get('/version', (c) => {
    return c.json({
        version: '0.0.1',
        api: 'mcpay-fun',
        timestamp: new Date().toISOString()
    });
});

// MCP Server endpoints
app.get('/servers', async (c) => {
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit') as string) : 10
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset') as string) : 0

    const servers = await withTransaction(async (tx) => {
        return await txOperations.listMcpServers(limit, offset)(tx);
    })

    if (servers.length === 0) {
        return c.json({ error: 'No servers found' }, 404)
    }

    return c.json(servers)
})

app.get('/servers/:id', async (c) => {
    const serverId = c.req.param('id')
    const server = await withTransaction(txOperations.getMcpServerByServerId(serverId))

    if (!server) {
        return c.json({ error: 'Server not found' }, 404)
    }

    return c.json(server)
})

app.post('/servers', async (c) => {
    try {
        const data = await c.req.json() as {
            mcpOrigin: string;
            receiverAddress: string;
            requireAuth?: boolean;
            authHeaders?: Record<string, unknown>;
            description?: string;
            metadata?: Record<string, unknown>;
            name?: string;
            tools?: Array<{
                name: string;
                payment?: z.infer<typeof PaymentRequirementsSchema>
            }>;
        }

        // TODO: Replace with actual DB call
        // const server = await withTransaction(async (tx) => {
        //     return await txOperations.createMcpServer({
        //         name,
        //         description,
        //         origin,
        //         authHeaders,
        //         requireAuth: requireAuth || false
        //     })(tx);
        // });

        const id = randomUUID()

        const tools = await getMcpTools(data.mcpOrigin)

        if (!tools) {
            console.error('Failed to fetch tools from MCP origin:', data.mcpOrigin)
            return c.json({ error: 'Failed to fetch tools' }, 400)
        }

        const toolsData = tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }))


        const serverInformation = await generateObject({
            model: gateway("openai/gpt-4o-mini"),
            schema: z.object({
                name: z.string(),
                description: z.string(),
            }),
            prompt: `
            You are a helpful assistant that generates information about a server. Create a name and description for the server based on the following information:

            - description: ${data.description || 'No description available'}
            - tools: ${toolsData.map((tool) => `${tool.name}: ${tool.description || 'No description available'}`).join('\n            - ')}

            The name should be a short and concise name for the server. Use the tools to create a name that is unique and descriptive.
            `
        })


        try {
            let server: any
            let userId: string
            console.log('Starting database transaction')

            await db.transaction(async (tx) => {
                // Check if user exists, create if not
                console.log('Checking if user exists with wallet address:', data.receiverAddress)
                let user = await txOperations.getUserByWalletAddress(data.receiverAddress)(tx)

                if (!user) {
                    console.log('User not found, creating new user with wallet address:', data.receiverAddress)
                    user = await txOperations.createUser({
                        walletAddress: data.receiverAddress,
                        displayName: `User ${data.receiverAddress.substring(0, 8)}`,
                    })(tx)
                    console.log('Created new user with ID:', user.id)
                } else {
                    console.log('Found existing user with ID:', user.id)
                }

                userId = user.id

                console.log('Creating server record')
                server = await txOperations.createServer({
                    serverId: id,
                    creatorId: user.id,
                    mcpOrigin: data.mcpOrigin,
                    receiverAddress: data.receiverAddress,
                    requireAuth: data.requireAuth,
                    authHeaders: data.authHeaders,
                    name: serverInformation.object.name || data.name || 'No name available',
                    description: serverInformation.object.description || data.description || 'No description available',
                    metadata: data.metadata
                })(tx)

                console.log('Server created, creating tools:', toolsData.length)
                for (const tool of toolsData) {
                    const monetizedTool = data.tools?.find((t) => t.name === tool.name)
                    console.log('Creating tool:', tool.name, 'Monetized:', !!monetizedTool)

                    const _tool = await txOperations.createTool({
                        serverId: server.id,
                        name: tool.name,
                        description: tool.description || `Access to ${tool.name}`,
                        inputSchema: {},
                        isMonetized: monetizedTool?.payment ? true : false,
                        payment: monetizedTool?.payment
                    })(tx)

                    if (monetizedTool?.payment) {
                        console.log('Creating pricing for tool:', tool.name)
                        await txOperations.createToolPricing(
                            _tool.id,
                            {
                                price: monetizedTool.payment.maxAmountRequired,
                                currency: monetizedTool.payment.asset,
                                network: monetizedTool.payment.network,
                                assetAddress: monetizedTool.payment.asset,
                            }
                        )(tx)
                    }
                }

                // Assign ownership of the server to the user
                console.log('Assigning server ownership to user:', userId)
                await txOperations.assignOwnership(server.id, userId, 'owner')(tx)
                console.log('Server ownership assigned successfully')

                console.log('Transaction completed successfully')
                return server
            })

            console.log('Server creation completed, returning response')
            return c.json(server, 201)
        } catch (error) {
            console.error('Error during server creation:', error)
            return c.json({ error: (error as Error).message }, 400)
        }
    }
    catch (error) {
        console.error('Error during server creation:', error)
        return c.json({ error: (error as Error).message }, 400)
    }
});

// Tools endpoints
app.get('/servers/:serverId/tools', async (c) => {
    const serverId = c.req.param('serverId');

    // TODO: Replace with actual DB call
    // const tools = await withTransaction(async (tx) => {
    //     return await txOperations.listMcpToolsByServer(serverId)(tx);
    // });

    const tools = [
        {
            id: 'tool_1',
            serverId,
            name: 'example_tool',
            description: 'An example tool',
            isMonetized: false,
            payment: null,
            createdAt: new Date().toISOString()
        }
    ];

    return c.json(tools);
});

// Analytics endpoints
app.get('/analytics/usage', async (c) => {
    const { startDate, endDate, toolId, userId } = c.req.query();

    // TODO: Replace with actual DB call
    // const usage = await withTransaction(async (tx) => {
    //     return await txOperations.getToolUsageAnalytics({
    //         startDate,
    //         endDate,
    //         toolId,
    //         userId
    //     })(tx);
    // });

    const usage = {
        totalRequests: 42,
        successfulRequests: 40,
        failedRequests: 2,
        averageExecutionTime: 150,
        topTools: [
            { name: 'example_tool', count: 25 }
        ]
    };

    return c.json(usage);
});

app.get('/inspect-mcp-tools', async (c) => {
    const { url } = c.req.query();
    if (!url) {
        return c.json({ error: 'mcpUrl is required' }, 400);
    }
    const tools = await getMcpTools(url);
    return c.json(tools);
});

// Catch-all for unmatched routes
app.all('*', (c) => {
    return c.json({
        error: 'Not Found',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        availableEndpoints: [
            'GET /api/health',
            'GET /api/version',
            'GET /api/users/:walletAddress',
            'POST /api/users',
            'GET /api/servers',
            'GET /api/servers/:id',
            'POST /api/servers',
            'GET /api/servers/:serverId/tools',
            'GET /api/analytics/usage'
        ]
    }, 404);
});


export default app;