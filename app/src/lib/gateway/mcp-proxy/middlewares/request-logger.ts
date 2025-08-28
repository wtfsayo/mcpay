import type { MiddlewareHandler } from "hono";

/**
 * requestLogger middleware
 * - Safely clones and logs JSON request payloads for POST requests
 * - Does not consume the original request stream
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
    try {
        const rawRequest = c.req.raw;

        if (rawRequest.method === 'POST' && rawRequest.body) {
            try {
                const contentType = rawRequest.headers.get("content-type") || '';
                const clonedRequest = rawRequest.clone();

                if (contentType.includes('application/json')) {
                    try {
                        const text = await clonedRequest.text();
                        if (text && text.length > 0) {
                            try {
                                const parsed = JSON.parse(text);
                                // eslint-disable-next-line no-console
                                console.log('\x1b[36m%s\x1b[0m', `[${new Date().toISOString()}] Request JSON:`, JSON.stringify(parsed, null, 2));
                            } catch {
                                // eslint-disable-next-line no-console
                                console.log('\x1b[33m%s\x1b[0m', `[${new Date().toISOString()}] Request body couldn't be parsed as JSON`);
                            }
                        }
                    } catch {
                        // ignore read errors
                    }
                }
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('\x1b[31m%s\x1b[0m', `[${new Date().toISOString()}] Error logging request payload:`, err);
            }
        }
    } catch {
        // ignore logger errors
    }

    await next();
};

export default requestLogger;


