import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import type { PricingEntry, MCPTool, ToolCall } from "@/types";
import type { Context, Next } from "hono";

export type InspectToolCallVariables = {
    toolCall?: ToolCall;
    pickedPricing?: PricingEntry;
    targetUpstream?: URL;
};

/**
 * Middleware: inspectToolCall
 * - If POST with JSON body and looks like tools/call
 * - Resolves server (by :id), tools, pricing (prefers Base mainnet), and target upstream
 * - Sets context variables: toolCall, pickedPricing, targetUpstream
 */
export const inspectToolCall = async (
    c: Context<{ Variables: InspectToolCallVariables }>,
    next: Next
) => {
    try {
        const raw = c.req.raw;
        const method = raw.method.toUpperCase();
        const contentType = raw.headers.get("content-type") || "";

        // Extract :id from path /mcp/:id/...
        const urlPathMatch = new URL(raw.url).pathname.match(/^\/mcp\/([^\/]+)/);
        const id = urlPathMatch ? urlPathMatch[1] : undefined;

        // Resolve upstream from DB when :id is present
        if (id) {
            const server = await withTransaction(async (tx) => {
                return await txOperations.internal_getMcpServerByServerId(id)(tx);
            });
            if (server?.mcpOrigin) {
                try {
                    c.set("targetUpstream", new URL(server.mcpOrigin));
                } catch {
                    // ignore invalid URL
                }
            }
        }

        if (method !== "POST") {
            await next();
            return;
        }

        if (!contentType.includes("application/json") || !raw.body) {
            await next();
            return;
        }

        // Clone to safely read body without consuming the original stream
        const cloned = raw.clone();
        let jsonData: unknown;
        try {
            jsonData = await cloned.json();
        } catch {
            jsonData = undefined;
        }

        if (!jsonData || typeof jsonData !== "object") {
            await next();
            return;
        }

        const body = jsonData as { method?: unknown; params?: unknown };
        if (body.method !== "tools/call" || !body.params || typeof body.params !== "object") {
            await next();
            return;
        }

        const params = body.params as { name?: unknown; arguments?: unknown };
        const toolName: string | undefined = typeof params.name === "string" ? params.name : undefined;
        const toolArgs: Record<string, unknown> =
            params.arguments && typeof params.arguments === "object"
                ? (params.arguments as Record<string, unknown>)
                : {};

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

                const toolConfig = tools.find((t: MCPTool) => t.name === toolName);
                if (toolConfig) {
                    toolId = toolConfig.id;
                    const activePricings = (toolConfig.pricing as PricingEntry[] || []).filter(p => p.active === true);
                    if (activePricings.length > 0) {
                        isPaid = true;
                        pricing = activePricings;
                    }
                }
            }
        }

        // Pick pricing: prefer Base mainnet first
        let pickedPricing: PricingEntry | undefined = undefined;
        if (pricing && pricing.length > 0) {
            pickedPricing = pricing.find(p => p.network === "base") || pricing[0];
        }

        const toolCall: ToolCall = {
            name: toolName || "unknown",
            args: toolArgs,
            isPaid,
            payTo,
            pricing: pickedPricing ? [pickedPricing] : undefined,
            ...(id && { id }),
            ...(toolId && { toolId }),
            ...(serverId && { serverId }),
        };

        c.set("toolCall", toolCall);
        if (pickedPricing) c.set("pickedPricing", pickedPricing);

        await next();
    } catch (e) {
        // Non-fatal – continue the chain
        await next();
    }
};

export default inspectToolCall;


