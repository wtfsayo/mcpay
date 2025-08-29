import { MiddlewareHandler } from "hono";
import type { ForwardVariables } from "@/lib/gateway/mcp-proxy/middlewares/forward";

// Shared cache entry format so a later "cache write" step can store entries here
export interface CacheEntry {
    response: {
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: string;
    };
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

// In-memory response cache. This is intentionally module-scoped to persist across requests.
export const responseCache = new Map<string, CacheEntry>();

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 60000; // 1 minute

// Variables exposed to the request context so later middlewares/handlers can write into the cache
export type CacheVariables = {
    cacheKey?: string;
};

const DEFAULT_CACHE_TTL = 30000; // 30s

function computeTTLForUrl(url: string): number {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('coingecko')) return 60000; // 1 min for CoinGecko
        return 45000; // 45s default for other APIs
    } catch {
        return DEFAULT_CACHE_TTL;
    }
}

// Compute cache key as method:url:bodyHash
export function getCacheKey(url: string, method: string, body?: ArrayBuffer): string {
    const bodyHash = body ? btoa(String.fromCharCode(...new Uint8Array(body))).substring(0, 32) : '';
    return `${method}:${url}:${bodyHash}`;
}

// Return a hydrated Response if present and not expired; otherwise null
export function getCachedResponse(cacheKey: string): Response | null {
    const entry = responseCache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
        responseCache.delete(cacheKey);
        return null;
    }

    const headers = new Headers(entry.response.headers);
    // Optional hint header for debugging/observability
    headers.set('x-mcpay-cache', 'HIT');

    return new Response(entry.response.body, {
        status: entry.response.status,
        statusText: entry.response.statusText,
        headers
    });
}

function cleanupExpired(now: number): void {
    for (const [key, entry] of responseCache) {
        if (now > entry.timestamp + entry.ttl) {
            responseCache.delete(key);
        }
    }
    lastCleanupAt = now;
}

// Read-through cache middleware: only for GET. On hit returns immediately. On miss, lets the chain continue.
export const cacheRead: MiddlewareHandler<{ Variables: CacheVariables & ForwardVariables }> = async (c, next) => {
    if (c.req.raw.method !== 'GET') {
        return next();
    }

    // If a cache key was computed by forward middleware, use it; otherwise compute here
    let cacheKey = c.get('cacheKey') as string | undefined;
    if (!cacheKey) {
        // Clone and read body for hash calculation (GET bodies are rare but supported by spec)
        let body: ArrayBuffer | undefined = undefined;
        try {
            const cloned = c.req.raw.clone();
            if (cloned.body) {
                body = await cloned.arrayBuffer();
            }
        } catch {
            // Ignore body read errors; proceed without body hash
        }
        cacheKey = getCacheKey(c.req.url, c.req.raw.method, body);
        c.set('cacheKey', cacheKey);
    }

    const cached = cacheKey ? getCachedResponse(cacheKey) : null;
    if (cached) {
        return cached;
    }

    return next();
};

// Cache write middleware: runs after downstream handler. Stores successful GET responses when cacheKey is present.
export const cacheWrite: MiddlewareHandler<{ Variables: CacheVariables & ForwardVariables }> = async (c, next) => {
    if (c.req.raw.method !== 'GET') {
        return next();
    }

    await next();

    const cacheKey = c.get('cacheKey');
    if (!cacheKey) return;

    const res = c.res;
    if (!res || res.status >= 400) return;

    // Skip caching for Server-Sent Events to avoid consuming an endless stream
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
        // Hint header for observability
        try { c.res.headers.set('x-mcpay-cache', 'BYPASS'); } catch { /* ignore */ }
        return;
    }

    try {
        const cloned = res.clone();
        const body = await cloned.text();
        const headersObj: Record<string, string> = {};
        cloned.headers.forEach((v, k) => { headersObj[k] = v; });

        const upstreamUrl = (c.get('upstreamUrl') as string | undefined) || c.req.url;
        const ttl = computeTTLForUrl(upstreamUrl);

        const entry: CacheEntry = {
            response: {
                status: res.status,
                statusText: res.statusText,
                headers: headersObj,
                body
            },
            timestamp: Date.now(),
            ttl
        };

        responseCache.set(cacheKey, entry);
        // Mark the outgoing response for observability (MISS + STORE)
        c.res.headers.set('x-mcpay-cache', 'MISS');

        const now = Date.now();
        if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
            cleanupExpired(now);
        }
    } catch {
        // Ignore caching errors
    }
};


