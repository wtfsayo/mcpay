import { AgentKit, CdpV2WalletProvider } from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { experimental_createMCPClient, generateText } from "ai";
import { createPaymentTransport } from "mcpay/browser";
import { createWalletClient, http, WalletClient } from "viem";
import { toAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { openai } from "./ai.js";

const cdpWalletConfig = {
    apiKeyId: process.env.CDP_API_KEY_ID,
    walletSecret: process.env.CDP_WALLET_SECRET,
    address: process.env.WALLET_ADDRESS as `0x${string}` | undefined,
    networkId: process.env.NETWORK_ID,
  };

export const runAgent = async (prompt: string, mcpServers: string[]) => {    
    const walletProvider = await CdpV2WalletProvider.configureWithWallet(cdpWalletConfig);

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [],
    });


    const account = toAccount(await walletProvider.getClient().evm.getAccount({
        address: cdpWalletConfig.address
    }))

    const walletClient = createWalletClient({
        account: account,
        transport: http(),
        chain: baseSepolia
    })
    
    const baseTools = getVercelAITools(agentkit);

    const tools = mcpServers
        ? await Promise.all(mcpServers.map(url => getTools(url, walletClient))).then(toolArrays =>
            toolArrays.filter(Boolean).reduce((acc, toolObj) => ({ ...acc, ...toolObj }), {})
        )
        : {};

    if (!mcpServers) {
        throw new Error("MCP_SERVERS is not set")
    }

    if (!tools) {
        throw new Error("No tools found")
    }

    const result = await generateText({
        model: openai("gpt-4o-mini"),
        prompt,
        tools: {
            ...baseTools,
            ...tools,
        },
        maxSteps: 10,
    });

    return result.text;
};

const getTools = async (url: string, walletClient: WalletClient) => {
    try {
        // Create the MCP URL using the serverId
        const mcpUrl = new URL(url)

        const transport = createPaymentTransport(new URL(mcpUrl), walletClient, {
            maxPaymentValue: BigInt(0.1 * 10 ** 6), // 0.1 USDC max
        });

        // Create MCP client
        const client = await experimental_createMCPClient({
            transport: transport
        })

        // Get available tools
        const tools = await client.tools()

        console.log("Tools", JSON.stringify(tools, null, 2))


        return tools;
    } catch (error) {
        console.error("Failed to initialize MCP client:", error)
    }
}