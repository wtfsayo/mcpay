import { fromBaseUnits } from "@/lib/commons";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import type { AuthType, ToolCall, UserWithWallet } from "@/types";
import type { AuthResolutionVariables } from "@/lib/gateway/mcp-proxy/middlewares/auth-resolution";
import type { InspectToolCallVariables } from "@/lib/gateway/mcp-proxy/middlewares/inspect-tool-call";
import type { UpstreamVariables } from "@/lib/gateway/mcp-proxy/middlewares/upstream";
import type { RequestTimingVariables } from "@/lib/gateway/mcp-proxy/middlewares/request-timing";
import type { Context, Next } from "hono";

function ensureString(value: string | undefined, fallback = "unknown"): string {
    return value !== undefined ? value : fallback;
}

async function captureResponseData(upstream: Response): Promise<Record<string, unknown> | undefined> {
    try {
        const cloned = upstream.clone();
        const text = await cloned.text();
        if (!text) return undefined;
        try {
            return JSON.parse(text);
        } catch {
            return { response: text } as Record<string, unknown>;
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`[${new Date().toISOString()}] Could not capture response data:`, e);
        return undefined;
    }
}

export const analytics = async (
    c: Context<{ Bindings: AuthType, Variables: AuthResolutionVariables & InspectToolCallVariables & UpstreamVariables & RequestTimingVariables }>,
    next: Next
) => {
    await next();

    const toolCall = c.get('toolCall') as ToolCall | undefined;
    const upstream = c.get('upstreamResponse') as Response | undefined;
    if (!toolCall || !upstream) return;

    const user = c.get('user') as UserWithWallet | null;
    const authMethod = c.get('authMethod');
    const startTime = c.get('requestStartTime') as number | undefined;
    const effectiveStart = typeof startTime === 'number' ? startTime : Date.now();

    // Avoid consuming endless/streaming bodies such as Server-Sent Events
    const responseData = await captureResponseData(upstream);

    // Record analytics
    try {
        const pickedPricing = toolCall.pricing?.[0];

        await withTransaction(async (tx) => {
            await txOperations.recordToolUsage({
                toolId: ensureString(toolCall.toolId),
                userId: user?.id,
                responseStatus: upstream.status.toString(),
                executionTimeMs: Date.now() - effectiveStart,
                ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
                userAgent: c.req.header('user-agent'),
                requestData: {
                    toolName: toolCall.name,
                    args: toolCall.args,
                    authMethod
                },
                result: responseData
            })(tx);

            // Compute converted revenue for paid tools (best-effort)
            const paymentAmount = pickedPricing?.maxAmountRequiredRaw || "0";
            if (toolCall.isPaid && paymentAmount && pickedPricing) {
                try {
                    const isBaseUnits = /^\d+$/.test(paymentAmount);
                    const humanAmount = isBaseUnits
                        ? fromBaseUnits(paymentAmount, pickedPricing.tokenDecimals)
                        : paymentAmount;
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
};

export default analytics;


