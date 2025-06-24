import { createMcpHandler, experimental_withMcpAuth } from "@vercel/mcp-adapter";
import { type Context, Hono } from "hono";
import { cors } from 'hono/cors';
import z from "zod";
import { txOperations, withTransaction } from "../db/actions.js";

export const runtime = 'nodejs'

const app = new Hono();

// Enable CORS for all routes
app.use('*', cors({
    origin: '*', // Allow all origins
    allowHeaders: ['*'], // Allow all headers
    allowMethods: ['*'], // Allow all methods
    exposeHeaders: ['*'], // Expose all headers
    maxAge: 86400, // Cache preflight requests for 24 hours
    credentials: true // Allow credentials
}));

const handler = createMcpHandler((server) => {
    server.tool(
        "price-listing",
        "Lists monetized tools available for purchase and their prices. Optionally filter by server ID.",
        {},
        async (_, { authInfo }) => {
            try {
                const serverId = authInfo?.extra?.id as string;

                if (!serverId) {
                    return {
                        content: [{
                            type: "text",
                            text: "No server ID provided"
                        }]
                    };
                }

                console.log(`[${new Date().toISOString()}] price-listing called by user: ${server}`);

                let tools: any[] = [];

                if (serverId) {
                    // Get tools for specific server
                    const server = await withTransaction(async (tx) => {
                        return await txOperations.internal_getMcpServerByServerId(serverId)(tx);
                    });

                    if (!server) {
                        return { 
                            content: [{ 
                                type: "text", 
                                text: `Server with ID "${serverId}" not found.` 
                            }] 
                        };
                    }

                    tools = await withTransaction(async (tx) => {
                        return await txOperations.listMcpToolsByServer(server.id)(tx);
                    });
                } else {
                    // Get all monetized tools across all servers
                    const servers = await withTransaction(async (tx) => {
                        return await txOperations.listMcpServers(100, 0)(tx);
                    });

                    for (const server of servers) {
                        const serverTools = await withTransaction(async (tx) => {
                            return await txOperations.listMcpToolsByServer(server.id)(tx);
                        });
                        tools.push(...serverTools.map(tool => ({ ...tool, serverInfo: server })));
                    }
                }

                // Filter only monetized tools
                const monetizedTools = tools.filter(tool => tool.isMonetized && tool.payment);

                if (monetizedTools.length === 0) {
                    return { 
                        content: [{ 
                            type: "text", 
                            text: serverId 
                                ? `No monetized tools found for server "${serverId}".`
                                : "No monetized tools found across all servers." 
                        }] 
                    };
                }

                // Format the response
                let response = `## Available Monetized Tools\n\n`;
                
                for (const tool of monetizedTools) {
                    const payment = tool.payment as any;
                    const serverName = tool.serverInfo?.name || 'Unknown Server';
                    const serverIdStr = tool.serverInfo?.serverId || serverId || 'Unknown';
                    
                    response += `### ${tool.name}\n`;
                    response += `**Server**: ${serverName} (ID: ${serverIdStr})\n`;
                    response += `**Description**: ${tool.description}\n`;
                    response += `**Price**: ${payment.maxAmountRequired} ${payment.asset}\n`;
                    response += `**Network**: ${payment.network}\n`;
                    response += `**Payment To**: ${payment.payTo || payment.asset}\n`;
                    
                    response += `\n---\n\n`;
                }

                response += `\n**Total Tools**: ${monetizedTools.length}\n`;
                response += `**Note**: Use the \`make-purchase\` tool to purchase access to any of these tools.`;

                return { 
                    content: [{ 
                        type: "text", 
                        text: response 
                    }] 
                };
            } catch (error) {
                console.error('Error in price-listing tool:', error);
                return { 
                    content: [{ 
                        type: "text", 
                        text: `Error fetching price listings: ${error instanceof Error ? error.message : 'Unknown error'}` 
                    }] 
                };
            }
        })

    server.tool(
        "payment-methods",
        "Lists supported payment methods and networks for making purchases",
        {
            network: z.string().optional().describe("Filter by specific network (e.g., 'base', 'base-sepolia', 'sei-testnet')"),
        },
        async ({ network }, { authInfo }) => {
            try {
                const id = authInfo?.extra?.id;
                console.log(`[${new Date().toISOString()}] payment-methods called by user: ${id}, network filter: ${network}`);

                // Define supported payment methods
                const supportedNetworks = [
                    {
                        name: "Base",
                        id: "base",
                        chainId: 8453,
                        currency: "ETH",
                        supportedTokens: ["USDC", "ETH"],
                        usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                        description: "Base mainnet - Lower fees, fast transactions"
                    },
                    {
                        name: "Base Sepolia",
                        id: "base-sepolia", 
                        chainId: 84532,
                        currency: "ETH",
                        supportedTokens: ["USDC", "ETH"],
                        usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        description: "Base testnet - For testing and development"
                    },
                    {
                        name: "Sei Testnet",
                        id: "sei-testnet",
                        chainId: 713715,
                        currency: "SEI",
                        supportedTokens: ["USDC", "SEI"],
                        usdcAddress: "0x0000000000000000000000000000000000000000", // Placeholder
                        description: "Sei testnet - High-performance blockchain"
                    }
                ];

                let filteredNetworks = supportedNetworks;
                if (network) {
                    filteredNetworks = supportedNetworks.filter(n => 
                        n.id.toLowerCase() === network.toLowerCase() || 
                        n.name.toLowerCase() === network.toLowerCase()
                    );
                    
                    if (filteredNetworks.length === 0) {
                        return {
                            content: [{
                                type: "text",
                                text: `Network "${network}" is not supported. Supported networks: ${supportedNetworks.map(n => n.id).join(', ')}`
                            }]
                        };
                    }
                }

                let response = `## Supported Payment Methods\n\n`;
                
                for (const net of filteredNetworks) {
                    response += `### ${net.name}\n`;
                    response += `**Network ID**: ${net.id}\n`;
                    response += `**Chain ID**: ${net.chainId}\n`;
                    response += `**Native Currency**: ${net.currency}\n`;
                    response += `**Supported Tokens**: ${net.supportedTokens.join(', ')}\n`;
                    response += `**USDC Address**: ${net.usdcAddress}\n`;
                    response += `**Description**: ${net.description}\n`;
                    response += `\n---\n\n`;
                }

                response += `## Payment Process\n\n`;
                response += `1. **Select Tool**: Use \`price-listing\` to see available tools\n`;
                response += `2. **Choose Network**: Select from supported networks above\n`;
                response += `3. **Make Purchase**: Use \`make-purchase\` with tool ID and payment method\n`;
                response += `4. **Execute Payment**: Follow the payment requirements returned\n`;
                response += `5. **Use Tool**: Access the tool through the MCP proxy\n\n`;
                response += `**Preferred Network**: Base (mainnet) for production, Base Sepolia for testing\n`;
                response += `**Preferred Token**: USDC for stable pricing`;

                return {
                    content: [{
                        type: "text",
                        text: response
                    }]
                };
            } catch (error) {
                console.error('Error in payment-methods tool:', error);
                return {
                    content: [{
                        type: "text",
                        text: `Error fetching payment methods: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }]
                };
            }
        })

    server.tool(
        "make-purchase",
        "Initiates a purchase for a monetized tool and returns payment requirements",
        {
            toolId: z.string().describe("The ID of the tool to purchase"),
            network: z.string().optional().default("base").describe("The network to use for payment (default: base)"),
            paymentAddress: z.string().optional().describe("Override the payment recipient address"),
        },
        async ({ toolId, network, paymentAddress }, { authInfo }) => {
            return {
                content: [{
                    type: "text",
                    text: "Tried to make a purchase to " + paymentAddress + " on " + network + " for tool " + toolId + " for server " + authInfo?.extra?.id
                }]
            };
        })

})

const wrappedHandler = async (req: Request, { id }: { id: string }) => {

    const authHandler = experimental_withMcpAuth(handler, (req) => {
        return Promise.resolve({
            token: "",
            extra: {
                id: id
            },
            clientId: "mcpay.fun-backend",
            scopes: ["*"],
        });
    });

    return authHandler(req);
};

// Add routes for MCP handling
app.all('/:id/*', async (c: Context) => {
    console.log(`[${new Date().toISOString()}] MCP-v2 request: ${c.req.method} ${c.req.url}`);

    const id = c.req.param('id');

    // Convert Hono context to standard Request and get response
    const response = await wrappedHandler(c.req.raw, { id });

    // Return the response through Hono
    return response;
});

export default app;