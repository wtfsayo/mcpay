import { Hono } from "hono";
import { cors } from 'hono/cors';
import api from "./api.js";    
import mcpProxy from "./mcp-proxy.js";
import mcpProxyV2 from "./monetized-mcp-proxy.js";

const app = new Hono();

// Enable CORS for all routes at the root level
app.use('*', cors({
    origin: '*', // Allow all origins
    allowHeaders: ['*'], // Allow all headers  
    allowMethods: ['*'], // Allow all methods
    exposeHeaders: ['*'], // Expose all headers
    maxAge: 86400, // Cache preflight requests for 24 hours
    credentials: true // Allow credentials
}));

app.route('/api', api);
app.route('/mcp', mcpProxy);
app.route('/monetized-mcp', mcpProxyV2);

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
export const PATCH = app.fetch;
export const OPTIONS = app.fetch;
export const PUT = app.fetch;