import type { MiddlewareHandler } from "hono";

export type JsonRpcVariables = {
    jsonrpcBatch?: boolean;
    jsonrpcHasRequests?: boolean;
    expectsSse?: boolean;
};

function isJsonRpcRequest(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;
    return typeof o.method === 'string';
}

function hasId(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(o, 'id');
}

function isJsonRpcResponse(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;
    const hasResult = Object.prototype.hasOwnProperty.call(o, 'result');
    const hasError = Object.prototype.hasOwnProperty.call(o, 'error');
    const hasMethod = Object.prototype.hasOwnProperty.call(o, 'method');
    return (hasResult || hasError) && !hasMethod;
}

/**
 * Minimal JSON-RPC transport semantics enforcement:
 * - For POST bodies that are only notifications or only responses → 202 Accepted, no body
 * - Detect batch vs single and whether there are any requests (with id)
 * - For GET, if Accept includes SSE, mark expectsSse
 */
export const jsonrpcAccept: MiddlewareHandler<{ Variables: JsonRpcVariables }> = async (c, next) => {
    const method = c.req.method.toUpperCase();

    // Mark SSE expectations for GET based on Accept header
    if (method === 'GET') {
        const accept = (c.req.header('accept') || '').toLowerCase();
        if (accept.includes('text/event-stream')) {
            c.set('expectsSse', true);
        }
        return next();
    }

    if (method !== 'POST') {
        return next();
    }

    const contentType = (c.req.header('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        return next();
    }

    let jsonData: unknown;
    try {
        const cloned = c.req.raw.clone();
        jsonData = await cloned.json();
    } catch {
        // Not JSON or unreadable; let downstream decide
        return next();
    }

    if (Array.isArray(jsonData)) {
        const items = jsonData;
        const requestItems = items.filter(isJsonRpcRequest);
        const withIds = requestItems.filter(hasId);
        const responsesOnly = items.every(isJsonRpcResponse);

        c.set('jsonrpcBatch', true);
        c.set('jsonrpcHasRequests', withIds.length > 0);

        // Only responses or only notifications (no ids) → 202
        if (responsesOnly || (requestItems.length > 0 && withIds.length === 0)) {
            c.status(202);
            return c.body(null);
        }
        return next();
    }

    if (typeof jsonData === 'object' && jsonData !== null) {
        const obj = jsonData as Record<string, unknown>;
        const isRequest = isJsonRpcRequest(obj);
        const hasRequestId = hasId(obj);
        const isResponse = isJsonRpcResponse(obj);

        c.set('jsonrpcBatch', false);
        c.set('jsonrpcHasRequests', isRequest && hasRequestId);

        // Single notification (method, no id) or a bare response → 202
        if ((isRequest && !hasRequestId) || isResponse) {
            c.status(202);
            return c.body(null);
        }
    }

    return next();
};

export default jsonrpcAccept;


