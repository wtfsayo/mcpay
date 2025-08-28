import type { MiddlewareHandler } from "hono";
import { UpstreamService } from "@/lib/gateway/mcp-proxy/middlewares/upstream";

export type RetriesVariables = {
    fetchWithRetry: (
        input: string,
        init?: RequestInit,
        options?: {
            maxRetries?: number;
            baseDelayMs?: number;
        }
    ) => Promise<Response>;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 2000; // 2s

async function sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWith429Backoff(
    input: string,
    init: RequestInit = {},
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS
): Promise<Response> {
    let lastError: unknown = undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await UpstreamService.fetch(input, init);
        if (res.status !== 429) {
            return res;
        }

        lastError = new Error(`429 Rate Limited by ${new URL(input).hostname}`);
        if (attempt < maxRetries) {
            const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
            // eslint-disable-next-line no-console
            console.log(`[${new Date().toISOString()}] 429 from ${new URL(input).hostname}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
            await sleep(delayMs);
            continue;
        }

        // Exhausted retries; return the last 429 response to caller
        return res;
    }

    // Should not reach here, but throw if it does
    throw lastError instanceof Error ? lastError : new Error("Maximum retries exceeded");
}

export const retries: MiddlewareHandler<{ Variables: RetriesVariables }> = async (c, next) => {
    const boundFetcher = async (
        input: string,
        init?: RequestInit,
        options?: { maxRetries?: number; baseDelayMs?: number }
    ): Promise<Response> => {
        const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
        const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
        return fetchWith429Backoff(input, init ?? {}, maxRetries, baseDelayMs);
    };

    c.set("fetchWithRetry", boundFetcher);
    await next();
};

export default retries;


