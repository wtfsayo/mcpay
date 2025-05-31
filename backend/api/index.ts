/**
 * Main API handler for MCPay.fun
 * 
 * This module handles general API endpoints for the MCPay.fun platform.
 * It provides endpoints for user management, server configuration, and other core functionality.
 */

import { type Context, Hono } from "hono";
import { cors } from 'hono/cors';

export const runtime = 'nodejs'

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
    origin: ['http://localhost:3000', 'https://mcpay.fun'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Wallet-Address', 'X-Payment'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

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
        version: '1.0.0',
        api: 'mcpay-fun'
    });
});

// User endpoints
app.get('/users/:walletAddress', async (c) => {
    const walletAddress = c.req.param('walletAddress');
    
    // TODO: Replace with actual DB call
    // const user = await withTransaction(async (tx) => {
    //     return await txOperations.getUserByWalletAddress(walletAddress)(tx);
    // });
    
    const user = {
        id: `user_${walletAddress.substring(0, 8)}`,
        walletAddress,
        displayName: `User_${walletAddress.substring(0, 8)}`,
        createdAt: new Date().toISOString()
    };
    
    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json(user);
});

app.post('/users', async (c) => {
    try {
        const body = await c.req.json();
        const { walletAddress, displayName, email } = body;
        
        if (!walletAddress) {
            return c.json({ error: 'walletAddress is required' }, 400);
        }
        
        // TODO: Replace with actual DB call
        // const user = await withTransaction(async (tx) => {
        //     return await txOperations.createUser({
        //         walletAddress,
        //         displayName: displayName || `User_${walletAddress.substring(0, 8)}`,
        //         email
        //     })(tx);
        // });
        
        const user = {
            id: `user_${walletAddress.substring(0, 8)}`,
            walletAddress,
            displayName: displayName || `User_${walletAddress.substring(0, 8)}`,
            email,
            createdAt: new Date().toISOString()
        };
        
        return c.json(user, 201);
    } catch (error) {
        console.error('Error creating user:', error);
        return c.json({ error: 'Failed to create user' }, 500);
    }
});

// MCP Server endpoints
app.get('/servers', async (c) => {
    // TODO: Replace with actual DB call
    // const servers = await withTransaction(async (tx) => {
    //     return await txOperations.listMcpServers()(tx);
    // });
    
    const servers = [
        {
            id: 'server_1',
            name: 'Example MCP Server',
            description: 'A sample MCP server',
            origin: 'http://localhost:3050',
            isActive: true,
            createdAt: new Date().toISOString()
        }
    ];
    
    return c.json(servers);
});

app.get('/servers/:id', async (c) => {
    const id = c.req.param('id');
    
    // TODO: Replace with actual DB call
    // const server = await withTransaction(async (tx) => {
    //     return await txOperations.internal_getMcpServerByServerId(id)(tx);
    // });
    
    const server = {
        id,
        name: 'Example MCP Server',
        description: 'A sample MCP server',
        origin: 'http://localhost:3050',
        isActive: true,
        createdAt: new Date().toISOString()
    };
    
    if (!server) {
        return c.json({ error: 'Server not found' }, 404);
    }
    
    return c.json(server);
});

app.post('/servers', async (c) => {
    try {
        const body = await c.req.json();
        const { name, description, origin, authHeaders, requireAuth } = body;
        
        if (!name || !origin) {
            return c.json({ error: 'name and origin are required' }, 400);
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
        
        const server = {
            id: `server_${Date.now()}`,
            name,
            description,
            origin,
            authHeaders,
            requireAuth: requireAuth || false,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        
        return c.json(server, 201);
    } catch (error) {
        console.error('Error creating server:', error);
        return c.json({ error: 'Failed to create server' }, 500);
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

export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const DELETE = app.fetch; 