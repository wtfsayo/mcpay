import type { MiddlewareHandler } from "hono";
import type { ForwardVariables } from "@/lib/gateway/mcp-proxy/middlewares/forward";
import type { RetriesVariables } from "@/lib/gateway/mcp-proxy/middlewares/retries";

export type UpstreamVariables = {
    upstreamResponse?: Response;
};

/**
 * Centralized upstream fetch service.
 * Retries middleware will call this for the actual network attempt.
 */
export const UpstreamService = {
    async fetch(input: string, init?: RequestInit): Promise<Response> {
        return fetch(input, init);
    },
};

/**
 * Perform the upstream request (using fetchWithRetry) and mirror response 1:1.
 * - Requires `upstreamUrl` and `forwardInit` set by the `forward` middleware
 * - Uses `fetchWithRetry` provided by the `retries` middleware
 * - Stores the mirrored response into `c.res` so later middlewares (e.g. cacheWrite) can use it
 */
export const upstream: MiddlewareHandler<{ Variables: ForwardVariables & RetriesVariables & UpstreamVariables }> = async (c, next) => {
    const upstreamUrl = c.get("upstreamUrl");
    const requestInit = c.get("forwardInit") as RequestInit | undefined;
    const fetchWithRetry = c.get("fetchWithRetry");

    if (!upstreamUrl || !requestInit || !fetchWithRetry) {
        return next();
    }

    const fetched = await fetchWithRetry(upstreamUrl, requestInit);

    // Create a clone for streaming to the client
    const forClient = fetched.clone();

    // Mirror headers/body exactly using the client clone
    const headers = new Headers();
    forClient.headers.forEach((v, k) => headers.set(k, v));
    const mirrored = new Response(forClient.body, {
        status: forClient.status,
        statusText: forClient.statusText,
        headers,
    });

    // Expose the original fetched response for analytics/logging (kept unread here)
    c.set("upstreamResponse", fetched);

    // Set the response for downstream middlewares (e.g., cacheWrite)
    c.res = mirrored;

    // Continue to allow cacheWrite to store successful GET responses
    await next();

    return c.res;
};

export default upstream;


