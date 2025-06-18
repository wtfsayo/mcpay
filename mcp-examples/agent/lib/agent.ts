import { experimental_createMCPClient, generateText } from "ai";
import { createPaymentTransport } from "mcpay/browser";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { openai } from "./ai.js";

const privateKey = process.env.PRIVATE_KEY as Hex;
const mcpServers = process.env.MCP_SERVERS?.split(",");

export const runAgent = async (prompt: string) => {
    // Get tools from all MCP servers and merge into a single object

    const tools = mcpServers
        ? await Promise.all(mcpServers.map(url => getTools(url))).then(toolArrays =>
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
        tools,
    });

    return result.text;
};

const getTools = async (url: string) => {
    try {
        // Create the MCP URL using the serverId
        const mcpUrl = new URL(url)

        const account = privateKeyToAccount(privateKey);

        const transport = createPaymentTransport(new URL(mcpUrl), account, {
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