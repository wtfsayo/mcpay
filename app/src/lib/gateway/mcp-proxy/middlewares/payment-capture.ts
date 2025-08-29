import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { decodePayment, settle, createExactPaymentRequirements } from "@/lib/gateway/payments";
import { fromBaseUnits } from "@/lib/commons";
import type { AuthType, PricingEntry, ToolCall, UserWithWallet } from "@/types";
import { settleResponseHeader } from "@/types/x402";
import type { Next } from "hono";
import type { AuthResolutionVariables } from "./auth-resolution";
import type { InspectToolCallVariables } from "./inspect-tool-call";
import type { UpstreamVariables } from "./upstream";
import type { SupportedNetwork } from "@/types/x402";

type Ctx = {
    Bindings: AuthType,
    Variables: AuthResolutionVariables & InspectToolCallVariables & UpstreamVariables
};

/**
 * paymentCapture middleware
 * - Runs AFTER upstream/cacheWrite
 * - If the request was a paid tool call and upstream response succeeded, perform settlement
 * - Updates DB payment status to completed (idempotent by signature)
 * - Attaches X-PAYMENT-RESPONSE header
 */
export const paymentCapture = async (c: import("hono").Context<Ctx>, next: Next) => {
    try {
        await next();

        const toolCall = c.get("toolCall") as ToolCall | undefined;
        const pickedPricing = c.get("pickedPricing") as PricingEntry | undefined;

        if (!toolCall?.isPaid || !pickedPricing) {
            return;
        }

        // Only capture for successful upstream responses
        const res = c.res;
        if (!res || res.status >= 400) {
            return;
        }

        // Optionally skip capture for cache hits (if x-mcpay-cache: HIT)
        // For now, we capture only when we actually went upstream (no header or MISS)
        const cacheHeader = res.headers.get('x-mcpay-cache') || '';
        if (cacheHeader.toUpperCase() === 'HIT') {
            return;
        }

        const signed = c.req.header("X-PAYMENT");
        if (!signed) {
            // Missing payment header even though marked paid; do not error the response
            return;
        }

        let settleResponse: Awaited<ReturnType<typeof settle>> | undefined;
        try {
            const decoded = decodePayment(signed);
            // Recompute requirement from pricing to pass to settle
            const humanReadableAmount = fromBaseUnits(
                pickedPricing.maxAmountRequiredRaw,
                pickedPricing.tokenDecimals
            );
            const requirement = createExactPaymentRequirements(
                humanReadableAmount,
                pickedPricing.network as SupportedNetwork,
                `mcpay://${toolCall.name}`,
                `Execution of ${toolCall.name}`,
                toolCall.payTo as `0x${string}`
            );
            settleResponse = await settle(decoded, requirement);
        } catch {
            // Don't break response on capture errors
            return;
        }

        if (!settleResponse || settleResponse.success === false) {
            return;
        }

        // Attach settlement header for client visibility
        c.header("X-PAYMENT-RESPONSE", settleResponseHeader(settleResponse));
        try {
            const prevExpose = c.res?.headers.get('Access-Control-Expose-Headers');
            const exposeVal = prevExpose && prevExpose.length > 0
                ? `${prevExpose}, X-PAYMENT-RESPONSE`
                : 'X-PAYMENT-RESPONSE';
            c.header('Access-Control-Expose-Headers', exposeVal);
        } catch {
            c.header('Access-Control-Expose-Headers', 'X-PAYMENT-RESPONSE');
        }

        // Mark payment completed in DB (idempotent)
        try {
            const signedHeader = c.req.header("X-PAYMENT");
            if (signedHeader && toolCall.toolId) {
                await withTransaction(async (tx) => {
                    const existing = await txOperations.getPaymentBySignature(signedHeader)(tx);
                    if (existing) {
                        await txOperations.updatePaymentStatus(existing.id, 'completed', settleResponse!.transaction)(tx);
                    } else {
                        const user = c.get('user') as UserWithWallet | null;
                        await txOperations.createPayment({
                            toolId: toolCall.toolId as string,
                            userId: user?.id,
                            amountRaw: pickedPricing.maxAmountRequiredRaw,
                            tokenDecimals: pickedPricing.tokenDecimals,
                            currency: pickedPricing.assetAddress,
                            network: pickedPricing.network,
                            transactionHash: settleResponse!.transaction,
                            status: 'completed',
                            signature: signedHeader,
                            paymentData: {
                                payer: settleResponse!.payer,
                                network: settleResponse!.network,
                            },
                        })(tx);
                    }
                });
            }
        } catch {
            // best-effort only
        }
    } catch {
        // fail open
        return;
    }
};

export default paymentCapture;


