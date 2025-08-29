/**
 * Proxy for MCPay.fun API
 * 
 * This module is used to proxy requests to the MCPay.fun API.
 * It is used to bypass CORS restrictions and to add authentication to the requests.
 * 
 * Rate Limiting & Anti-Bot Protection Features:
 * ============================================
 * 
 * 1. REQUEST THROTTLING:
 *    - Limits requests per hostname (30/minute by default)
 *    - Enforces minimum 1-second delay between requests
 *    - In-memory rate limiting to prevent rapid-fire requests
 * 
 * 2. BROWSER-LIKE BEHAVIOR:
 *    - Rotates realistic User-Agent strings (Chrome, Firefox, Safari)
 *    - Adds browser headers (Accept, Accept-Language, Sec-Fetch-*)
 *    - Sets appropriate Origin/Referer headers for API domains
 * 
 * 3. RETRY LOGIC:
 *    - Exponential backoff for 429 (rate limited) responses
 *    - Up to 3 retries with randomized delays (2s base)
 *    - Automatic detection and handling of Cloudflare rate limits
 * 
 * 4. INTELLIGENT CACHING:
 *    - GET request caching with configurable TTL
 *    - Domain-specific cache durations (CoinGecko: 1min, APIs: 45s)
 *    - Automatic cache cleanup to prevent memory leaks
 *    - Cache key includes URL, method, and body hash
 * 
 * 5. CONFIGURATION:
 *    - All limits configurable via RATE_LIMIT_CONFIG
 *    - Easy to adjust for different APIs or traffic patterns
 *    - Separate settings for different types of endpoints
 * 
 * This should significantly reduce 429 errors from Cloudflare and other
 * rate limiting systems by making requests appear more human-like and
 * reducing the actual number of upstream requests through caching.
 */

import { type AuthType } from "@/types";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { authResolution, type AuthResolutionVariables } from "@/lib/gateway/mcp-proxy/middlewares/auth-resolution";
import { inspectToolCall, type InspectToolCallVariables } from "@/lib/gateway/mcp-proxy/middlewares/inspect-tool-call";
// Split payment into pre-authorization and capture phases
import { paymentPreAuth } from "@/lib/gateway/mcp-proxy/middlewares/payment-preauth";
import { paymentCapture } from "@/lib/gateway/mcp-proxy/middlewares/payment-capture";
import { browserHeaders, type BrowserHeadersVariables } from "@/lib/gateway/mcp-proxy/middlewares/browser-headers";
import { rateLimit } from "@/lib/gateway/mcp-proxy/middlewares/rate-limit";
import { cacheRead, cacheWrite, type CacheVariables } from "@/lib/gateway/mcp-proxy/middlewares/cache";
import { retries, type RetriesVariables } from "@/lib/gateway/mcp-proxy/middlewares/retries";
import { forward, type ForwardVariables } from "@/lib/gateway/mcp-proxy/middlewares/forward";
import { upstream, type UpstreamVariables } from "@/lib/gateway/mcp-proxy/middlewares/upstream";
import { requestLogger } from "@/lib/gateway/mcp-proxy/middlewares/request-logger";
import { requestTiming, type RequestTimingVariables } from "@/lib/gateway/mcp-proxy/middlewares/request-timing";
import { analytics } from "@/lib/gateway/mcp-proxy/middlewares/analytics";
import { jsonrpcAccept, type JsonRpcVariables } from "@/lib/gateway/mcp-proxy/middlewares/jsonrpc-accept";

export const runtime = 'nodejs'

// Browser-like header behavior is handled by `browserHeaders` middleware

// Rate limiting is now handled by rateLimit middleware

// User-Agent rotation is handled by `browserHeaders` middleware

// Retry/backoff is provided by retries middleware

const app = new Hono<{ Bindings: AuthType, Variables: AuthResolutionVariables & InspectToolCallVariables & BrowserHeadersVariables & ForwardVariables & CacheVariables & RetriesVariables & UpstreamVariables & RequestTimingVariables & JsonRpcVariables }>({
    strict: false,
}).basePath("/mcp")


// Global auth resolution middleware – sets c.get('user') and c.get('authMethod')
app.use("*", authResolution);
// Capture request start time early for analytics
app.use("*", requestTiming);
// Log incoming JSON payloads safely
app.use("*", requestLogger);
// Enforce minimal JSON-RPC Accept/batch/notification semantics
app.use("*", jsonrpcAccept);
// Inspect tool call – sets c.get('toolCall'), c.get('pickedPricing'), c.get('targetUpstream')
app.use("*", inspectToolCall);
// Prepare browser-like upstream headers
app.use("*", browserHeaders);
// Build upstream URL and request init (no fetch)
app.use("*", forward);
// Read-through cache for GET requests using computed upstream URL (early)
app.use("*", cacheRead);
// Enforce token-bucket + min-delay per hostname
app.use("*", rateLimit);
// Pre-authorize payment (hold only), no capture yet
app.use("*", paymentPreAuth);
// Attach fetchWithRetry to context for 429-only exponential backoff
app.use("*", retries);
// Perform upstream request and mirror response
app.use("*", upstream);
// After upstream response, store successful GET responses in cache
app.use("*", cacheWrite);
// Capture/settle payment after successful upstream/cache write
app.use("*", paymentCapture);
// Capture analytics based on toolCall and upstream response
app.use("*", analytics);

export const GET = handle(app);
export const POST = handle(app);
export const DELETE = handle(app);

