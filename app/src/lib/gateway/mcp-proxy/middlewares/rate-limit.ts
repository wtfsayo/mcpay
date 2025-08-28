import type { MiddlewareHandler } from "hono";
import type { AuthType } from "@/types";
import type { AuthResolutionVariables } from "@/lib/gateway/mcp-proxy/middlewares/auth-resolution";
import type { InspectToolCallVariables } from "@/lib/gateway/mcp-proxy/middlewares/inspect-tool-call";
import type { BrowserHeadersVariables } from "@/lib/gateway/mcp-proxy/middlewares/browser-headers";

type Ctx = { Bindings: AuthType, Variables: AuthResolutionVariables & InspectToolCallVariables & BrowserHeadersVariables };

interface TokenBucket {
    tokens: number;
    lastRefillMs: number;
    lastRequestMs: number;
}

interface RateLimitConfig {
    capacity: number; // maximum burst size (tokens)
    refillPerSecond: number; // tokens added per second
    minDelayMs: number; // minimum spacing between requests per hostname
}

const DEFAULT_CONFIG: RateLimitConfig = {
    capacity: 30, // ~30 req/min burst
    refillPerSecond: 0.5, // 30 tokens per minute
    minDelayMs: 1000 // at least 1s between requests
};

const buckets = new Map<string, TokenBucket>();

function getHostnameFromContext(
    c: {
        get: (key: string) => unknown;
        req: { url?: string };
    }
): string | undefined {
    try {
        const targetUpstream = (c.get && (c.get("targetUpstream") as URL | undefined)) || undefined;
        if (targetUpstream) return targetUpstream.hostname;
        const url = new URL(c.req?.url ?? "");
        return url.hostname || undefined;
    } catch {
        return undefined;
    }
}

function refill(bucket: TokenBucket, nowMs: number, cfg: RateLimitConfig): void {
    const elapsedMs = Math.max(0, nowMs - bucket.lastRefillMs);
    const add = (elapsedMs / 1000) * cfg.refillPerSecond;
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + add);
    bucket.lastRefillMs = nowMs;
}

function getOrCreateBucket(host: string, cfg: RateLimitConfig): TokenBucket {
    const existing = buckets.get(host);
    if (existing) return existing;
    const bucket: TokenBucket = {
        tokens: cfg.capacity,
        lastRefillMs: Date.now(),
        lastRequestMs: 0
    };
    buckets.set(host, bucket);
    return bucket;
}

async function sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
}

export const rateLimit: MiddlewareHandler<Ctx> = async (c, next) => {
    const cfg = DEFAULT_CONFIG;

    const hostname = getHostnameFromContext(c);
    if (!hostname) {
        return next();
    }

    const now = Date.now();
    const bucket = getOrCreateBucket(hostname, cfg);
    refill(bucket, now, cfg);

    // Determine wait time for token availability
    let waitForTokenMs = 0;
    if (bucket.tokens < 1) {
        const deficit = 1 - bucket.tokens;
        waitForTokenMs = Math.ceil((deficit / cfg.refillPerSecond) * 1000);
    }

    // Enforce minimum spacing between requests
    const sinceLast = now - bucket.lastRequestMs;
    const waitForMinDelayMs = Math.max(0, cfg.minDelayMs - sinceLast);

    const waitMs = Math.max(waitForTokenMs, waitForMinDelayMs);
    if (waitMs > 0) {
        await sleep(waitMs);
        const afterWait = Date.now();
        refill(bucket, afterWait, cfg);
    }

    // Consume one token and continue
    bucket.tokens = Math.max(0, bucket.tokens - 1);
    bucket.lastRequestMs = Date.now();

    return next();
};


