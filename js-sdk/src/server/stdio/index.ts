import { config } from "dotenv";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createServerConnections, ServerType, startStdioServer } from "./start-stdio-server.js";

config();

// Load environment variables
const privateKey = process.env.PRIVATE_KEY as Hex;
const serverUrls = process.env.SERVER_URLS?.split(',') as string[];

if (!privateKey || !serverUrls || serverUrls.length === 0) {
    throw new Error("Missing environment variables: PRIVATE_KEY and SERVER_URLS are required");
}

const account = privateKeyToAccount(privateKey);

/**
 * Main function to start the MCP stdio server
 * This connects to multiple remote MCP servers and exposes them via a stdio interface
 */
async function main() {
    try {
        console.log(`Connecting to ${serverUrls.length} server(s)...`);
        
        // Multi-server approach using PaymentTransport
        const serverConnections = createServerConnections(
            serverUrls,
                ServerType.Payment
            );
            
            await startStdioServer({
                serverConnections,
                account,
            });
            
        console.log(`Connected to ${serverUrls.length} servers using payment transport`);
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

// Run the main function
main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});