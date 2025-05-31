import { and, desc, eq } from "drizzle-orm";
import db from "./index.js";
import {
    analytics,
    apiKeys,
    mcpServers,
    mcpTools,
    payments,
    serverOwnership,
    toolPricing,
    toolUsage,
    users,
    webhooks
} from "./schema.js";

// Define proper transaction type
export type TransactionType = Parameters<Parameters<typeof db['transaction']>[0]>[0];

// Enhanced transaction helper with better typing
export const withTransaction = async <T>(callback: (tx: TransactionType) => Promise<T>): Promise<T> => {
    return await db.transaction(async (tx) => {
        return await callback(tx);
    });
};

// Reusable transaction operations
export const txOperations = {
    // MCP Servers
    createServer: (data: {
        serverId: string;
        mcpOrigin: string;
        creatorId?: string;
        receiverAddress: string;
        requireAuth?: boolean;
        authHeaders?: Record<string, unknown>;
        description?: string;
        name?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const server = await tx.insert(mcpServers).values({
            serverId: data.serverId,
            name: data.name,
            mcpOrigin: data.mcpOrigin,
            creatorId: data.creatorId,
            receiverAddress: data.receiverAddress,
            requireAuth: data.requireAuth,
            authHeaders: data.authHeaders,
            description: data.description,
            metadata: data.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!server[0]) throw new Error("Failed to create server");
        return server[0];
    },

    getMcpServer: (id: string) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.id, id),
            columns: {
                id: true,
                serverId: true,
                name: true,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });
    },

    internal_getMcpServerByServerId: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.serverId, serverId),
            columns: {
                id: true,
                serverId: true,
                mcpOrigin: true,
                creatorId: true,
                receiverAddress: true,
                requireAuth: true,
                authHeaders: true,
                description: true,
                name: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });
    },

    getMcpServerByServerId: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.serverId, serverId),
            columns: {
                id: true,
                serverId: true,
                name: true,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });
    },

    listMcpServers: (limit = 10, offset = 0) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findMany({
            limit,
            offset,
            orderBy: [desc(mcpServers.createdAt)],
            columns: {
                id: true,
                serverId: true,
                name: true,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });
    },

    updateMcpServer: (id: string, data: {
        url?: string;
        mcpOrigin?: string;
        receiverAddress?: string;
        requireAuth?: boolean;
        authHeaders?: Record<string, unknown>;
        status?: string;
        description?: string;
        name?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const result = await tx.update(mcpServers)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(mcpServers.id, id))
            .returning();

        if (!result[0]) throw new Error(`MCP Server with ID ${id} not found`);
        return result[0];
    },

    deleteMcpServer: (id: string) => async (tx: TransactionType) => {
        const result = await tx.delete(mcpServers)
            .where(eq(mcpServers.id, id))
            .returning();

        if (!result[0]) throw new Error(`MCP Server with ID ${id} not found`);
        return result[0];
    },

    // MCP Tools
    createTool: (data: {
        serverId: string;
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        isMonetized?: boolean;
        payment?: Record<string, unknown>;
        status?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const tool = await tx.insert(mcpTools).values({
            serverId: data.serverId,
            name: data.name,
            description: data.description,
            inputSchema: data.inputSchema,
            isMonetized: data.isMonetized,
            payment: data.payment,
            status: data.status,
            metadata: data.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!tool[0]) throw new Error("Failed to create tool");
        return tool[0];
    },

    getMcpTool: (id: string) => async (tx: TransactionType) => {
        return await tx.query.mcpTools.findFirst({
            where: eq(mcpTools.id, id)
        });
    },

    listMcpToolsByServer: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.mcpTools.findMany({
            where: eq(mcpTools.serverId, serverId),
            orderBy: [mcpTools.name]
        });
    },

    updateTool: (toolId: string, data: {
        name?: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
        isMonetized?: boolean;
        payment?: Record<string, unknown>;
        status?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const tool = await tx.update(mcpTools)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(mcpTools.id, toolId))
            .returning();

        if (!tool[0]) throw new Error(`Tool with ID ${toolId} not found`);
        return tool[0];
    },

    deleteMcpTool: (id: string) => async (tx: TransactionType) => {
        const result = await tx.delete(mcpTools)
            .where(eq(mcpTools.id, id))
            .returning();

        if (!result[0]) throw new Error(`Tool with ID ${id} not found`);
        return result[0];
    },

    // Users
    getUserByWalletAddress: (walletAddress: string) => async (tx: TransactionType) => {
        return await tx.query.users.findFirst({
            where: eq(users.walletAddress, walletAddress)
        });
    },

    getUserById: (id: string) => async (tx: TransactionType) => {
        return await tx.query.users.findFirst({
            where: eq(users.id, id)
        });
    },

    createUser: (data: {
        walletAddress: string;
        email?: string;
        displayName?: string;
        avatarUrl?: string;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(users).values({
            walletAddress: data.walletAddress,
            email: data.email,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create user");
        return result[0];
    },

    updateUserLastLogin: (id: string) => async (tx: TransactionType) => {
        const now = new Date();

        const result = await tx.update(users)
            .set({
                lastLoginAt: now,
                updatedAt: now
            })
            .where(eq(users.id, id))
            .returning();

        if (!result[0]) throw new Error(`User with ID ${id} not found`);
        return result[0];
    },

    // Tool Pricing
    createToolPricing: (toolId: string, data: {
        price: string | number;
        currency: string;
        network: string;
        assetAddress?: string;
    }) => async (tx: TransactionType) => {
        const price = typeof data.price === 'number' ? data.price.toString() : data.price;

        const pricing = await tx.insert(toolPricing).values({
            toolId,
            price,
            currency: data.currency,
            network: data.network,
            assetAddress: data.assetAddress,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!pricing[0]) throw new Error("Failed to create pricing");
        return pricing[0];
    },

    getActiveToolPricing: (toolId: string) => async (tx: TransactionType) => {
        return await tx.query.toolPricing.findFirst({
            where: and(
                eq(toolPricing.toolId, toolId),
                eq(toolPricing.active, true)
            )
        });
    },

    deactivateToolPricing: (toolId: string) => async (tx: TransactionType) => {
        const currentPricing = await tx.query.toolPricing.findFirst({
            where: and(
                eq(toolPricing.toolId, toolId),
                eq(toolPricing.active, true)
            )
        });

        if (currentPricing) {
            await tx.update(toolPricing)
                .set({ active: false, updatedAt: new Date() })
                .where(eq(toolPricing.id, currentPricing.id));
            return currentPricing;
        }
        return null;
    },

    // Payments
    createPayment: (data: {
        toolId: string;
        userId?: string;
        amount: string | number;
        currency: string;
        network: string;
        transactionHash?: string;
        status?: string;
        signature?: string;
        paymentData?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const amountStr = typeof data.amount === 'number' ? data.amount.toString() : data.amount;

        const result = await tx.insert(payments).values({
            toolId: data.toolId,
            userId: data.userId,
            amount: amountStr,
            currency: data.currency,
            network: data.network,
            transactionHash: data.transactionHash,
            status: data.status || 'pending',
            signature: data.signature,
            paymentData: data.paymentData,
            createdAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create payment");
        return result[0];
    },

    updatePaymentStatus: (id: string, status: string, transactionHash?: string) => async (tx: TransactionType) => {
        const updated = await tx.update(payments)
            .set({
                status,
                ...(transactionHash ? { transactionHash } : {}),
                ...(status === 'completed' ? { settledAt: new Date() } : {})
            })
            .where(eq(payments.id, id))
            .returning();

        if (!updated[0]) throw new Error(`Payment with ID ${id} not found`);
        return updated[0];
    },

    getPaymentByTransactionHash: (transactionHash: string) => async (tx: TransactionType) => {
        return await tx.query.payments.findFirst({
            where: eq(payments.transactionHash, transactionHash)
        });
    },

    // Tool Usage
    recordToolUsage: (data: {
        toolId: string;
        userId?: string;
        responseStatus: string;
        executionTimeMs?: number;
        ipAddress?: string;
        userAgent?: string;
        requestData?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const executionTime = data.executionTimeMs !== undefined ? data.executionTimeMs : undefined;

        const result = await tx.insert(toolUsage).values({
            toolId: data.toolId,
            userId: data.userId,
            responseStatus: data.responseStatus,
            executionTimeMs: executionTime,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            requestData: data.requestData,
            timestamp: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to record tool usage");
        return result[0];
    },

    // Analytics
    getDailyAnalytics: (serverId: string, date: Date) => async (tx: TransactionType) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        return await tx.query.analytics.findFirst({
            where: and(
                eq(analytics.serverId, serverId),
                eq(analytics.date, startOfDay)
            )
        });
    },

    updateAnalytics: (id: string, data: {
        totalRequests?: number;
        totalRevenue?: number;
        uniqueUsers?: number;
        avgResponseTime?: number;
        toolUsage?: Record<string, unknown>;
        errorCount?: number;
    }) => async (tx: TransactionType) => {
        const dbData = {
            ...(data.totalRequests !== undefined ? { totalRequests: data.totalRequests } : {}),
            ...(data.totalRevenue !== undefined ? { totalRevenue: data.totalRevenue.toString() } : {}),
            ...(data.uniqueUsers !== undefined ? { uniqueUsers: data.uniqueUsers } : {}),
            ...(data.avgResponseTime !== undefined ? { avgResponseTime: data.avgResponseTime.toString() } : {}),
            ...(data.errorCount !== undefined ? { errorCount: data.errorCount } : {}),
            ...(data.toolUsage !== undefined ? { toolUsage: data.toolUsage } : {})
        };

        const result = await tx.update(analytics)
            .set(dbData)
            .where(eq(analytics.id, id))
            .returning();

        if (!result[0]) throw new Error(`Analytics with ID ${id} not found`);
        return result[0];
    },

    createDailyAnalytics: (
        serverId: string,
        date: Date,
        data?: {
            totalRequests?: number;
            totalRevenue?: number;
            uniqueUsers?: number;
            avgResponseTime?: number;
            toolUsage?: Record<string, unknown>;
            errorCount?: number;
        }
    ) => async (tx: TransactionType) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const result = await tx.insert(analytics).values({
            serverId,
            date: startOfDay,
            totalRequests: data?.totalRequests ?? 0,
            totalRevenue: data?.totalRevenue ? data.totalRevenue.toString() : '0',
            uniqueUsers: data?.uniqueUsers ?? 0,
            errorCount: data?.errorCount ?? 0,
            ...(data?.avgResponseTime !== undefined ? { avgResponseTime: data.avgResponseTime.toString() } : {}),
            ...(data?.toolUsage !== undefined ? { toolUsage: data.toolUsage } : {})
        }).returning();

        if (!result[0]) throw new Error("Failed to create daily analytics");
        return result[0];
    },

    updateOrCreateDailyAnalytics: (
        serverId: string,
        date: Date,
        data: {
            totalRequests?: number;
            totalRevenue?: number;
            uniqueUsers?: number;
            avgResponseTime?: number;
            toolUsage?: Record<string, unknown>;
            errorCount?: number;
            userId?: string; // Optional user ID to track for uniqueUsers
        }
    ) => async (tx: TransactionType) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const existing = await tx.query.analytics.findFirst({
            where: and(
                eq(analytics.serverId, serverId),
                eq(analytics.date, startOfDay)
            )
        });

        if (existing) {
            // Initialize updated data with existing values
            let updatedTotalRequests = existing.totalRequests;
            let updatedTotalRevenue = existing.totalRevenue;
            let updatedUniqueUsers = existing.uniqueUsers;
            let updatedAvgResponseTime = existing.avgResponseTime;
            let updatedErrorCount = existing.errorCount;
            let updatedToolUsage = existing.toolUsage as Record<string, number> || {};
            let updatedUserIdsList = existing.userIdsList as string[] || [];

            // Update values incrementally
            if (data.totalRequests !== undefined) {
                updatedTotalRequests += data.totalRequests;
            }

            if (data.totalRevenue !== undefined) {
                updatedTotalRevenue = (parseFloat(updatedTotalRevenue) + data.totalRevenue).toString();
            }

            if (data.errorCount !== undefined) {
                updatedErrorCount += data.errorCount;
            }

            // Add user ID to list if provided and not already included
            if (data.userId && !updatedUserIdsList.includes(data.userId)) {
                updatedUserIdsList.push(data.userId);
                // Update uniqueUsers count based on actual unique users
                updatedUniqueUsers = updatedUserIdsList.length;
            } else if (data.uniqueUsers !== undefined) {
                // Fallback if no userId provided
                updatedUniqueUsers += data.uniqueUsers;
            }

            // Update avgResponseTime using weighted average
            if (data.avgResponseTime !== undefined) {
                if (updatedAvgResponseTime !== null) {
                    const totalTime = parseFloat(updatedAvgResponseTime) * (updatedTotalRequests - (data.totalRequests || 1));
                    const newTotalTime = totalTime + data.avgResponseTime;
                    updatedAvgResponseTime = (newTotalTime / updatedTotalRequests).toString();
                } else {
                    updatedAvgResponseTime = data.avgResponseTime.toString();
                }
            }

            // Merge toolUsage data
            if (data.toolUsage) {
                for (const [toolId, count] of Object.entries(data.toolUsage)) {
                    updatedToolUsage[toolId] = (updatedToolUsage[toolId] || 0) + (count as number);
                }
            }

            const dbData = {
                totalRequests: updatedTotalRequests,
                totalRevenue: updatedTotalRevenue,
                uniqueUsers: updatedUniqueUsers,
                avgResponseTime: updatedAvgResponseTime,
                errorCount: updatedErrorCount,
                toolUsage: updatedToolUsage,
                userIdsList: updatedUserIdsList
            };

            const updated = await tx.update(analytics)
                .set(dbData)
                .where(eq(analytics.id, existing.id))
                .returning();

            return updated[0];
        } else {
            // For new records, initialize with provided data
            const toolUsage = data.toolUsage || {};
            const userIdsList = data.userId ? [data.userId] : [];

            return await tx.insert(analytics).values({
                serverId,
                date: startOfDay,
                totalRequests: data.totalRequests ?? 0,
                totalRevenue: data.totalRevenue ? data.totalRevenue.toString() : '0',
                uniqueUsers: userIdsList.length || (data.uniqueUsers ?? 0),
                errorCount: data.errorCount ?? 0,
                avgResponseTime: data.avgResponseTime?.toString() || null,
                toolUsage,
                userIdsList
            }).returning().then(res => res[0]);
        }
    },

    // Server Ownership
    assignOwnership: (serverId: string, userId: string, role = 'owner') => async (tx: TransactionType) => {
        const ownership = await tx.insert(serverOwnership).values({
            serverId,
            userId,
            role,
            active: true,
            createdAt: new Date()
        }).returning();

        if (!ownership[0]) throw new Error("Failed to assign ownership");
        return ownership[0];
    },

    getServerOwnership: (serverId: string, userId: string) => async (tx: TransactionType) => {
        return await tx.query.serverOwnership.findFirst({
            where: and(
                eq(serverOwnership.serverId, serverId),
                eq(serverOwnership.userId, userId),
                eq(serverOwnership.active, true)
            )
        });
    },

    listServerOwners: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.serverOwnership.findMany({
            where: and(
                eq(serverOwnership.serverId, serverId),
                eq(serverOwnership.active, true)
            )
        });
    },

    // API Keys
    createApiKey: (data: {
        userId: string;
        keyHash: string;
        name: string;
        permissions: string[];
        expiresAt?: Date;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(apiKeys).values({
            userId: data.userId,
            keyHash: data.keyHash,
            name: data.name,
            permissions: data.permissions,
            expiresAt: data.expiresAt,
            active: true,
            createdAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create API key");
        return result[0];
    },

    getApiKeyByHash: (keyHash: string) => async (tx: TransactionType) => {
        return await tx.query.apiKeys.findFirst({
            where: and(
                eq(apiKeys.keyHash, keyHash),
                eq(apiKeys.active, true)
            )
        });
    },

    updateApiKeyLastUsed: (id: string) => async (tx: TransactionType) => {
        const result = await tx.update(apiKeys)
            .set({
                lastUsedAt: new Date()
            })
            .where(eq(apiKeys.id, id))
            .returning();

        if (!result[0]) throw new Error(`API key with ID ${id} not found`);
        return result[0];
    },

    // Webhooks
    createWebhook: (data: {
        serverId: string;
        url: string;
        secret?: string;
        events: string[];
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(webhooks).values({
            serverId: data.serverId,
            url: data.url,
            secret: data.secret,
            events: data.events,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            failureCount: 0
        }).returning();

        if (!result[0]) throw new Error("Failed to create webhook");
        return result[0];
    },

    listWebhooks: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.webhooks.findMany({
            where: and(
                eq(webhooks.serverId, serverId),
                eq(webhooks.active, true)
            )
        });
    }
};

// Example of using standard transaction approach
export const createServerWithToolAndPricing = async (
    serverData: Parameters<typeof txOperations.createServer>[0],
    toolData: Parameters<typeof txOperations.createTool>[0],
    pricingData: Parameters<typeof txOperations.createToolPricing>[1]
) => {
    return await db.transaction(async (tx) => {
        // Create server first
        const server = await txOperations.createServer(serverData)(tx);

        // Use server ID for the tool
        toolData.serverId = server.serverId;
        const tool = await txOperations.createTool(toolData)(tx);

        // Add pricing for the tool
        const pricing = await txOperations.createToolPricing(tool.id, pricingData)(tx);

        // Assign ownership if creatorId exists
        if (serverData.creatorId) {
            await txOperations.assignOwnership(server.serverId, serverData.creatorId)(tx);
        }

        return { server, tool, pricing };
    });
};

// Example of updating tool with pricing in a more flexible way
export const updateToolWithNewPricing = async (
    toolId: string,
    toolData: Parameters<typeof txOperations.updateTool>[1],
    pricingData: Parameters<typeof txOperations.createToolPricing>[1]
) => {
    return await db.transaction(async (tx) => {
        const updatedTool = await txOperations.updateTool(toolId, toolData)(tx);
        await txOperations.deactivateToolPricing(toolId)(tx);
        const newPricing = await txOperations.createToolPricing(toolId, pricingData)(tx);

        return { tool: updatedTool, pricing: newPricing };
    });
};

// Complex transaction workflow examples

// Example: User registers and creates a server with tools in one transaction
export const registerUserWithServerAndTools = async (
    userData: Parameters<typeof txOperations.createUser>[0],
    serverData: Parameters<typeof txOperations.createServer>[0],
    toolsData: Parameters<typeof txOperations.createTool>[0][],
    webhookData?: Parameters<typeof txOperations.createWebhook>[0]
) => {
    return await db.transaction(async (tx) => {
        // Create the user first
        const user = await txOperations.createUser(userData)(tx);

        // Use the user's ID for the server
        serverData.creatorId = user.id;
        const server = await txOperations.createServer(serverData)(tx);

        // Create all tools
        const tools = [];
        for (const toolData of toolsData) {
            toolData.serverId = server.serverId;
            const tool = await txOperations.createTool(toolData)(tx);
            tools.push(tool);
        }

        // Create webhook if provided
        let webhook = null;
        if (webhookData) {
            webhookData.serverId = server.serverId;
            webhook = await txOperations.createWebhook(webhookData)(tx);
        }

        // Assign ownership
        await txOperations.assignOwnership(server.serverId, user.id, 'owner')(tx);

        return {
            user,
            server,
            tools,
            webhook
        };
    });
};

// Example: Process payment and record usage together
export const processPaymentWithUsage = async (
    paymentData: Parameters<typeof txOperations.createPayment>[0],
    usageData: Parameters<typeof txOperations.recordToolUsage>[0]
) => {
    return await db.transaction(async (tx) => {
        // Create payment record
        const payment = await txOperations.createPayment(paymentData)(tx);

        // Record tool usage
        const usage = await txOperations.recordToolUsage(usageData)(tx);

        // Update analytics if needed
        const today = new Date();

        // Get the server ID for this tool
        const tool = await txOperations.getMcpTool(paymentData.toolId)(tx);
        if (!tool) throw new Error(`Tool with ID ${paymentData.toolId} not found`);

        // Update daily analytics
        await txOperations.updateOrCreateDailyAnalytics(
            tool.serverId,
            today,
            {
                totalRequests: 1,
                totalRevenue: parseFloat(paymentData.amount.toString()),
                uniqueUsers: paymentData.userId ? 1 : 0,
                errorCount: usageData.responseStatus === 'error' ? 1 : 0,
                toolUsage: { [paymentData.toolId]: 1 }
            }
        )(tx);

        return { payment, usage };
    });
};

// Example: Create API key with transaction logging
export const createApiKeyWithTracking = async (
    userId: string,
    keyName: string,
    permissions: string[],
    keyHash: string
) => {
    return await db.transaction(async (tx) => {
        // Make sure user exists
        const user = await txOperations.getUserById(userId)(tx);
        if (!user) throw new Error(`User with ID ${userId} not found`);

        // Create API key
        const apiKey = await txOperations.createApiKey({
            userId,
            keyHash,
            name: keyName,
            permissions,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) // 1 year
        })(tx);

        // Create metadata record about API key creation
        const metadata = {
            event: 'api_key_created',
            userId,
            keyId: apiKey.id,
            permissions,
            timestamp: new Date()
        };

        // For demonstration - in real app we'd have a proper audit log table
        // Insert into audit log or similar tracking mechanism
        await tx.insert(analytics).values({
            serverId: 'system',
            date: new Date(),
            totalRequests: 0,
            totalRevenue: '0',
            uniqueUsers: 0,
            errorCount: 0,
            toolUsage: metadata
        });

        return { apiKey, metadata };
    });
};
