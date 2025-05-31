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
                "getCompanyFacts": {
                    "id": "getCompanyFacts",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getCompanyFacts",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getStockPrices": {
                    "id": "getStockPrices",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getStockPrices",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getStockSnapshot": {
                    "id": "getStockSnapshot",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getStockSnapshot",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getFinancialStatements": {
                    "id": "getFinancialStatements",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getFinancialStatements",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getInsiderTrades": {
                    "id": "getInsiderTrades",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getInsiderTrades",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getCompanyNews": {
                    "id": "getCompanyNews",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getCompanyNews",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "searchFinancialData": {
                    "id": "searchFinancialData",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://searchFinancialData",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getCryptoPrices": {
                    "id": "getCryptoPrices",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getCryptoPrices",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getCryptoSnapshot": {
                    "id": "getCryptoSnapshot",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getCryptoSnapshot",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getInstitutionalOwnership": {
                    "id": "getInstitutionalOwnership",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getInstitutionalOwnership",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getInvestorHoldings": {
                    "id": "getInvestorHoldings",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getInvestorHoldings",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getSecFilings": {
                    "id": "getSecFilings",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getSecFilings",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                },
                "getSecFilingItems": {
                    "id": "getSecFilingItems",
                    "isMonetized": true,
                    "payment": {
                        "maxAmountRequired": 0.001,
                        "price": 0.001,
                        "network": "base-sepolia",
                        "currency": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset-address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "resource": "tool://getSecFilingItems",
                        "description": "Payment for tool call",
                        "payTo": "0x1234567890123456789012345678901234567890"
                    }
                }
            }
        }
    }
}

export default registry;