import { fromBaseUnits } from "@/lib/commons";
import { extractApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { createExactPaymentRequirements, decodePayment, settle, verifyPayment, x402Version } from "@/lib/gateway/payments";
import type { AuthType, PricingEntry, ToolCall, UserWithWallet } from "@/types";
import { settleResponseHeader, type SupportedNetwork } from "@/types/x402";
import type { Context, Next } from "hono";
import type { AuthResolutionVariables } from "./auth-resolution";
import type { InspectToolCallVariables } from "./inspect-tool-call";
import { attemptAutoSign } from "@/lib/gateway/payment-strategies";

/**
 * paymentGate middleware
 * - If c.get('toolCall') is a paid call, ensure a valid X-PAYMENT
 * - Attempt auto-sign when allowed (API key or managed wallet headers)
 * - Verify and settle; on failure return 402 with accepts; on success set X-PAYMENT-RESPONSE and continue
 */
export const paymentGate = async (
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

        // Validate presence of pricing and payTo
        if (!pickedPricing || !toolCall.payTo) {
            c.status(402);
            return c.json({
                x402Version,
                error: "No payment information available",
                accepts: []
            });
        }

        // Build payment requirements from picked pricing
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

        // Verify payment
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

        // Settle payment
        const signed = c.req.header("X-PAYMENT");
        if (!signed) {
            c.status(402);
            return c.json({
                x402Version,
                error: "No payment found in X-PAYMENT header",
                accepts: paymentRequirements
            });
        }

        const decoded = decodePayment(signed);
        const requirement = paymentRequirements[0];
        if (!requirement) {
            c.status(402);
            return c.json({
                x402Version,
                error: "No payment requirement available for settlement",
                accepts: paymentRequirements
            });
        }

        const settleResponse = await settle(decoded, requirement);
        if (settleResponse.success === false) {
            c.status(402);
            return c.json({
                x402Version,
                error: settleResponse.errorReason || "Settlement failed",
                accepts: paymentRequirements
            });
        }

        // Success – attach settlement header and continue
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
            if (signedHeader && pickedPricing && toolCall.toolId) {
                await withTransaction(async (tx) => {
                    const existing = await txOperations.getPaymentBySignature(signedHeader)(tx);
                    if (existing) {
                        await txOperations.updatePaymentStatus(existing.id, 'completed', settleResponse.transaction)(tx);
                    } else {
                        const user = c.get('user') as UserWithWallet | null;
                        await txOperations.createPayment({
                            toolId: toolCall.toolId as string,
                            userId: user?.id,
                            amountRaw: pickedPricing.maxAmountRequiredRaw,
                            tokenDecimals: pickedPricing.tokenDecimals,
                            currency: pickedPricing.assetAddress,
                            network: pickedPricing.network,
                            transactionHash: settleResponse.transaction,
                            status: 'completed',
                            signature: signedHeader,
                            paymentData: {
                                payer: settleResponse.payer,
                                network: settleResponse.network,
                            },
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

export default paymentGate;


