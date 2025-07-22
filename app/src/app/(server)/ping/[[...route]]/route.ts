// Service that will get a ping from an MCP server, will connect to the server and register it in the database.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Hono } from "hono";
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';

export const runtime = 'nodejs'

const app = new Hono({
    strict: false,
}).basePath('/ping')

// Add CORS middleware to handle cross-origin requests
app.use('*', cors({
    origin: '*', // You might want to restrict this to your domain in production
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: false,
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

app.post('/', async (c) => {
    try {
        console.log('Ping received');
        const headers = c.req.header('Authorization');

        if (!headers) {
            return c.json({
                status: 'error',
                message: 'Unauthorized',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 401)
        }

        const token = headers.split(' ')[1]


        const body = await c.req.json();

        console.log(body)

        const { detectedUrls } = body

        // Set proper headers to prevent caching and ensure fresh responses
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
        c.header('Pragma', 'no-cache')
        c.header('Expires', '0')
        c.header('Content-Type', 'application/json')

        const mcpUrl = new URL(`${detectedUrls[0]}/mcp`)

        const transport = new StreamableHTTPClientTransport(mcpUrl)
        const client = new Client({ name: "mcpay-ping", version: "1.0.0" })

        await client.connect(transport)
        const toolsResult = await client.listTools();

        console.log(JSON.stringify(toolsResult))

        return c.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping',
            requestId: Math.random().toString(36).substring(7)
        });
    } catch (error) {
        console.error('Error processing ping:', error);
        c.status(500);
        return c.json({
            status: 'error',
            message: 'Failed to process ping',
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping'
        });
    }
});

// Add GET endpoint for health checks
app.get('/', async (c) => {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    c.header('Content-Type', 'application/json')

    return c.json({
        status: 'ok',
        message: 'Ping service is running',
        timestamp: new Date().toISOString(),
        service: 'mcpay-ping'
    });
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);