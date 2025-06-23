import { createMcpHandler, experimental_withMcpAuth } from "@vercel/mcp-adapter";
import { type Context, Hono } from "hono";
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

const handler = createMcpHandler((server) => {})

const wrappedHandler = async (req: Request, { id }: { id: string }) => {
    
    const authHandler = experimental_withMcpAuth(handler, (req) => {
        return Promise.resolve({
            token: "",
            extra: {},
            clientId: "mcpay.fun-backend",
            scopes: ["*"],
        });
    });

    return authHandler(req);
};

// Add routes for MCP handling
app.all('/:id/*', async (c: Context) => {
    console.log(`[${new Date().toISOString()}] MCP-v2 request: ${c.req.method} ${c.req.url}`);

    const id = c.req.param('id');

    // Convert Hono context to standard Request and get response
    const response = await wrappedHandler(c.req.raw, { id });

    // Return the response through Hono
    return response;
});

export default app;