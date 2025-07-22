// Service that will get a ping from an MCP server, will connect to the server and register it in the database.

import { Hono } from "hono";
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';

export const runtime = 'nodejs'

const app = new Hono({
    strict: false,
}).basePath('/requirements')

// Add CORS middleware to handle cross-origin requests
app.use('*', cors({
    origin: '*', // You might want to restrict this to your domain in production
    allowMethods: ['GET', 'OPTIONS'],
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
export const OPTIONS = handle(app);