import type { MiddlewareHandler } from "hono";
import type { UserWithWallet } from "@/types";
import type { AuthResolutionVariables } from "@/lib/gateway/mcp-proxy/middlewares/auth-resolution";

// Headers that must NOT be forwarded (RFC‑7230 §6.1 + platform-specific)
const HOP_BY_HOP = new Set([
    // Standard hop-by-hop headers (RFC 7230)
    'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade', 'cookie',

    // Authentication headers. We don't want to forward these to the upstream server.
    'authorization',

    // Infrastructure/proxy headers that could leak internal information
    'forwarded',
    'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto',
    'x-real-ip',
    'x-matched-path',

    // Vercel-specific headers (comprehensive list)
    'x-vercel-deployment-url', 'x-vercel-forwarded-for', 'x-vercel-id',
    'x-vercel-internal-bot-check', 'x-vercel-internal-ingress-bucket', 'x-vercel-internal-ingress-port',
    'x-vercel-ip-as-number', 'x-vercel-ip-city', 'x-vercel-ip-continent', 'x-vercel-ip-country',
    'x-vercel-ip-country-region', 'x-vercel-ip-latitude', 'x-vercel-ip-longitude',
    'x-vercel-ip-postal-code', 'x-vercel-ip-timezone',
    'x-vercel-ja4-digest', 'x-vercel-oidc-token', 'x-vercel-proxied-for',
    'x-vercel-proxy-signature', 'x-vercel-proxy-signature-ts',
    'x-vercel-sc-basepath', 'x-vercel-sc-headers', 'x-vercel-sc-host',
]);

// Header prefixes that should not be forwarded
const BLOCKED_HEADER_PREFIXES = [
    'x-vercel-',  // Catch any future Vercel headers
    'cf-',        // Cloudflare headers if you ever use it
    'x-forwarded-', // Additional forwarded headers
];

function shouldBlockHeader(headerName: string): boolean {
    const lowerName = headerName.toLowerCase();
    if (HOP_BY_HOP.has(lowerName)) return true;
    return BLOCKED_HEADER_PREFIXES.some(prefix => lowerName.startsWith(prefix));
}

// Browser-like User-Agent strings to rotate through
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export type BrowserHeadersVariables = {
    upstreamHeaders: Headers;
};

export function filterIncomingHeaders(incoming: Headers): Headers {
    const headers = new Headers();
    incoming.forEach((value, key) => {
        if (!shouldBlockHeader(key)) {
            headers.set(key, value);
        }
    });
    return headers;
}

export const browserHeaders: MiddlewareHandler<{ Variables: BrowserHeadersVariables & AuthResolutionVariables & { targetUpstream?: URL } }> = async (c, next) => {
    const prepared = filterIncomingHeaders(c.req.raw.headers);

    // Add browser-like headers
    if (!prepared.has('user-agent')) {
        prepared.set('user-agent', getRandomUserAgent());
    }

    prepared.set('accept', 'application/json, text/event-stream, text/plain, */*');
    prepared.set('accept-language', 'en-US,en;q=0.9');
    prepared.set('accept-encoding', 'gzip, deflate, br');
    prepared.set('sec-fetch-dest', 'empty');
    prepared.set('sec-fetch-mode', 'cors');
    prepared.set('sec-fetch-site', 'cross-site');
    // Dynamic referer/origin based on target upstream when available
    try {
        const originalUrl = new URL(c.req.url);
        const upstream = c.get('targetUpstream') as URL | undefined;
        const refererUrl = upstream || originalUrl;
        prepared.set('referer', refererUrl.origin);
        prepared.set('origin', refererUrl.origin);
    } catch {
        prepared.set('referer', 'https://mcpay.fun');
        prepared.set('origin', 'https://mcpay.fun');
    }

    // Add basic Client Hints for better bot heuristics
    if (!prepared.has('sec-ch-ua')) prepared.set('sec-ch-ua', '"Chromium";v="120", "Not A(Brand";v="24", "Google Chrome";v="120"');
    if (!prepared.has('sec-ch-ua-mobile')) prepared.set('sec-ch-ua-mobile', '?0');
    if (!prepared.has('sec-ch-ua-platform')) prepared.set('sec-ch-ua-platform', '"macOS"');

    // Attach user metadata header if available
    const user = c.get('user') as UserWithWallet | undefined;
    const walletAddress = user?.walletAddress || "";
    prepared.set('x-mcpay-wallet-address', walletAddress);

    c.set('upstreamHeaders', prepared);
    await next();
};


