import { Context } from "hono";
import type { PricingEntry, ToolCall, UserWithWallet } from "@/types";
import { filterIncomingHeaders } from "@/lib/gateway/mcp-proxy/middlewares/browser-headers";
import { getCacheKey, getCachedResponse, responseCache } from "@/lib/gateway/mcp-proxy/middlewares/cache";
import type { CacheEntry } from "@/lib/gateway/mcp-proxy/middlewares/cache";
import env from "@/lib/gateway/env";
import { UpstreamService } from "@/lib/gateway/mcp-proxy/middlewares/upstream";
import { auth } from "@/lib/gateway/auth";
import { extractApiKey, hashApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { attemptAutoSign } from "@/lib/gateway/payment-strategies";
import { createExactPaymentRequirements, decodePayment, settle } from "@/lib/gateway/payments";
import { fromBaseUnits } from "@/lib/commons";
import type { SupportedNetwork } from "@/types/x402";
import { createFacilitator } from "@/types/x402";
import { getFacilitatorUrl } from "@/lib/gateway/env";

export interface PipelineCtx {
    req: Request;             // original request (don’t mutate)
    hono: Context; // only for adapter in/out
    startTime: number;
    response?: Response;      // set to short-circuit
    user?: UserWithWallet | null;
    authMethod?: 'api_key' | 'session' | 'wallet_header' | 'none';
    toolCall?: ToolCall | null;
    pickedPricing?: PricingEntry | null;
    upstreamUrl?: URL;
    upstreamHeaders?: Headers;
    requestBody?: ArrayBuffer;        // parsed once
    fetchWithRetry?: (url: URL, init: RequestInit) => Promise<Response>;
    upstreamResponse?: Response;
    rawUpstreamResponse?: Response;
    cacheKey?: string;
    jsonrpc?: { isBatch: boolean; hasRequests: boolean };
    targetUpstream?: URL;
    forwardInit?: RequestInit;
    expectsSse?: boolean;
    paymentHeader?: string;
}

export type Step = (ctx: PipelineCtx) => Promise<PipelineCtx>;

export async function run(steps: Step[], ctx: PipelineCtx): Promise<Response> {
    for (const step of steps) {
        ctx = await step(ctx);
        if (ctx.response) return ctx.response; // short-circuit
    }
    // fallthrough: upstreamResponse or a response written in Hono context
    if (ctx.upstreamResponse) return ctx.upstreamResponse;
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
}

// Utility: safe JSON parse of request body (clone-based)
async function tryParseJson(req: Request): Promise<unknown | undefined> {
    try {
        const contentType = req.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return undefined;
        const cloned = req.clone();
        const text = await cloned.text();
        if (!text) return undefined;
        try { return JSON.parse(text); } catch { return undefined; }
    } catch { return undefined; }
}

// Step: request timing (ensure startTime)
export const requestTimingStep: Step = async (ctx) => {
    if (!ctx.startTime) ctx.startTime = Date.now();
    return ctx;
};

// Step: request logger (best-effort, JSON only)
export const requestLoggerStep: Step = async (ctx) => {
    try {
        if (ctx.req.method.toUpperCase() === 'POST') {
            const json = await tryParseJson(ctx.req);
            if (json !== undefined) {
                // eslint-disable-next-line no-console
                console.log('\x1b[36m%s\x1b[0m', `[${new Date().toISOString()}] Request JSON:`, JSON.stringify(json, null, 2));
            }
        }
    } catch {}
    return ctx;
};

// Step: JSON-RPC Accept/notification semantics
export const jsonrpcAcceptStep: Step = async (ctx) => {
    const method = ctx.req.method.toUpperCase();
    if (method === 'GET') {
        const accept = (ctx.req.headers.get('accept') || '').toLowerCase();
        if (accept.includes('text/event-stream')) ctx.expectsSse = true;
        return ctx;
    }
    if (method !== 'POST') return ctx;

    const contentType = (ctx.req.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) return ctx;

    const jsonData = await tryParseJson(ctx.req);
    if (jsonData === undefined) return ctx;

    function isJsonRpcRequest(obj: unknown): boolean {
        if (!obj || typeof obj !== 'object') return false;
        const o = obj as Record<string, unknown>;
        return typeof o.method === 'string';
    }
    function hasId(obj: unknown): boolean {
        if (!obj || typeof obj !== 'object') return false;
        return Object.prototype.hasOwnProperty.call(obj as object, 'id');
    }
    function isJsonRpcResponse(obj: unknown): boolean {
        if (!obj || typeof obj !== 'object') return false;
        const o = obj as Record<string, unknown>;
        const hasResult = Object.prototype.hasOwnProperty.call(o, 'result');
        const hasError = Object.prototype.hasOwnProperty.call(o, 'error');
        const hasMethod = Object.prototype.hasOwnProperty.call(o, 'method');
        return (hasResult || hasError) && !hasMethod;
    }

    if (Array.isArray(jsonData)) {
        const items = jsonData;
        const requestItems = items.filter(isJsonRpcRequest);
        const withIds = requestItems.filter(hasId);
        const responsesOnly = items.every(isJsonRpcResponse);
        ctx.jsonrpc = { isBatch: true, hasRequests: withIds.length > 0 };
        if (responsesOnly || (requestItems.length > 0 && withIds.length === 0)) {
            ctx.response = new Response(null, { status: 202 });
        }
        return ctx;
    }

    if (typeof jsonData === 'object' && jsonData !== null) {
        const obj = jsonData as Record<string, unknown>;
        const isRequest = isJsonRpcRequest(obj);
        const hasRequestId = hasId(obj);
        const isResponse = isJsonRpcResponse(obj);
        ctx.jsonrpc = { isBatch: false, hasRequests: isRequest && hasRequestId };
        if ((isRequest && !hasRequestId) || isResponse) {
            ctx.response = new Response(null, { status: 202 });
            return ctx;
        }
    }
    return ctx;
};

// Helper to get or create a user by wallet address (pure)
async function getOrCreateUser(walletAddress: string, provider = "unknown"): Promise<UserWithWallet | null> {
    if (!walletAddress || typeof walletAddress !== "string") return null;
    return await withTransaction(async (tx) => {
        const walletRecord = await txOperations.getWalletByAddress(walletAddress)(tx);
        if (walletRecord?.user) {
            await txOperations.updateUserLastLogin(walletRecord.user.id)(tx);
            await txOperations.updateWalletMetadata(walletRecord.id, { lastUsedAt: new Date() })(tx);
            return { ...walletRecord.user, walletAddress: walletRecord.walletAddress } as UserWithWallet;
        }
        let user = await txOperations.getUserByWalletAddress(walletAddress)(tx);
        if (user) {
            await txOperations.migrateLegacyWallet(user.id)(tx);
            await txOperations.updateUserLastLogin(user.id)(tx);
            return user as UserWithWallet;
        }
        let blockchain = "ethereum";
        if (walletAddress.length === 44 && !walletAddress.startsWith("0x")) blockchain = "solana";
        else if (walletAddress.endsWith(".near") || walletAddress.length === 64) blockchain = "near";
        user = await txOperations.createUser({
            walletAddress,
            displayName: `User_${walletAddress.substring(0, 8)}`,
            walletType: "external",
            walletProvider: provider,
            blockchain,
        })(tx);
        return user as UserWithWallet;
    });
}

// Step: auth resolution (API key → session → wallet header)
export const authResolutionStep: Step = async (ctx) => {
    try {
        const url = new URL(ctx.req.url);
        const searchParams = url.searchParams;
        let bodyParams: Record<string, unknown> | undefined = undefined;
        try {
            const json = await tryParseJson(ctx.req);
            if (json && typeof json === 'object') bodyParams = json as Record<string, unknown>;
        } catch {}

        const apiKey = extractApiKey({ headers: ctx.req.headers, searchParams, bodyParams });
        if (apiKey) {
            try {
                const keyHash = hashApiKey(apiKey);
                const apiKeyResult = await withTransaction(async (tx) => {
                    return await txOperations.validateApiKey(keyHash)(tx);
                });
                if (apiKeyResult?.user) {
                    const userWallets = await withTransaction(async (tx) => {
                        return await txOperations.getUserWallets(apiKeyResult.user.id, true)(tx);
                    });
                    const primaryWallet = userWallets.find(w => w.isPrimary) || userWallets[0];
                    if (primaryWallet) {
                        const fullUser = await withTransaction(async (tx) => {
                            return await txOperations.getUserById(apiKeyResult.user!.id)(tx);
                        });
                        if (fullUser) {
                            ctx.user = { ...fullUser, walletAddress: primaryWallet.walletAddress } as UserWithWallet;
                            ctx.authMethod = 'api_key';
                            return ctx;
                        }
                    } else {
                        const fullUser = await withTransaction(async (tx) => {
                            return await txOperations.getUserById(apiKeyResult.user!.id)(tx);
                        });
                        if (fullUser) {
                            ctx.user = { ...fullUser, walletAddress: null } as UserWithWallet;
                            ctx.authMethod = 'api_key';
                            return ctx;
                        }
                    }
                }
            } catch {}
        }

        // Session
        try {
            const authResult = await auth.api.getSession({ headers: ctx.req.headers });
            if (authResult?.session && authResult?.user) {
                const userWallets = await withTransaction(async (tx) => {
                    return await txOperations.getUserWallets(authResult.user.id, true)(tx);
                });
                const primaryWallet = userWallets.find(w => w.isPrimary) || userWallets[0];
                if (primaryWallet) {
                    const fullUser = await withTransaction(async (tx) => {
                        return await txOperations.getUserById(authResult.user.id)(tx);
                    });
                    if (fullUser) {
                        ctx.user = { ...fullUser, walletAddress: primaryWallet.walletAddress } as UserWithWallet;
                        ctx.authMethod = 'session';
                        return ctx;
                    }
                } else {
                    const fullUser = await withTransaction(async (tx) => {
                        return await txOperations.getUserById(authResult.user.id)(tx);
                    });
                    if (fullUser) {
                        ctx.user = { ...fullUser, walletAddress: null } as UserWithWallet;
                        ctx.authMethod = 'session';
                        return ctx;
                    }
                }
            }
        } catch {}

        // Wallet header
        const walletAddress = ctx.req.headers.get("X-Wallet-Address");
        if (walletAddress) {
            const user = await getOrCreateUser(walletAddress);
            if (user) {
                ctx.user = user;
                ctx.authMethod = 'wallet_header';
                return ctx;
            }
        }

        // None
        ctx.user = null;
        ctx.authMethod = 'none';
        return ctx;
    } catch {
        ctx.user = null;
        ctx.authMethod = 'none';
        return ctx;
    }
};

// Step: inspect tool call (resolve id/server/tools/pricing/upstream)
export const inspectToolCallStep: Step = async (ctx) => {
    try {
        const rawUrl = new URL(ctx.req.url);
        const match = rawUrl.pathname.match(/^\/(?:mcp)\/([^\/]+)/);
        const id = match ? match[1] : undefined;
        if (id) {
            const server = await withTransaction(async (tx) => {
                return await txOperations.internal_getMcpServerByServerId(id)(tx);
            });
            if (server?.mcpOrigin) {
                try { ctx.targetUpstream = new URL(server.mcpOrigin); } catch {}
            }
        }

        if (ctx.req.method.toUpperCase() !== 'POST') return ctx;
        const contentType = ctx.req.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return ctx;
        const json = await tryParseJson(ctx.req);
        if (!json || typeof json !== 'object') return ctx;
        const body = json as { method?: unknown; params?: unknown };
        if (body.method !== 'tools/call' || !body.params || typeof body.params !== 'object') return ctx;
        const params = body.params as { name?: unknown; arguments?: unknown };
        const toolName: string | undefined = typeof params.name === 'string' ? params.name : undefined;
        const toolArgs: Record<string, unknown> = params.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {};

        let isPaid = false;
        let pricing: PricingEntry[] | undefined = undefined;
        let toolId: string | undefined = undefined;
        let serverId: string | undefined = undefined;
        let payTo: string | undefined = undefined;

        if (id) {
            const server = await withTransaction(async (tx) => {
                return await txOperations.internal_getMcpServerByServerId(id)(tx);
            });
            payTo = server?.receiverAddress || undefined;
            if (server && toolName) {
                serverId = server.id;
                const tools = await withTransaction(async (tx) => {
                    return await txOperations.listMcpToolsByServer(server.id)(tx);
                });
                const toolConfig = (tools as Array<{ name: string; id: string; pricing?: unknown }>).find((t) => t.name === toolName);
                if (toolConfig) {
                    toolId = toolConfig.id;
                    const pricings = (toolConfig.pricing ?? []) as PricingEntry[];
                    const activePricings = pricings.filter(p => p.active === true);
                    if (activePricings.length > 0) { isPaid = true; pricing = activePricings; }
                }
            }
        }

        let pickedPricing: PricingEntry | undefined = undefined;
        if (pricing && pricing.length > 0) {
            pickedPricing = pricing.find(p => p.network === 'base') || pricing[0];
        }

        const toolCall: ToolCall = {
            name: toolName || 'unknown',
            args: toolArgs,
            isPaid,
            payTo,
            pricing: pickedPricing ? [pickedPricing] : undefined,
            ...(id && { id }),
            ...(toolId && { toolId }),
            ...(serverId && { serverId }),
        };
        ctx.toolCall = toolCall;
        ctx.pickedPricing = pickedPricing || null;
        return ctx;
    } catch {
        return ctx;
    }
};

// Step: browser-like headers preparation
export const browserHeadersStep: Step = async (ctx) => {
    const prepared = filterIncomingHeaders(ctx.req.headers);
    if (!prepared.has('user-agent')) {
        prepared.set('user-agent', 'Mozilla/5.0 (compatible; MCPayProxy/1.0)');
    }
    prepared.set('accept', 'application/json, text/event-stream, text/plain, */*');
    prepared.set('accept-language', 'en-US,en;q=0.9');
    prepared.set('accept-encoding', 'gzip, deflate, br');
    prepared.set('sec-fetch-dest', 'empty');
    prepared.set('sec-fetch-mode', 'cors');
    prepared.set('sec-fetch-site', 'cross-site');
    try {
        const originalUrl = new URL(ctx.req.url);
        const refererUrl = ctx.targetUpstream || originalUrl;
        prepared.set('referer', refererUrl.origin);
        prepared.set('origin', refererUrl.origin);
    } catch {
        prepared.set('referer', 'https://mcpay.fun');
        prepared.set('origin', 'https://mcpay.fun');
    }
    if (!prepared.has('sec-ch-ua')) prepared.set('sec-ch-ua', '"Chromium";v="120", "Not A(Brand";v="24", "Google Chrome";v="120"');
    if (!prepared.has('sec-ch-ua-mobile')) prepared.set('sec-ch-ua-mobile', '?0');
    if (!prepared.has('sec-ch-ua-platform')) prepared.set('sec-ch-ua-platform', '"macOS"');
    const walletAddress = ctx.user?.walletAddress || '';
    prepared.set('x-mcpay-wallet-address', walletAddress);
    ctx.upstreamHeaders = prepared;
    return ctx;
};

// Step: forward URL and RequestInit
export const forwardStep: Step = async (ctx) => {
    const targetUpstream = ctx.targetUpstream;
    if (!targetUpstream) return ctx;
    const originalUrl = new URL(ctx.req.url);
    originalUrl.host = targetUpstream.host;
    originalUrl.protocol = targetUpstream.protocol;
    originalUrl.port = targetUpstream.port;
    const pathWithoutId = originalUrl.pathname.replace(/^\/mcp\/[^\/]+/, "");
    originalUrl.pathname = targetUpstream.pathname + (pathWithoutId || "");
    if (targetUpstream.search) {
        const targetParams = new URLSearchParams(targetUpstream.search);
        targetParams.forEach((value, key) => { originalUrl.searchParams.set(key, value); });
    }
    const preparedHeaders = new Headers(ctx.upstreamHeaders);
    preparedHeaders.set('host', targetUpstream.host);
    let bodyForHash: ArrayBuffer | undefined = undefined;
    try { const cloned = ctx.req.clone(); if (cloned.body) bodyForHash = await cloned.arrayBuffer(); } catch {}
    // Persist a reusable body for retries
    if (bodyForHash) {
        ctx.requestBody = bodyForHash;
    }
    const method = ctx.req.method.toUpperCase();
    const requestInit: RequestInit = {
        method,
        headers: preparedHeaders,
        // Use buffered body to allow retries without stream reuse errors
        body: method !== 'GET' ? ctx.requestBody : undefined,
        // @ts-expect-error Node fetch extension
        duplex: 'half',
    };
    const upstreamUrl = originalUrl.toString();
    const cacheKey = getCacheKey(upstreamUrl, method, bodyForHash);
    ctx.upstreamUrl = new URL(upstreamUrl);
    ctx.forwardInit = requestInit;
    ctx.cacheKey = cacheKey;
    return ctx;
};

// Step: cache read (GET only)
export const cacheReadStep: Step = async (ctx) => {
    if (ctx.req.method !== 'GET') return ctx;
    const cacheKey = ctx.cacheKey ?? getCacheKey(ctx.req.url, ctx.req.method);
    const cached = cacheKey ? getCachedResponse(cacheKey) : null;
    if (cached) { ctx.response = cached; }
    return ctx;
};

// Internal rate limit state & helpers
interface TokenBucket { tokens: number; lastRefillMs: number; lastRequestMs: number; }
const buckets = new Map<string, TokenBucket>();
function getRateLimitConfig() {
    const capacity = typeof env.RATE_LIMIT_CAPACITY === 'number' ? env.RATE_LIMIT_CAPACITY : 30;
    const refillPerSecond = typeof env.RATE_LIMIT_REFILL_PER_SECOND === 'number' ? env.RATE_LIMIT_REFILL_PER_SECOND : 0.5;
    const minDelayMs = typeof env.RATE_LIMIT_MIN_DELAY_MS === 'number' ? env.RATE_LIMIT_MIN_DELAY_MS : 1000;
    return { capacity, refillPerSecond, minDelayMs };
}
function refill(bucket: TokenBucket, nowMs: number, refillPerSecond: number, capacity: number) {
    const elapsedMs = Math.max(0, nowMs - bucket.lastRefillMs);
    const add = (elapsedMs / 1000) * refillPerSecond;
    bucket.tokens = Math.min(capacity, bucket.tokens + add);
    bucket.lastRefillMs = nowMs;
}
function getOrCreateBucket(host: string, capacity: number): TokenBucket {
    const existing = buckets.get(host);
    if (existing) return existing;
    const bucket: TokenBucket = { tokens: capacity, lastRefillMs: Date.now(), lastRequestMs: 0 };
    buckets.set(host, bucket);
    return bucket;
}
async function sleep(ms: number) { if (ms > 0) await new Promise(r => setTimeout(r, ms)); }

// Step: rate limit per hostname
export const rateLimitStep: Step = async (ctx) => {
    const cfg = getRateLimitConfig();
    const hostname = (ctx.targetUpstream?.hostname) || (() => { try { return new URL(ctx.req.url).hostname; } catch { return undefined; } })();
    if (!hostname) return ctx;
    const now = Date.now();
    const bucket = getOrCreateBucket(hostname, cfg.capacity);
    refill(bucket, now, cfg.refillPerSecond, cfg.capacity);
    let waitForTokenMs = 0;
    if (bucket.tokens < 1) {
        const deficit = 1 - bucket.tokens;
        waitForTokenMs = Math.ceil((deficit / cfg.refillPerSecond) * 1000);
    }
    const sinceLast = now - bucket.lastRequestMs;
    const waitForMinDelayMs = Math.max(0, cfg.minDelayMs - sinceLast);
    const waitMs = Math.max(waitForTokenMs, waitForMinDelayMs);
    if (waitMs > 0) { await sleep(waitMs); const afterWait = Date.now(); refill(bucket, afterWait, cfg.refillPerSecond, cfg.capacity); }
    bucket.tokens = Math.max(0, bucket.tokens - 1);
    bucket.lastRequestMs = Date.now();
    return ctx;
};

// Step: payment pre-authorization (verify only, no capture)
export const paymentPreAuthStep: Step = async (ctx) => {
    try {
        const toolCall = ctx.toolCall;
        const pickedPricing = ctx.pickedPricing;
        if (!toolCall?.isPaid) return ctx;
        if (!pickedPricing || !toolCall.payTo) {
            ctx.response = new Response(JSON.stringify({ x402Version: 1, error: 'No payment information available', accepts: [] }), { status: 402, headers: { 'content-type': 'application/json' } });
            return ctx;
        }
        const humanReadableAmount = fromBaseUnits(pickedPricing.maxAmountRequiredRaw, pickedPricing.tokenDecimals);
        const paymentRequirements = [
            createExactPaymentRequirements(humanReadableAmount, pickedPricing.network as SupportedNetwork, `mcpay://${toolCall.name}` as `${string}://${string}`, `Execution of ${toolCall.name}`, toolCall.payTo as `0x${string}`)
        ];
        // Auto-sign if allowed
        const url = new URL(ctx.req.url);
        const searchParams = url.searchParams;
        let bodyParams: Record<string, unknown> | undefined = undefined;
        try { const json = await tryParseJson(ctx.req); if (json && typeof json === 'object') bodyParams = json as Record<string, unknown>; } catch {}
        const hasApiKey = !!extractApiKey({ headers: ctx.req.headers, searchParams, bodyParams });
        const managedWalletHeaders = ((ctx.req.headers.get('x-wallet-provider') || '').toLowerCase() === 'coinbase-cdp' && (ctx.req.headers.get('x-wallet-type') || '').toLowerCase() === 'managed');
        const shouldAutoSign = !ctx.paymentHeader && (hasApiKey || managedWalletHeaders);
        if (shouldAutoSign) {
            try {
                const autoSignResult = await attemptAutoSign(ctx.hono, { isPaid: true, payment: { maxAmountRequired: humanReadableAmount, network: pickedPricing.network, asset: pickedPricing.assetAddress, payTo: toolCall.payTo, resource: `mcpay://${toolCall.name}` as `${string}://${string}`, description: `Execution of ${toolCall.name}` } }, (() => { const u = ctx.user; if (!u) return undefined; return { id: u.id, email: u.email || undefined, name: u.name || undefined, displayName: u.displayName || undefined }; })());
                if (autoSignResult.success && autoSignResult.signedPaymentHeader) { ctx.paymentHeader = autoSignResult.signedPaymentHeader; }
            } catch {}
        }
        // Require payment header
        const existingHeader = ctx.req.headers.get('X-PAYMENT') || ctx.req.headers.get('x-payment') || undefined;
        ctx.paymentHeader = ctx.paymentHeader || existingHeader;
        if (!ctx.paymentHeader) {
            ctx.response = new Response(JSON.stringify({ x402Version: 1, error: 'X-PAYMENT header is required', accepts: paymentRequirements }), { status: 402, headers: { 'content-type': 'application/json' } });
            return ctx;
        }
        // Verify
        try {
            const decoded = decodePayment(ctx.paymentHeader);
            const requirement = paymentRequirements[0]!;
            const facilitatorUrl = getFacilitatorUrl(requirement.network);
            const facilitator = createFacilitator({ url: facilitatorUrl as `${string}://${string}` });
            const resp = await facilitator.verify(decoded, requirement);
            if (!resp.isValid) {
                ctx.response = new Response(JSON.stringify({ x402Version: 1, error: resp.invalidReason, accepts: paymentRequirements, payer: resp.payer }), { status: 402, headers: { 'content-type': 'application/json' } });
                return ctx;
            }
        } catch (error) {
            ctx.response = new Response(JSON.stringify({ x402Version: 1, error, accepts: paymentRequirements }), { status: 402, headers: { 'content-type': 'application/json' } });
            return ctx;
        }
        // Persist pending (best-effort)
        try {
            const signedHeader = ctx.paymentHeader;
            if (signedHeader && pickedPricing && toolCall.toolId) {
                await withTransaction(async (tx) => {
                    const existing = await txOperations.getPaymentBySignature(signedHeader)(tx);
                    if (!existing) {
                        let payerAddress: string | undefined = undefined;
                        try { const decodedForPayer = decodePayment(signedHeader); payerAddress = decodedForPayer.payload.authorization.from; } catch {}
                        const user = ctx.user || null;
                        await txOperations.createPayment({ toolId: toolCall.toolId as string, userId: user?.id, amountRaw: pickedPricing.maxAmountRequiredRaw, tokenDecimals: pickedPricing.tokenDecimals, currency: pickedPricing.assetAddress, network: pickedPricing.network, status: 'pending', signature: signedHeader, paymentData: payerAddress ? { payer: payerAddress } : undefined, })(tx);
                    }
                });
            }
        } catch {}
        return ctx;
    } catch { return ctx; }
};

// Step: retries (429/5xx backoff)
export const retriesStep: Step = async (ctx) => {
    const DEFAULT_MAX_RETRIES = 3;
    const DEFAULT_BASE_DELAY_MS = 2000;
    function parseRetryAfterMs(headerValue: string | null | undefined, fallbackMs: number): number {
        if (!headerValue) return fallbackMs;
        const trimmed = headerValue.trim();
        const asNum = Number(trimmed);
        if (!Number.isNaN(asNum)) return Math.max(0, Math.floor(asNum * 1000));
        const dateMs = Date.parse(trimmed);
        if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
        return fallbackMs;
    }
    async function sleepMs(ms: number) { if (ms > 0) await new Promise(r => setTimeout(r, ms)); }

    async function fetchWithBackoff(input: string, init: RequestInit = {}, maxRetries = DEFAULT_MAX_RETRIES, baseDelayMs = DEFAULT_BASE_DELAY_MS): Promise<Response> {
        let lastError: unknown = undefined;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            let res: Response | undefined = undefined;
            try {
                res = await UpstreamService.fetch(input, init);
                const status = res.status;
                const shouldRetry = status === 429 || (status >= 500 && status < 600);
                if (!shouldRetry) return res;
                lastError = new Error(`${status} from ${new URL(input).hostname}`);
                if (attempt < maxRetries) {
                    const retryAfterHeader = res.headers.get('retry-after');
                    const calculatedDelay = parseRetryAfterMs(retryAfterHeader, baseDelayMs * Math.pow(2, attempt));
                    const delayMs = calculatedDelay + Math.random() * 1000;
                    // eslint-disable-next-line no-console
                    console.log(`[${new Date().toISOString()}] ${status} from ${new URL(input).hostname}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await sleepMs(delayMs);
                    continue;
                }
                return res;
            } catch (err) {
                lastError = err;
                if (attempt < maxRetries) {
                    const delayMs = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
                    // eslint-disable-next-line no-console
                    console.log(`[${new Date().toISOString()}] Network error fetching ${new URL(input).hostname}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                    await sleepMs(delayMs);
                    continue;
                }
                throw lastError instanceof Error ? lastError : new Error(String(lastError));
            }
        }
        throw lastError instanceof Error ? lastError : new Error('Maximum retries exceeded');
    }
    ctx.fetchWithRetry = async (url: URL, init?: RequestInit, options?: { maxRetries?: number; baseDelayMs?: number }) => {
        const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
        const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
        return fetchWithBackoff(url.toString(), init ?? {}, maxRetries, baseDelayMs);
    };
    return ctx;
};

// Step: upstream fetch and mirror response
export const upstreamStep: Step = async (ctx) => {
    const upstreamUrl = ctx.upstreamUrl?.toString();
    const requestInit = ctx.forwardInit;
    const fetchWithRetry = ctx.fetchWithRetry;
    if (!upstreamUrl || !requestInit || !fetchWithRetry) return ctx;
    // For non-GET, ensure body is a fresh BufferSource to avoid locked stream across retries
    const init: RequestInit = { ...requestInit };
    if (init.method && init.method !== 'GET') {
        if (ctx.requestBody) {
            init.body = ctx.requestBody;
        }
    }
    const fetched = await fetchWithRetry(new URL(upstreamUrl), init);
    ctx.rawUpstreamResponse = fetched;
    const forClient = fetched.clone();
    const headers = new Headers();
    forClient.headers.forEach((v, k) => headers.set(k, v));
    const mirrored = new Response(forClient.body, { status: forClient.status, statusText: forClient.statusText, headers });
    ctx.upstreamResponse = mirrored;
    return ctx;
};

// Local TTL calculation and cache write
const DEFAULT_CACHE_TTL = 30000; // 30s
function computeTTLForUrl(url: string): number {
    try { const hostname = new URL(url).hostname.toLowerCase(); if (hostname.includes('coingecko')) return 60000; return 45000; } catch { return DEFAULT_CACHE_TTL; }
}
export const cacheWriteStep: Step = async (ctx) => {
    if (ctx.req.method !== 'GET') return ctx;
    const res = ctx.upstreamResponse;
    if (!res || res.status >= 400) return ctx;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) { try { res.headers.set('x-mcpay-cache', 'BYPASS'); } catch {} return ctx; }
    try {
        const cloned = res.clone();
        const body = await cloned.text();
        const headersObj: Record<string, string> = {};
        cloned.headers.forEach((v, k) => { headersObj[k] = v; });
        const upstreamUrl = (ctx.upstreamUrl?.toString()) || ctx.req.url;
        const ttl = computeTTLForUrl(upstreamUrl);
        const entry: CacheEntry = { response: { status: res.status, statusText: res.statusText, headers: headersObj, body }, timestamp: Date.now(), ttl };
        if (ctx.cacheKey) responseCache.set(ctx.cacheKey, entry);
        res.headers.set('x-mcpay-cache', 'MISS');
    } catch {}
    return ctx;
};

