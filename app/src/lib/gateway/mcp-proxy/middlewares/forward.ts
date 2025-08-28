import type { MiddlewareHandler } from "hono";
import type { BrowserHeadersVariables } from "@/lib/gateway/mcp-proxy/middlewares/browser-headers";
import type { InspectToolCallVariables } from "@/lib/gateway/mcp-proxy/middlewares/inspect-tool-call";
import { getCacheKey } from "@/lib/gateway/mcp-proxy/middlewares/cache";

export type ForwardVariables = {
    upstreamUrl?: string;
    forwardInit?: RequestInit;
    cacheKey?: string;
};

/**
 * Build the upstream URL and RequestInit without performing the fetch.
 * - Swap host/protocol/port using `targetUpstream` from context
 * - Strip the `/mcp/:id` prefix from the pathname when forwarding
 * - Preserve search params from the target upstream (mcpOrigin)
 * - Prepare headers from `upstreamHeaders`
 * - Compute a cache key based on the final upstream URL and request body
 */
export const forward: MiddlewareHandler<{ Variables: ForwardVariables & InspectToolCallVariables & BrowserHeadersVariables }> = async (c, next) => {
    // Resolve target upstream prepared by inspect-tool-call
    const targetUpstream: URL | undefined = c.get("targetUpstream");
    if (!targetUpstream) {
        return next();
    }

    const originalUrl = new URL(c.req.url);

    // Start from the original URL and swap host/protocol/port
    originalUrl.host = targetUpstream.host;
    originalUrl.protocol = targetUpstream.protocol;
    originalUrl.port = targetUpstream.port;

    // Strip /mcp/:id from the beginning of the pathname and append to targetUpstream.pathname
    const pathWithoutId = originalUrl.pathname.replace(/^\/mcp\/[^\/]+/, "");
    originalUrl.pathname = targetUpstream.pathname + (pathWithoutId || "");

    // Preserve all query parameters from the target upstream (mcpOrigin)
    if (targetUpstream.search) {
        const targetParams = new URLSearchParams(targetUpstream.search);
        targetParams.forEach((value, key) => {
            originalUrl.searchParams.set(key, value);
        });
    }

    // Prepare headers from earlier middleware
    const preparedHeaders = new Headers(c.get("upstreamHeaders"));
    preparedHeaders.set("host", targetUpstream.host);

    // For cache key calculation, read a clone of the request body as ArrayBuffer (safe for streams)
    let bodyForHash: ArrayBuffer | undefined = undefined;
    try {
        const cloned = c.req.raw.clone();
        if (cloned.body) {
            bodyForHash = await cloned.arrayBuffer();
        }
    } catch {
        // ignore body read errors; proceed without body hash
    }

    const method = c.req.raw.method;

    const requestInit: RequestInit = {
        method,
        headers: preparedHeaders,
        // Preserve original stream for non-GET methods; GET typically has no body
        body: method !== "GET" ? c.req.raw.body : undefined,
        // Node fetch streaming hint
        // @ts-expect-error: duplex is a Node-specific extension
        duplex: "half",
    };

    const upstreamUrl = originalUrl.toString();
    const cacheKey = getCacheKey(upstreamUrl, method, bodyForHash);

    c.set("upstreamUrl", upstreamUrl);
    c.set("forwardInit", requestInit);
    c.set("cacheKey", cacheKey);

    await next();
};

export default forward;


