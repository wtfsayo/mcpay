import type { MiddlewareHandler } from "hono";

export type RequestTimingVariables = {
    requestStartTime: number;
};

/**
 * requestTiming middleware
 * - Captures the request start time for downstream analytics
 */
export const requestTiming: MiddlewareHandler<{ Variables: RequestTimingVariables }> = async (c, next) => {
    c.set('requestStartTime', Date.now());
    await next();
};

export default requestTiming;


