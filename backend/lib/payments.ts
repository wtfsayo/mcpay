import type { Network, PaymentPayload, PaymentRequirements, Price, Resource } from "x402/types";

import { processPriceToAtomicAmount } from "x402/shared";
import { useFacilitator } from "x402/verify";
import { exact } from "x402/schemes";

export const facilitatorUrl = process.env.FACILITATOR_URL as Resource || "https://x402.org/facilitator";

console.log(`[PAYMENTS] Using facilitator URL: ${facilitatorUrl}`);

export const { verify, settle } = useFacilitator({ url: facilitatorUrl });
export const x402Version = 1;


export function createExactPaymentRequirements(
    price: Price,
    network: Network,
    resource: Resource,
    description = "",
    payTo: `0x${string}`,
): PaymentRequirements {
    const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
    if ("error" in atomicAmountForAsset) {
        throw new Error(atomicAmountForAsset.error);
    }

    console.log(atomicAmountForAsset)
    const { maxAmountRequired, asset } = atomicAmountForAsset;

    return {
        scheme: "exact",
        network,
        maxAmountRequired,
        resource,
        description,
        mimeType: "",
        payTo: payTo,
        maxTimeoutSeconds: 60,
        asset: asset.address,
        outputSchema: undefined,
        extra: {
            name: asset.eip712.name,
            version: asset.eip712.version,
        },
    };
}

/**
 * Verifies a payment and handles the response
 *
 * @param c - The Hono context
 * @param paymentRequirements - The payment requirements to verify against
 * @returns A promise that resolves to true if payment is valid, false otherwise
 */
export async function verifyPayment(
    c: any,
    paymentRequirements: PaymentRequirements[],
): Promise<boolean> {
    const payment = c.req.header("X-PAYMENT");
    if (!payment) {
        c.status(402);
        return c.json({
            x402Version,
            error: "X-PAYMENT header is required",
            accepts: paymentRequirements,
        });
    }

    let decodedPayment: PaymentPayload;
    try {
        decodedPayment = exact.evm.decodePayment(payment);
        decodedPayment.x402Version = x402Version;
    } catch (error) {
        c.status(402);
        return c.json({
            x402Version,
            error: error || "Invalid or malformed payment header",
            accepts: paymentRequirements,
        });
    }

    try {
        // Ensure we're using a valid payment requirement and not undefined
        const paymentRequirement = paymentRequirements[0];
        if (!paymentRequirement) {
            throw new Error("No payment requirements provided");
        }
        
        const response = await verify(decodedPayment, paymentRequirement);
        if (!response.isValid) {
            c.status(402);
            return c.json({
                x402Version,
                error: response.invalidReason,
                accepts: paymentRequirements,
                payer: response.payer,
            });
        }
    } catch (error) {
        c.status(402);
        return c.json({
            x402Version,
            error,
            accepts: paymentRequirements,
        });
    }

    return true;
}