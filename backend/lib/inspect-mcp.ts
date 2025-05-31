import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { experimental_createMCPClient as createMCPClient } from "ai"

export async function getMcpTools(url: string) {
    try {
      const transport = new StreamableHTTPClientTransport(new URL(url))
      
      const client = await createMCPClient({
        transport,
      })
  
      const tools = await client.tools()
  
      if (!tools) {
        throw new Error("No tools found")
      }
  
      const toolsNames = Object.keys(tools)
  
      return toolsNames.map((toolName) => ({
        name: toolName,
        description: tools[toolName]?.description,
        inputSchema: tools[toolName]?.parameters,
      }))
    } catch (error) {
      console.error("Error fetching MCP tools:", error)
      throw new Error("Failed to fetch tools from MCP server")
    }
  }