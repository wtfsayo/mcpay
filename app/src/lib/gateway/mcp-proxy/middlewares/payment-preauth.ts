import { fromBaseUnits } from "@/lib/commons";
import { extractApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { createExactPaymentRequirements, decodePayment, verifyPayment, x402Version } from "@/lib/gateway/payments";
import type { AuthType, PricingEntry, ToolCall, UserWithWallet } from "@/types";
import type { Context, Next } from "hono";
import type { AuthResolutionVariables } from "./auth-resolution";
import type { InspectToolCallVariables } from "./inspect-tool-call";
import { attemptAutoSign } from "@/lib/gateway/payment-strategies";
import { type SupportedNetwork } from "@/types/x402";

/**
 * paymentPreAuth middleware
 * - If `toolCall` is paid, ensure a valid X-PAYMENT exists and is verified
 * - Attempt auto-sign when allowed (API key or managed wallet headers)
 * - Persist a pending payment record (idempotent by signature)
 * - Does NOT settle/capture; capture happens later after upstream succeeds
 */
export const paymentPreAuth = async (
    c: Context<{ Bindings: AuthType, Variables: AuthResolutionVariables & InspectToolCallVariables }>,
    next: Next
) => {
    try {
        const toolCall = c.get("toolCall") as ToolCall | undefined;
        const pickedPricing = c.get("pickedPricing") as PricingEntry | undefined;

        if (!toolCall?.isPaid) {
            await next();
            return;
        }

        if (!pickedPricing || !toolCall.payTo) {
            c.status(402);
            return c.json({
                x402Version,
                error: "No payment information available",
                accepts: []
            });
        }

        const humanReadableAmount = fromBaseUnits(
            pickedPricing.maxAmountRequiredRaw,
            pickedPricing.tokenDecimals
        );

        const paymentRequirements = [
            createExactPaymentRequirements(
                humanReadableAmount,
                pickedPricing.network as SupportedNetwork,
                `mcpay://${toolCall.name}`,
                `Execution of ${toolCall.name}`,
                toolCall.payTo as `0x${string}`
            )
        ];

        // Try auto-sign if allowed and no X-PAYMENT yet
        let paymentHeader = c.req.header("X-PAYMENT");

        // Detect API key presence (headers, query, or JSON body)
        const url = new URL(c.req.url);
        const searchParams = url.searchParams;
        let bodyParams: Record<string, unknown> | undefined = undefined;
        try {
            const contentType = c.req.header("content-type") || "";
            if (contentType.includes("application/json") && c.req.raw.body) {
                const cloned = c.req.raw.clone();
                const json = await cloned.json();
                if (typeof json === "object" && json !== null) {
                    bodyParams = json as Record<string, unknown>;
                }
            }
        } catch {
            // ignore body parse errors
        }

        const hasApiKey = !!extractApiKey({
            headers: c.req.raw.headers,
            searchParams,
            bodyParams
        });

        // Detect managed wallet headers (provider + type)
        const managedWalletHeaders = (
            (c.req.header('x-wallet-provider') || "").toLowerCase() === 'coinbase-cdp' &&
            (c.req.header('x-wallet-type') || "").toLowerCase() === 'managed'
        );

        const shouldAutoSign = !paymentHeader && (hasApiKey || managedWalletHeaders);

        if (shouldAutoSign) {
            try {
                const autoSignResult = await attemptAutoSign(c, {
                    isPaid: true,
                    payment: {
                        maxAmountRequired: humanReadableAmount,
                        network: pickedPricing.network,
                        asset: pickedPricing.assetAddress,
                        payTo: toolCall.payTo,
                        resource: `mcpay://${toolCall.name}`,
                        description: `Execution of ${toolCall.name}`
                    }
                }, (() => {
                    const u = c.get('user') as UserWithWallet | null;
                    if (!u) return undefined;
                    return {
                        id: u.id,
                        email: u.email || undefined,
                        name: u.name || undefined,
                        displayName: u.displayName || undefined
                    };
                })());

                if (autoSignResult.success && autoSignResult.signedPaymentHeader) {
                    paymentHeader = autoSignResult.signedPaymentHeader;
                    c.req.raw.headers.set("X-PAYMENT", paymentHeader);
                }
            } catch {
                // ignore auto-sign failures; continue to verification which will 402 if missing
            }
        }

        // Verify payment (but do NOT settle)
        const verification = await verifyPayment(c, paymentRequirements);
        if (verification instanceof Response) {
            return verification; // upstream verification prepared a response
        }
        if (!verification) {
            c.status(402);
            return c.json({
                x402Version,
                error: "Payment verification failed",
                accepts: paymentRequirements
            });
        }

        // Persist a pending payment record (idempotent by signature)
        try {
            const signedHeader = c.req.header("X-PAYMENT");
            if (signedHeader && pickedPricing && toolCall.toolId) {
                await withTransaction(async (tx) => {
                    const existing = await txOperations.getPaymentBySignature(signedHeader)(tx);
                    if (!existing) {
                        let payerAddress: string | undefined = undefined;
                        try {
                            const decodedForPayer = decodePayment(signedHeader);
                            payerAddress = decodedForPayer.payload.authorization.from;
                        } catch {}

                        const user = c.get('user') as UserWithWallet | null;
                        await txOperations.createPayment({
                            toolId: toolCall.toolId as string,
                            userId: user?.id,
                            amountRaw: pickedPricing.maxAmountRequiredRaw,
                            tokenDecimals: pickedPricing.tokenDecimals,
                            currency: pickedPricing.assetAddress,
                            network: pickedPricing.network,
                            status: 'pending',
                            signature: signedHeader,
                            paymentData: payerAddress ? { payer: payerAddress } : undefined,
                        })(tx);
                    }
                });
            }
        } catch {
            // best-effort only
        }

        await next();
    } catch (e) {
        // In case of unexpected error, fail open (no 402) to avoid blocking non-paid routes
        await next();
    }
};

export default paymentPreAuth;


