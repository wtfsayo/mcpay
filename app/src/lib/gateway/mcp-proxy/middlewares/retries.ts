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

function parseRetryAfterMs(headerValue: string | null | undefined, fallbackMs: number): number {
    if (!headerValue) return fallbackMs;
    const trimmed = headerValue.trim();
    // If it's a number, it's seconds
    const asNum = Number(trimmed);
    if (!Number.isNaN(asNum)) {
        return Math.max(0, Math.floor(asNum * 1000));
    }
    // Otherwise try HTTP-date
    const dateMs = Date.parse(trimmed);
    if (!Number.isNaN(dateMs)) {
        const diff = dateMs - Date.now();
        return Math.max(0, diff);
    }
    return fallbackMs;
}

async function fetchWithBackoff(
    input: string,
    init: RequestInit = {},
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS
): Promise<Response> {
    let lastError: unknown = undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let res: Response | undefined = undefined;
        try {
            res = await UpstreamService.fetch(input, init);
            const status = res.status;
            // Retry on 429 or transient 5xx
            const shouldRetry = status === 429 || (status >= 500 && status < 600);
            if (!shouldRetry) {
                return res;
            }

            lastError = new Error(`${status} from ${new URL(input).hostname}`);
            if (attempt < maxRetries) {
                const retryAfterHeader = res.headers.get('retry-after');
                const calculatedDelay = parseRetryAfterMs(retryAfterHeader, baseDelayMs * Math.pow(2, attempt));
                const delayMs = calculatedDelay + Math.random() * 1000; // jitter
                // eslint-disable-next-line no-console
                console.log(`[${new Date().toISOString()}] ${status} from ${new URL(input).hostname}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                await sleep(delayMs);
                continue;
            }

            // Exhausted retries; return the last response
            return res;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
                // eslint-disable-next-line no-console
                console.log(`[${new Date().toISOString()}] Network error fetching ${new URL(input).hostname}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                await sleep(delayMs);
                continue;
            }
            // Out of retries: rethrow network error
            throw lastError instanceof Error ? lastError : new Error(String(lastError));
        }
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
        return fetchWithBackoff(input, init ?? {}, maxRetries, baseDelayMs);
    };

    c.set("fetchWithRetry", boundFetcher);
    await next();
};

export default retries;


