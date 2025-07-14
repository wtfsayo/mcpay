import { Hono } from "hono";
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import api from "./api.js";
import auth from "./auth.js";
import mcpProxy from "./mcp-proxy.js";
import ping from "./ping.js";

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());

// Global CORS configuration - more permissive for non-auth routes
app.use('*', cors({
    origin: '*',
    allowHeaders: ['*'],
    allowMethods: ['*'],
    maxAge: 86400, // Longer cache time for non-auth endpoints
    credentials: true
}));

// Health check endpoint at root
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'mcpay-backend',
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Route mounting - auth routes will override global CORS with their own
app.route('/api', api);
app.route('/mcp', mcpProxy);
// app.route('/monetized-mcp', mcpProxyV2);
// app.route('/openmcp', openmcp);
app.route('/ping', ping);
app.route('/auth', auth); // This route has its own CORS configuration

// Global error handler
app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return err.getResponse();
    }
    
    console.error('Unhandled error:', err);
    return c.json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    }, 500);
});

// 404 handler
app.notFound((c) => {
    return c.json({
        error: 'Not Found',
        message: `Route ${c.req.method} ${c.req.path} not found`
    }, 404);
});

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
export const OPTIONS = app.fetch;
export const PUT = app.fetch;