// Step: payment capture (settle and attach response header)
export const paymentCaptureStep: Step = async (ctx) => {
    try {
        const toolCall = ctx.toolCall;
        const pickedPricing = ctx.pickedPricing;
        if (!toolCall?.isPaid || !pickedPricing) return ctx;
        const res = ctx.upstreamResponse;
        if (!res || res.status >= 400) return ctx;
        const cacheHeader = res.headers.get('x-mcpay-cache') || '';
        if (cacheHeader.toUpperCase() === 'HIT') return ctx;
        const signed = ctx.paymentHeader || ctx.req.headers.get('X-PAYMENT') || undefined;
        if (!signed) return ctx;
        let settleResponse: Awaited<ReturnType<typeof settle>> | undefined;
        try {
            const decoded = decodePayment(signed);
            const humanReadableAmount = fromBaseUnits(pickedPricing.maxAmountRequiredRaw, pickedPricing.tokenDecimals);
            const requirement = createExactPaymentRequirements(humanReadableAmount, pickedPricing.network as SupportedNetwork, `mcpay://${toolCall.name}` as `${string}://${string}`, `Execution of ${toolCall.name}`, toolCall.payTo as `0x${string}`);
            settleResponse = await settle(decoded, requirement);
        } catch { return ctx; }
        if (!settleResponse || settleResponse.success === false) return ctx;
        try {
            // If settle() returns a header builder, prefer it; otherwise assume it added headers upstream
            const headerCandidate = (settleResponse as { header?: string } | undefined)?.header;
            if (headerCandidate) {
                res.headers.set('X-PAYMENT-RESPONSE', headerCandidate);
                const prevExpose = res.headers.get('Access-Control-Expose-Headers');
                const exposeVal = prevExpose && prevExpose.length > 0 ? `${prevExpose}, X-PAYMENT-RESPONSE` : 'X-PAYMENT-RESPONSE';
                res.headers.set('Access-Control-Expose-Headers', exposeVal);
            }
        } catch {}
        try {
            const signedHeader = signed;
            if (signedHeader && toolCall.toolId) {
                await withTransaction(async (tx) => {
                    const existing = await txOperations.getPaymentBySignature(signedHeader)(tx);
                    if (existing) {
                        await txOperations.updatePaymentStatus(existing.id, 'completed', settleResponse!.transaction)(tx);
                    } else {
                        const user = ctx.user || null;
                        await txOperations.createPayment({ toolId: toolCall.toolId as string, userId: user?.id, amountRaw: pickedPricing.maxAmountRequiredRaw, tokenDecimals: pickedPricing.tokenDecimals, currency: pickedPricing.assetAddress, network: pickedPricing.network, transactionHash: settleResponse!.transaction, status: 'completed', signature: signedHeader, paymentData: { payer: settleResponse!.payer, network: settleResponse!.network }, })(tx);
                    }
                });
            }
        } catch {}
        return ctx;
    } catch { return ctx; }
};

