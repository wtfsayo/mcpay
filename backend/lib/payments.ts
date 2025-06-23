/**
 * Multi-Chain Payment Processing Library
 * 
 * This module provides support for processing payments across multiple blockchain networks
 * using network-specific facilitators. Each network can have its own facilitator URL configured
 * via environment variables.
 * 
 * Supported Networks:
 * - base-sepolia: Base testnet (default)
 * - sei-testnet: Sei testnet
 * 
 * Environment Variables:
 * - SEI_TESTNET_FACILITATOR_URL: Facilitator URL for Sei testnet
 * - FACILITATOR_URL: Fallback facilitator URL for any unsupported networks
 * 
 * Usage:
 * The payment system automatically selects the appropriate facilitator based on the 
 * network specified in the payment requirements. No manual configuration is needed
 * in most cases - just set the appropriate environment variables.
 */

import type { Network, PaymentPayload, PaymentRequirements, Price, Resource } from "x402/types";

import { processPriceToAtomicAmount } from "x402/shared";
import { useFacilitator } from "x402/verify";
import { exact } from "x402/schemes";

// Network-specific facilitator URLs
const FACILITATOR_URLS: Partial<Record<Network | "sei-testnet", Resource>> = {
    "base-sepolia": process.env.BASE_SEPOLIA_FACILITATOR_URL as Resource || "https://x402.org/facilitator",
    "sei-testnet": process.env.SEI_TESTNET_FACILITATOR_URL as Resource || "https://6y3cdqj5s3.execute-api.us-west-2.amazonaws.com/prod",
} as const;

// Fallback facilitator URL
const DEFAULT_FACILITATOR_URL = process.env.FACILITATOR_URL as Resource || "https://x402.org/facilitator";

console.log(`[PAYMENTS] Facilitator URLs configured:`, FACILITATOR_URLS);

// Create facilitator instances for each network
const facilitatorInstances = new Map<Network, ReturnType<typeof useFacilitator>>();

function getFacilitatorForNetwork(network: Network) {
    if (!facilitatorInstances.has(network)) {
        const facilitatorUrl = FACILITATOR_URLS[network] || DEFAULT_FACILITATOR_URL;
        console.log(`[PAYMENTS] Creating facilitator instance for network ${network} with URL: ${facilitatorUrl}`);
        facilitatorInstances.set(network, useFacilitator({ url: facilitatorUrl }));
    }
    return facilitatorInstances.get(network)!;
}

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
        
        // Get the appropriate facilitator for the network
        const facilitator = getFacilitatorForNetwork(paymentRequirement.network);
        const response = await facilitator.verify(decodedPayment, paymentRequirement);
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

/**
 * Settles a payment using the appropriate facilitator for the network
 *
 * @param decodedPayment - The decoded payment payload
 * @param paymentRequirement - The payment requirement
 * @returns A promise that resolves to the settlement response
 */
export async function settle(
    decodedPayment: PaymentPayload,
    paymentRequirement: PaymentRequirements,
) {
    const facilitator = getFacilitatorForNetwork(paymentRequirement.network);
    return facilitator.settle(decodedPayment, paymentRequirement);
}