import type { PaymentRequirements as BasePaymentRequirements } from "x402/types";
import { z } from "zod";

// Extended network schema that includes additional networks
export const SupportedNetworkSchema = z.enum([
  "base-sepolia",
  "base", 
  "avalanche-fuji",
  "avalanche",
  "iotex",
  "sei-testnet"
]);

export type SupportedNetwork = z.infer<typeof SupportedNetworkSchema>;

// Extended PaymentRequirements schema that supports SupportedNetwork
export const ExtendedPaymentRequirementsSchema = z.object({
  scheme: z.enum(["exact"]),
  network: SupportedNetworkSchema,
  maxAmountRequired: z.string(),
  resource: z.string().url(),
  description: z.string(),
  mimeType: z.string(),
  outputSchema: z.record(z.any()).optional(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().int(),
  asset: z.string(),
  extra: z.record(z.any()).optional(),
});

export type ExtendedPaymentRequirements = z.infer<typeof ExtendedPaymentRequirementsSchema>;

// Type that can be used in place of the original PaymentRequirements but supports extended networks
export type SupportedPaymentRequirements = Omit<BasePaymentRequirements, 'network'> & {
  network: SupportedNetwork;
}; 