// Helper: capture upstream response data safely (avoid SSE)
async function captureResponseData(upstream: Response): Promise<Record<string, unknown> | undefined> {
    try {
        const cloned = upstream.clone();
        const contentType = cloned.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) return undefined;
        const text = await cloned.text();
        if (!text) return undefined;
        try { return JSON.parse(text); } catch { return { response: text } as Record<string, unknown>; }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`[${new Date().toISOString()}] Could not capture response data:`, e);
        return undefined;
    }
}

// Step: analytics
export const analyticsStep: Step = async (ctx) => {
    const toolCall = ctx.toolCall || undefined;
    const upstream = ctx.rawUpstreamResponse || ctx.upstreamResponse;
    if (!toolCall || !upstream) return ctx;
    const user = ctx.user || null;
    const authMethod = ctx.authMethod;
    const effectiveStart = typeof ctx.startTime === 'number' ? ctx.startTime : Date.now();
    const responseData = await captureResponseData(upstream);
    try {
        const pickedPricing = toolCall.pricing?.[0];
        await withTransaction(async (tx) => {
            await txOperations.recordToolUsage({ toolId: (toolCall.toolId as string) || 'unknown', userId: user?.id, responseStatus: upstream.status.toString(), executionTimeMs: Date.now() - effectiveStart, ipAddress: ctx.req.headers.get('x-forwarded-for') || ctx.req.headers.get('x-real-ip') || undefined, userAgent: ctx.req.headers.get('user-agent') || undefined, requestData: { toolName: toolCall.name, args: toolCall.args, authMethod }, result: responseData })(tx);
            const paymentAmount = pickedPricing?.maxAmountRequiredRaw || "0";
            if (toolCall.isPaid && paymentAmount && pickedPricing) {
                try {
                    const isBaseUnits = /^\d+$/.test(paymentAmount);
                    const humanAmount = isBaseUnits ? fromBaseUnits(paymentAmount, pickedPricing.tokenDecimals) : paymentAmount;
                    // eslint-disable-next-line no-console
                    console.log(`[${new Date().toISOString()}] Analytics: Revenue ${humanAmount} ${pickedPricing.assetAddress}`);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.log(`[${new Date().toISOString()}] Analytics: Revenue conversion failed, using amount as-is: ${paymentAmount} (error: ${error})`);
                }
            }
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`[${new Date().toISOString()}] Analytics recording error:`, e);
    }
    return ctx;
};

// Default pipeline in the correct order
export const PIPELINE_STEPS: Step[] = [
    requestTimingStep,
    requestLoggerStep,
    jsonrpcAcceptStep,
    authResolutionStep,
    inspectToolCallStep,
    browserHeadersStep,
    forwardStep,
    cacheReadStep,
    rateLimitStep,
    paymentPreAuthStep,
    retriesStep,
    upstreamStep,
    cacheWriteStep,
    paymentCaptureStep,
    analyticsStep,
];

const pipeline = {
    run,
    PIPELINE_STEPS,
};

export default pipeline;


