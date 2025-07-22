// Service that will get a ping from an MCP server, will connect to the server and register it in the database.

import { Hono } from "hono";
import { handle } from 'hono/vercel'

export const runtime = 'nodejs'

const app = new Hono().basePath('/ping')

app.post('/', async (c) => {
    console.log('Ping received');
    const body = await c.req.json();
    console.log(body);
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'mcpay-ping'
    });
});

export const POST = handle(app);