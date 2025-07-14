// Service that will get a ping from an MCP server, will connect to the server and register it in the database.

import { Hono } from "hono";
import { cors } from 'hono/cors';

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
        service: 'mcpay-ping'
    });
});

export default app;
