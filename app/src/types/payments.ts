
// Define payment information structure based on database schema
export interface PaymentInfo {
    maxAmountRequired: string;
    network: string;
    asset: string;
    payTo?: string;
    resource: string;
    description: string;
    // Optional pricing metadata when using tool_pricing table
    _pricingInfo?: {
        humanReadableAmount: string;
        currency: string;
        network: string;
        tokenDecimals: number;
        assetAddress?: string;
        priceRaw: string; // Original base units from pricing table
        pricingId: string; // Pricing ID for usage tracking
    };
}

// Define tool call type for better type safety
export type ToolCall = {
    name: string;
    args: Record<string, unknown>;
    isPaid: boolean;
    payment?: PaymentInfo;
    id?: string;
    toolId?: string;
    serverId?: string;
    pricingId?: string; // Include pricing ID for usage tracking
};