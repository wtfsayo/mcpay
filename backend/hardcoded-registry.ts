const registry = {
    "05599356-7a27-4519-872a-2ebb22467470": {
        "name": "Financial Datasets AI",
        "description": "Financial Datasets AI",
        "url": "https://financialdatasetsai-mcp.vercel.app/mcp",
        "auth-headers": {
            "Authorization": "Bearer 1234567890"
        },
        "pricing": {
            "enabled": true,
            "payTo": "0x1234567890123456789012345678901234567890",
            tools: {
                "getStockPrices": {
                    "id": "getStockPrices",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 100,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getStockPrices",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                }
            }
        }
    }
}

export default registry;