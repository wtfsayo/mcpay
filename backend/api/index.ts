/**
 * Proxy for MCPay.fun API
 * 
 * This module is used to proxy requests to the MCPay.fun API.
 * It is used to bypass CORS restrictions and to add authentication to the requests.
 * 
 * It is also used to add a layer of caching to the requests.
 * 
 * It is also used to add a layer of error handling to the requests.
 */

import { type Context, Hono } from "hono";

export const runtime = 'nodejs'

const app = new Hono();

// Headers that must NOT be forwarded (RFC‑7230 §6.1)
const HOP_BY_HOP = new Set([
    'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade'
])

const DEFAULT_UPSTREAM = new URL(process.env.MCP_TARGET ?? 'http://localhost:3050/stream');

const verbs = ["post", "get", "delete"] as const;

/**
 * Copies a client request to the upstream, returning the upstream Response.
 * Works for POST, GET, DELETE – anything the MCP spec allows.
 */
const forwardRequest = async (c: Context, id?: string) => {
    let targetUpstream = DEFAULT_UPSTREAM;
    let authHeaders: Record<string, unknown> | undefined = undefined;

    if(id){
        const mcpConfig = {} as any // TODO: await getMcpConfig(id);

        const mcpOrigin = mcpConfig.origin;
        if(mcpOrigin){
            targetUpstream = new URL(mcpOrigin);
        }

        if(mcpConfig.authHeaders && mcpConfig.requireAuth){
            authHeaders = mcpConfig.authHeaders as Record<string, unknown>;
        }
    }

    const url = new URL(c.req.url);
    url.host = targetUpstream.host;
    url.protocol = targetUpstream.protocol;

    // Remove ID from path when forwarding to upstream
    const pathWithoutId = url.pathname.replace(/^\/mcp\/[^\/]+/, '')
    url.pathname = targetUpstream.pathname + (pathWithoutId || '')

    const headers = c.req.raw.headers;

    headers.forEach((v, k) => {
        if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v)
    })

    headers.set('host', targetUpstream.host);

    if(authHeaders){
        for(const [key, value] of Object.entries(authHeaders)){
            headers.set(key, value as string);
        }
    }

    const response = await fetch(url.toString(), {
        method: c.req.raw.method,
        headers,
        body: c.req.raw.body,
        duplex: 'half'
    })

    return response;
}

/**
 * Mirrors the upstream response to the client.
 */
const mirrorRequest = (res: Response) => {

    const headers = new Headers();

    res.headers.forEach((v, k) => {
        headers.set(k, v);
    })

    return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers
    })
}

// Helper function to inspect request payload for streamable HTTP requests and identify tool calls
const inspectRequest = (c: Context) => {
    const { url, method } = c.req;
    return {
        url,
        method
    }
}

verbs.forEach(verb => {

    app[verb](`/mcp/:id`, async (c) => {
        const id = c.req.param('id');

        return c.json({
            message: `Hello, ${id}!`
        })
    })
})

export const GET = app.fetch;
export const POST = app.fetch;
export const DELETE = app.fetch;
